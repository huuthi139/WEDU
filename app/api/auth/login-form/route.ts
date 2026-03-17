import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/supabase/users';
import { verifyPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { isAdminRole, isSubAdminRole, DEMO_USERS } from '@/lib/utils/auth';

const SESSION_COOKIE = 'wedu-token';

function buildLoginResponse(user: { name: string; email: string; phone: string; role: string; memberLevel: string }, token: string, requestUrl: string) {
  const userJson = JSON.stringify({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    memberLevel: user.memberLevel,
  });
  const encodedUser = Buffer.from(userJson).toString('base64');

  const response = NextResponse.redirect(new URL('/dashboard', requestUrl));

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  response.cookies.set('wedu-user', encodedUser, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

// Handle traditional form POST submission (no JS required)
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = (formData.get('email') as string || '').trim().toLowerCase();
    const password = formData.get('password') as string || '';

    if (!email || !password) {
      return redirectWithError('Vui lòng nhập email và mật khẩu', request.url);
    }

    // Primary: Supabase
    let userProfile;
    try {
      userProfile = await getUserByEmail(email);
    } catch (err) {
      console.error('[LoginForm] Supabase lookup failed:', err instanceof Error ? err.message : err);
      // Continue to demo user fallback
    }

    if (userProfile) {
      if (!userProfile.password_hash) {
        return redirectWithError('Tài khoản chưa thiết lập mật khẩu. Vui lòng dùng chức năng Quên mật khẩu.', request.url);
      }

      const isValid = await verifyPassword(password, userProfile.password_hash);
      if (!isValid) {
        return redirectWithError('Email hoặc mật khẩu không đúng', request.url);
      }

      const role = isAdminRole(userProfile.role) ? 'admin'
        : isSubAdminRole(userProfile.role) ? 'sub_admin'
        : userProfile.role === 'instructor' ? 'instructor'
        : userProfile.role || 'user';
      const memberLevel = userProfile.member_level || 'Free';

      const token = await signToken({ email: userProfile.email, role, name: userProfile.name, level: memberLevel });

      return buildLoginResponse({
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone || '',
        role,
        memberLevel,
      }, token, request.url);
    }

    // Fallback: Demo users (for development/testing)
    const demoUser = DEMO_USERS.find(u => u.email.toLowerCase() === email);
    if (demoUser && demoUser.plainPassword === password) {
      const token = await signToken({ email: demoUser.email, role: demoUser.role, name: demoUser.name, level: demoUser.memberLevel });

      return buildLoginResponse({
        name: demoUser.name,
        email: demoUser.email,
        phone: demoUser.phone,
        role: demoUser.role,
        memberLevel: demoUser.memberLevel,
      }, token, request.url);
    }

    return redirectWithError('Email hoặc mật khẩu không đúng', request.url);
  } catch (error) {
    console.error('Form login error:', error);
    return redirectWithError('Lỗi hệ thống', request.url);
  }
}

function redirectWithError(error: string, baseUrl?: string) {
  const url = new URL('/login.html', baseUrl || 'http://localhost:3000');
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}
