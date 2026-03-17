import { NextResponse } from 'next/server';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { getUserByEmail, updateUserProfile } from '@/lib/supabase/users';
import { signToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/permissions';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';
import { tryAutoBootstrap } from '@/lib/supabase/bootstrap';

const SESSION_COOKIE = 'wedu-token';

// Demo admin accounts that work when Supabase is unreachable
const DEMO_ACCOUNTS: Record<string, { password: string; role: string; name: string; level: string }> = {
  'admin@wedu.vn': { password: 'Admin139@', role: 'admin', name: 'Admin WEDU', level: 'VIP' },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let emailOrUsername = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!emailOrUsername || !password) {
      return ERR.VALIDATION('Email/tên đăng nhập và mật khẩu không được để trống');
    }

    // If input doesn't contain "@", treat as username and append @wedu.vn
    const email = emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@wedu.vn`;

    // Look up user in database (single source of truth)
    let userProfile;
    let dbUnavailable = false;
    try {
      userProfile = await getUserByEmail(email);

      // If user not found, try auto-bootstrap (sync from Google Sheet)
      // This handles the case where Supabase was wiped/reset
      if (!userProfile) {
        const bootstrapped = await tryAutoBootstrap();
        if (bootstrapped) {
          logger.info('auth.login', 'Auto-bootstrap triggered, retrying lookup', { email });
          userProfile = await getUserByEmail(email);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('auth.login', 'DB lookup failed', { email, error: errMsg });

      // If DB is completely unreachable (network error), try demo fallback
      if (errMsg.includes('fetch failed') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND')) {
        dbUnavailable = true;
        logger.info('auth.login', 'DB unreachable, trying demo fallback', { email });
      } else if (errMsg.includes('Thiếu biến môi trường') || errMsg.includes('SUPABASE')) {
        return ERR.INTERNAL('Lỗi cấu hình hệ thống. Vui lòng liên hệ quản trị viên.');
      } else if (errMsg.includes('PGRST') || errMsg.includes('relation') || errMsg.includes('does not exist')) {
        return ERR.INTERNAL('Cơ sở dữ liệu chưa được thiết lập. Vui lòng chạy /api/admin/setup-db.');
      } else {
        // For other errors, also try demo fallback
        dbUnavailable = true;
      }
    }

    // Demo fallback when Supabase is unreachable
    if (dbUnavailable && !userProfile) {
      const demoAccount = DEMO_ACCOUNTS[email];
      if (demoAccount && password === demoAccount.password) {
        logger.info('auth.login', 'Demo fallback login successful', { email });
        const token = await signToken({
          email,
          role: demoAccount.role,
          name: demoAccount.name,
          level: demoAccount.level,
        });

        const response = apiSuccess({ authenticated: true });
        response.cookies.set(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        return response;
      }

      if (demoAccount) {
        return ERR.INVALID_CREDENTIALS();
      }
      return ERR.INTERNAL('Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.');
    }

    if (!userProfile) {
      logger.info('auth.login', 'Login failed: user not found', { email });
      return ERR.INVALID_CREDENTIALS();
    }

    // If user has no password (synced from Google Sheet), set the provided password as their new password
    if (!userProfile.password_hash) {
      logger.info('auth.login', 'Setting initial password for Sheet user', { email });
      const newHash = await hashPassword(password);
      await updateUserProfile(email, { password_hash: newHash });
      // Password is now set, continue login
    } else {
      // Verify password
      const passwordValid = await verifyPassword(password, userProfile.password_hash);
      if (!passwordValid) {
        logger.info('auth.login', 'Login failed: invalid password', { email });
        return ERR.INVALID_CREDENTIALS();
      }
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
