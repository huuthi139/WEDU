import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

const GAS_TIMEOUT = 15000; // 15 seconds

/** Fetch with timeout to prevent hanging requests */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = GAS_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Safely parse JSON from response, returns null if not JSON */
async function safeJsonParse(res: Response): Promise<any | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json') && !ct.includes('javascript')) {
    // Google Apps Script sometimes returns text/html on redirect errors
    console.warn('[Register] Non-JSON response:', ct);
    return null;
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 15) : '';

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Tên phải có ít nhất 2 ký tự' },
        { status: 400 }
      );
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Hash password for storage
    const hashedPassword = await hashPassword(password);

    // Method 1: Try Firebase Auth registration
    try {
      const { getAdminAuth } = await import('@/lib/firebase/admin');
      const auth = getAdminAuth();

      const firebaseUser = await auth.createUser({
        email,
        password,
        displayName: name,
      });

      // Create user profile in Firestore
      try {
        const { createUserProfile } = await import('@/lib/firebase/users');
        const { getAdminDb } = await import('@/lib/firebase/admin');

        const userProfile = await createUserProfile(firebaseUser.uid, {
          email, name, phone, role: 'user', memberLevel: 'Free',
        });

        const db = getAdminDb();
        await db.collection('users').doc(firebaseUser.uid).update({
          passwordHash: hashedPassword,
        });

        try {
          await createSession({ email, role: 'user', name, level: 'Free' });
        } catch (sessionErr) {
          console.error('[Register] Session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
        }

        return NextResponse.json({
          success: true,
          user: {
            name: userProfile.name,
            email: userProfile.email,
            phone: userProfile.phone,
            role: userProfile.role,
            memberLevel: userProfile.memberLevel,
          },
        });
      } catch (firestoreErr) {
        console.error('[Register] Firestore error:', firestoreErr instanceof Error ? firestoreErr.message : firestoreErr);

        try {
          await createSession({ email, role: 'user', name, level: 'Free' });
        } catch {}

        return NextResponse.json({
          success: true,
          user: { name, email, phone, role: 'user', memberLevel: 'Free' },
        });
      }
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === 'auth/email-already-exists') {
        return NextResponse.json(
          { success: false, error: 'Email đã được sử dụng. Vui lòng dùng email khác.' },
          { status: 409 }
        );
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[Register] Firebase unavailable, trying Google Sheets fallback:', errMsg);
    }

    // Method 2: Google Apps Script fallback (saves to Google Sheets)
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (scriptUrl) {
      try {
        // First check if email already exists via login action
        const checkRes = await fetchWithTimeout(
          `${scriptUrl}?action=login&email=${encodeURIComponent(email)}`,
          { redirect: 'follow' }
        );
        const checkData = await safeJsonParse(checkRes);

        if (checkData?.success && checkData?.user) {
          return NextResponse.json(
            { success: false, error: 'Email đã được sử dụng. Vui lòng dùng email khác.' },
            { status: 409 }
          );
        }

        // Register via Google Apps Script
        const params = new URLSearchParams({
          action: 'register',
          name,
          email,
          passwordHash: hashedPassword,
          phone,
        });

        const res = await fetchWithTimeout(
          `${scriptUrl}?${params.toString()}`,
          { redirect: 'follow' }
        );
        const data = await safeJsonParse(res);

        if (data?.success) {
          try {
            await createSession({ email, role: 'user', name, level: 'Free' });
          } catch (sessionErr) {
            console.error('[Register] Session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
          }

          return NextResponse.json({
            success: true,
            user: {
              name: data.user?.name || name,
              email: data.user?.email || email,
              phone: data.user?.phone || phone,
              role: 'user',
              memberLevel: 'Free',
            },
          });
        }

        if (data) {
          // Google Script returned an error response (e.g. email already exists)
          return NextResponse.json(
            { success: false, error: data.error || 'Không thể tạo tài khoản.' },
            { status: 400 }
          );
        }

        // data is null = non-JSON response, fall through
        console.warn('[Register] Google Script returned non-JSON response');
      } catch (scriptErr) {
        const msg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
        if (msg.includes('aborted') || msg.includes('abort')) {
          console.error('[Register] Google Script timeout after', GAS_TIMEOUT, 'ms');
        } else {
          console.error('[Register] Google Script error:', msg);
        }
      }
    }

    return NextResponse.json(
      { success: false, error: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('[Register] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
