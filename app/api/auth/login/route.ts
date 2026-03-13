import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { isAdminRole, DEMO_USERS } from '@/lib/utils/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email và mật khẩu không được để trống' },
        { status: 400 }
      );
    }

    // Method 1: Firebase Auth - verify credentials via Admin SDK
    let firebaseAvailable = false;
    try {
      const { getAdminAuth } = await import('@/lib/firebase/admin');
      const auth = getAdminAuth();

      const firebaseUser = await auth.getUserByEmail(email);
      firebaseAvailable = true;

      const { getUserByUid } = await import('@/lib/firebase/users');
      const userProfile = await getUserByUid(firebaseUser.uid);

      if (!userProfile) {
        return NextResponse.json(
          { success: false, error: 'Email hoặc mật khẩu không đúng' },
          { status: 401 }
        );
      }

      if (body.idToken) {
        const decodedToken = await auth.verifyIdToken(body.idToken);
        if (decodedToken.email?.toLowerCase() !== email.toLowerCase()) {
          return NextResponse.json(
            { success: false, error: 'Token không hợp lệ' },
            { status: 401 }
          );
        }
      } else {
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
        const userData = userDoc.data();

        if (userData?.passwordHash) {
          const isValid = await verifyPassword(password, userData.passwordHash);
          if (!isValid) {
            return NextResponse.json(
              { success: false, error: 'Email hoặc mật khẩu không đúng' },
              { status: 401 }
            );
          }
        }
      }

      const role = isAdminRole(userProfile.role) ? 'admin' : 'user';
      const memberLevel = userProfile.memberLevel || 'Free';

      await createSession({ email: userProfile.email, role, name: userProfile.name, level: memberLevel });

      return NextResponse.json({
        success: true,
        user: {
          name: userProfile.name,
          email: userProfile.email,
          phone: userProfile.phone || '',
          role,
          memberLevel,
        },
      });
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === 'auth/user-not-found') {
        console.log('[Login] User not found in Firebase Auth, trying fallback');
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('EAI_AGAIN') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT') || errMsg.includes('fetch') || errMsg.includes('Missing required env vars')) {
          console.warn('[Login] Firebase unreachable, trying Google Sheets fallback');
        } else {
          console.error('[Login] Firebase Auth error:', errMsg);
        }
      }
    }

    // Method 2: Google Apps Script fallback (reads from Google Sheets)
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (scriptUrl) {
      try {
        const res = await fetch(
          `${scriptUrl}?action=login&email=${encodeURIComponent(email)}`,
          { redirect: 'follow' }
        );
        const data = await res.json();

        if (data.success && data.user) {
          const storedHash = data.user.passwordHash || '';
          const isValid = await verifyPassword(password, storedHash);

          if (isValid) {
            const role = isAdminRole(data.user.role) ? 'admin' : 'user';
            const memberLevel = data.user.memberLevel || 'Free';
            const userName = data.user.name || '';

            // Try to create session cookie - don't fail if it doesn't work
            try {
              await createSession({ email: data.user.email, role, name: userName, level: memberLevel });
            } catch (sessionErr) {
              console.error('[Login] Session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
            }

            return NextResponse.json({
              success: true,
              user: {
                name: userName,
                email: data.user.email,
                phone: data.user.phone || '',
                role,
                memberLevel,
              },
            });
          }

          // User found but wrong password
          return NextResponse.json(
            { success: false, error: 'Email hoặc mật khẩu không đúng' },
            { status: 401 }
          );
        }
        // User not found in Google Sheets - continue to demo fallback
      } catch (scriptErr) {
        console.error('[Login] Google Script error:', scriptErr instanceof Error ? scriptErr.message : scriptErr);
      }
    }

    // Method 3: Local demo fallback
    const demoUser = DEMO_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );
    if (demoUser) {
      const isValid = await verifyPassword(password, await hashPassword(demoUser.plainPassword));
      if (isValid) {
        try {
          await createSession({ email: demoUser.email, role: demoUser.role, name: demoUser.name, level: demoUser.memberLevel });
        } catch (sessionErr) {
          console.error('[Login] Demo session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
        }

        return NextResponse.json({
          success: true,
          user: {
            name: demoUser.name,
            email: demoUser.email,
            phone: demoUser.phone,
            role: demoUser.role,
            memberLevel: demoUser.memberLevel,
          },
        });
      }
    }

    // If nothing worked
    if (!firebaseAvailable && !scriptUrl) {
      return NextResponse.json(
        { success: false, error: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Email hoặc mật khẩu không đúng' },
      { status: 401 }
    );
  } catch (error) {
    console.error('[Login] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
