import { NextResponse } from 'next/server';
import { isAdminRole, isSubAdminRole, DEMO_USERS } from '@/lib/utils/auth';
import { verifyPassword } from '@/lib/auth/password';
import { getUserByEmail } from '@/lib/supabase/users';
import { signToken } from '@/lib/auth/jwt';

const SESSION_COOKIE = 'wedu-token';

function buildJsonResponse(user: { name: string; email: string; phone: string; role: string; memberLevel: string }, token: string) {
  const response = NextResponse.json({
    success: true,
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      memberLevel: user.memberLevel,
    },
  });

  // Set JWT session cookie directly on the response (more reliable than cookies() API)
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email và mật khẩu không được để trống' },
        { status: 400 }
      );
    }

    // Primary: Supabase
    let userProfile;
    try {
      userProfile = await getUserByEmail(email);
    } catch (err) {
      console.error('[Login] Supabase lookup failed:', err instanceof Error ? err.message : err);
      // Continue to demo user fallback
    }

    if (userProfile) {
      // Verify password - reject if no password_hash is set
      if (!userProfile.password_hash) {
        return NextResponse.json(
          { success: false, error: 'Tài khoản chưa thiết lập mật khẩu. Vui lòng dùng chức năng Quên mật khẩu.' },
          { status: 401 }
        );
      }
      const isValid = await verifyPassword(password, userProfile.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Email hoặc mật khẩu không đúng' },
          { status: 401 }
        );
      }

      const role = isAdminRole(userProfile.role) ? 'admin'
        : isSubAdminRole(userProfile.role) ? 'sub_admin'
        : userProfile.role === 'instructor' ? 'instructor'
        : userProfile.role || 'user';
      const memberLevel = userProfile.member_level || 'Free';

      const token = await signToken({ email: userProfile.email, role, name: userProfile.name, level: memberLevel });

      return buildJsonResponse({
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone || '',
        role,
        memberLevel,
      }, token);
    }

    // Fallback: Demo users (for development/testing only)
    const demoUser = DEMO_USERS.find(
      u => u.email.toLowerCase() === email
    );
    if (demoUser && demoUser.plainPassword === password) {
      try {
        const token = await signToken({ email: demoUser.email, role: demoUser.role, name: demoUser.name, level: demoUser.memberLevel });

        return buildJsonResponse({
          name: demoUser.name,
          email: demoUser.email,
          phone: demoUser.phone,
          role: demoUser.role,
          memberLevel: demoUser.memberLevel,
        }, token);
      } catch (err) {
        console.error('[Login] Demo token creation failed:', err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Email hoặc mật khẩu không đúng' },
      { status: 401 }
    );
  } catch (error) {
    console.error('[Login] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
