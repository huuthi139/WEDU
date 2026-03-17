import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/supabase/users';
import { verifyPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/permissions';
import { logger } from '@/lib/telemetry/logger';

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

    // Look up user in database only (no demo fallback)
    let userProfile;
    try {
      userProfile = await getUserByEmail(email);
    } catch (err) {
      logger.error('auth.login-form', 'DB lookup failed', { email, error: err instanceof Error ? err.message : String(err) });
      return redirectWithError('Lỗi hệ thống', request.url);
    }

    if (!userProfile || !userProfile.password_hash) {
      return redirectWithError('Email hoặc mật khẩu không đúng', request.url);
    }

    const passwordValid = await verifyPassword(password, userProfile.password_hash);
    if (!passwordValid) {
      return redirectWithError('Email hoặc mật khẩu không đúng', request.url);
    }

    const role = normalizeRole(userProfile.role);
    const memberLevel = userProfile.member_level || 'Free';

    const token = await signToken({
      email: userProfile.email,
      role,
      name: userProfile.name,
      level: memberLevel,
    });

    const response = NextResponse.redirect(new URL('/dashboard', request.url));

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    logger.info('auth.login-form', 'Login successful', { email, role });

    return response;
  } catch (error) {
    logger.error('auth.login-form', 'Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return redirectWithError('Lỗi hệ thống', request.url);
  }
}

function redirectWithError(error: string, baseUrl?: string) {
  const url = new URL('/login', baseUrl || 'http://localhost:3000');
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}
