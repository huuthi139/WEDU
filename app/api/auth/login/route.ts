import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { isAdminRole, isSubAdminRole, DEMO_USERS } from '@/lib/utils/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { getLocalUser } from '@/lib/fallback-data';

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
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email và mật khẩu không được để trống' },
        { status: 400 }
      );
    }

    // Method 1: Supabase - verify credentials
    try {
      const { getUserByEmail } = await import('@/lib/supabase/users');
      const userProfile = await getUserByEmail(email);

      if (userProfile) {
        // Verify password
        if (userProfile.password_hash) {
          const isValid = await verifyPassword(password, userProfile.password_hash);
          if (!isValid) {
            return NextResponse.json(
              { success: false, error: 'Email hoặc mật khẩu không đúng' },
              { status: 401 }
            );
          }
        }

        // Preserve the actual role from database (admin, sub_admin, instructor, user)
        const role = isAdminRole(userProfile.role) ? 'admin'
          : isSubAdminRole(userProfile.role) ? 'sub_admin'
          : userProfile.role === 'instructor' ? 'instructor'
          : userProfile.role || 'user';
        const memberLevel = userProfile.member_level || 'Free';

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
      }
      // User not found in Supabase, try fallback
      console.log('[Login] User not found in Supabase, trying fallback');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[Login] Supabase unavailable, trying Google Sheets fallback:', errMsg);
    }

    // Method 2: Google Apps Script fallback (reads from Google Sheets)
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (scriptUrl) {
      try {
        const res = await fetchWithTimeout(
          `${scriptUrl}?action=login&email=${encodeURIComponent(email)}`,
          { redirect: 'follow' }
        );
        const data = await safeJsonParse(res);

        if (data?.success && data?.user) {
          const storedHash = data.user.passwordHash || '';

          // Support both bcrypt hashed passwords and legacy plaintext passwords
          let isValid = false;
          if (storedHash.startsWith('$2')) {
            // bcrypt hash
            isValid = await verifyPassword(password, storedHash);
          } else if (storedHash && storedHash === password) {
            // Legacy plaintext password - verify and migrate to bcrypt
            isValid = true;
            try {
              const newHash = await hashPassword(password);
              await fetchWithTimeout(
                `${scriptUrl}?action=updatePassword&email=${encodeURIComponent(email)}&passwordHash=${encodeURIComponent(newHash)}`,
                { redirect: 'follow' },
                10000
              );
              console.log('[Login] Migrated plaintext password to bcrypt for:', email);
            } catch (migrateErr) {
              console.warn('[Login] Password migration failed:', migrateErr instanceof Error ? migrateErr.message : migrateErr);
            }
          }

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
        const msg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
        if (msg.includes('aborted') || msg.includes('abort')) {
          console.error('[Login] Google Script timeout after', GAS_TIMEOUT, 'ms');
        } else {
          console.error('[Login] Google Script error:', msg);
        }
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

    // Method 4: Local in-memory user store (users registered via fallback)
    const localUser = getLocalUser(email);
    if (localUser) {
      const isValid = await verifyPassword(password, localUser.passwordHash);
      if (isValid) {
        try {
          await createSession({ email: localUser.email, role: localUser.role, name: localUser.name, level: localUser.memberLevel });
        } catch (sessionErr) {
          console.error('[Login] Local session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
        }

        return NextResponse.json({
          success: true,
          user: {
            name: localUser.name,
            email: localUser.email,
            phone: localUser.phone,
            role: localUser.role,
            memberLevel: localUser.memberLevel,
          },
        });
      }
      return NextResponse.json(
        { success: false, error: 'Email hoặc mật khẩu không đúng' },
        { status: 401 }
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
