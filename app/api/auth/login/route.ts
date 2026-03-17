import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { getUserByEmail } from '@/lib/supabase/users';
import { signToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/permissions';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

const SESSION_COOKIE = 'wedu-token';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!email || !password) {
      return ERR.VALIDATION('Email và mật khẩu không được để trống');
    }

    // Look up user in database (single source of truth)
    let userProfile;
    try {
      userProfile = await getUserByEmail(email);
    } catch (err) {
      logger.error('auth.login', 'DB lookup failed', { email, error: err instanceof Error ? err.message : String(err) });
      return ERR.INTERNAL('Lỗi hệ thống, vui lòng thử lại');
    }

    if (!userProfile) {
      logger.info('auth.login', 'Login failed: user not found', { email });
      // Generic error message to prevent user enumeration
      return ERR.INVALID_CREDENTIALS();
    }

    // Verify password
    if (!userProfile.password_hash) {
      logger.warn('auth.login', 'User has no password hash', { email });
      return ERR.INVALID_CREDENTIALS();
    }

    const passwordValid = await verifyPassword(password, userProfile.password_hash);
    if (!passwordValid) {
      logger.info('auth.login', 'Login failed: invalid password', { email });
      return ERR.INVALID_CREDENTIALS();
    }

    // Create JWT session
    const role = normalizeRole(userProfile.role);
    const memberLevel = userProfile.member_level || 'Free';

    const token = await signToken({
      email: userProfile.email,
      role,
      name: userProfile.name,
      level: memberLevel,
    });

    // Set httpOnly cookie and return success (no user data in response)
    const response = apiSuccess({ authenticated: true });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    logger.info('auth.login', 'Login successful', { email, role });

    return response;
  } catch (error) {
    logger.error('auth.login', 'Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
