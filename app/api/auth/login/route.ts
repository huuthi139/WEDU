import { verifyPassword, isLockedPassword } from '@/lib/auth/password';
import { getUserByEmail } from '@/lib/supabase/users';
import { signToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/permissions';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

const SESSION_COOKIE = 'wedu-token';

function makeAuthResponse(token: string) {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const emailOrUsername = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!emailOrUsername || !password) {
      return ERR.VALIDATION('Email/tên đăng nhập và mật khẩu không được để trống');
    }

    // If input doesn't contain "@", treat as username and append @wedu.vn
    const email = emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@wedu.vn`;

    // Supabase is the ONLY source of truth for authentication
    let userProfile;
    try {
      userProfile = await getUserByEmail(email);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('auth.login', 'DB lookup failed', { email, error: errMsg });
      // Provide specific error hint based on the failure reason
      if (errMsg.includes('Thiếu biến môi trường') || errMsg.includes('Missing')) {
        return ERR.INTERNAL('Cấu hình server thiếu biến môi trường Supabase. Vui lòng kiểm tra Vercel Environment Variables.');
      }
      if (errMsg.includes('fetch failed') || errMsg.includes('TIMEOUT') || errMsg.includes('ECONNREFUSED')) {
        return ERR.INTERNAL('Không thể kết nối Supabase. Kiểm tra NEXT_PUBLIC_SUPABASE_URL và kết nối mạng.');
      }
      return ERR.INTERNAL('Lỗi cơ sở dữ liệu: ' + errMsg.slice(0, 100));
    }

    if (!userProfile) {
      logger.info('auth.login', 'Login failed: user not found', { email });
      return ERR.INVALID_CREDENTIALS();
    }

    // Block login for accounts that still have a locked sentinel password.
    // These users must either have their password set by admin (default 123456)
    // or use the "Quên mật khẩu" (forgot-password) flow.
    if (isLockedPassword(userProfile.password_hash)) {
      logger.info('auth.login', 'Login blocked: account not yet activated (imported user)', { email });
      return ERR.VALIDATION(
        'Tài khoản chưa được kích hoạt. Vui lòng sử dụng chức năng "Quên mật khẩu" để đặt mật khẩu, hoặc đăng nhập bằng mật khẩu mặc định 123456.',
      );
    }

    const passwordValid = await verifyPassword(password, userProfile.password_hash);
    if (!passwordValid) {
      logger.info('auth.login', 'Login failed: invalid password', { email });
      return ERR.INVALID_CREDENTIALS();
    }

    const role = normalizeRole(userProfile.role);
    const token = await signToken({
      email: userProfile.email,
      role,
      name: userProfile.name,
      level: userProfile.member_level || 'Free',
    });
    logger.info('auth.login', 'Login successful', { email, role });
    return makeAuthResponse(token);
  } catch (error) {
    logger.error('auth.login', 'Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
