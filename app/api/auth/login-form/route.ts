import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/supabase/users';
import { verifyPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { isAdminRole, isSubAdminRole } from '@/lib/utils/auth';

const SESSION_COOKIE = 'wedu-token';

// Handle traditional form POST submission (no JS required)
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = (formData.get('email') as string || '').trim().toLowerCase();
    const password = formData.get('password') as string || '';

    if (!email || !password) {
      return redirectWithError('Vui lòng nhập email và mật khẩu', request.url);
    }

    // Authenticate directly instead of internal fetch (avoids losing cookies)
    const userProfile = await getUserByEmail(email);

    if (!userProfile || !userProfile.password_hash) {
      return redirectWithError('Email hoặc mật khẩu không đúng', request.url);
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

    // Create JWT token directly
    const token = await signToken({ email: userProfile.email, role, name: userProfile.name, level: memberLevel });

    // Set user data as cookie so dashboard can read it
    const userJson = JSON.stringify({
      name: userProfile.name,
      email: userProfile.email,
      phone: userProfile.phone || '',
      role,
      memberLevel,
    });
    const encodedUser = Buffer.from(userJson).toString('base64');

    const response = NextResponse.redirect(new URL('/dashboard', request.url));

    // Set JWT session cookie (same as createSession but on our response)
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Set user display cookie
    response.cookies.set('wedu-user', encodedUser, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
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
