import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { getUserByEmail, updateUserProfile } from '@/lib/supabase/users';
import { signToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/permissions';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';
import { tryAutoBootstrap } from '@/lib/supabase/bootstrap';
import { getLocalUser, verifyLocalPassword } from '@/lib/fallback-data';

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

    // === Layer 1: Supabase (primary database) ===
    let userProfile;
    let dbUnavailable = false;
    try {
      userProfile = await getUserByEmail(email);

      // If user not found, try auto-bootstrap (sync from Google Sheet)
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

      if (errMsg.includes('Thiếu biến môi trường') || errMsg.includes('SUPABASE')) {
        // Don't return error - fall through to fallback layers
        logger.info('auth.login', 'Supabase not configured, using fallback', { email });
      } else if (errMsg.includes('PGRST') || errMsg.includes('relation') || errMsg.includes('does not exist')) {
        logger.info('auth.login', 'DB table missing, using fallback', { email });
      }
      dbUnavailable = true;
    }

    // If Supabase returned a user, verify password
    if (userProfile) {
      if (!userProfile.password_hash) {
        // No password set yet (synced from Google Sheet) - set provided password
        logger.info('auth.login', 'Setting initial password for Sheet user', { email });
        try {
          const newHash = await hashPassword(password);
          await updateUserProfile(email, { password_hash: newHash });
        } catch {
          // DB might be flaky, continue anyway
        }
      } else {
        const passwordValid = await verifyPassword(password, userProfile.password_hash);
        if (!passwordValid) {
          logger.info('auth.login', 'Login failed: invalid password', { email });
          return ERR.INVALID_CREDENTIALS();
        }
      }

      const role = normalizeRole(userProfile.role);
      const token = await signToken({
        email: userProfile.email,
        role,
        name: userProfile.name,
        level: userProfile.member_level || 'Free',
      });
      logger.info('auth.login', 'Login successful via Supabase', { email, role });
      return makeAuthResponse(token);
    }

    // === Layer 2: Google Sheets API (when Supabase is unavailable) ===
    if (dbUnavailable) {
      const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
      if (scriptUrl) {
        try {
          logger.info('auth.login', 'Trying Google Sheets fallback', { email });
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const sheetRes = await fetch(
            `${scriptUrl}?action=login&email=${encodeURIComponent(email)}`,
            { redirect: 'follow', signal: controller.signal }
          );
          clearTimeout(timeout);

          const sheetData = await sheetRes.json();
          if (sheetData?.success && sheetData.user) {
            const sheetUser = sheetData.user;
            const sheetPwHash = (sheetUser.passwordHash || '').toString().trim();
            const isBcrypt = sheetPwHash.startsWith('$2a$') || sheetPwHash.startsWith('$2b$');

            let passwordOk = false;
            if (isBcrypt) {
              passwordOk = await verifyPassword(password, sheetPwHash);
            } else if (sheetPwHash) {
              passwordOk = password === sheetPwHash;
            }

            if (passwordOk) {
              logger.info('auth.login', 'Google Sheets fallback login successful', { email });
              const role = sheetUser.role === 'admin' ? 'admin' : 'user';
              const level = ['Free', 'Premium', 'VIP'].includes(sheetUser.memberLevel) ? sheetUser.memberLevel : 'Free';
              const token = await signToken({ email, role, name: sheetUser.name || '', level });
              return makeAuthResponse(token);
            } else {
              return ERR.INVALID_CREDENTIALS();
            }
          }
        } catch (sheetErr) {
          logger.error('auth.login', 'Google Sheets fallback failed', {
            error: sheetErr instanceof Error ? sheetErr.message : String(sheetErr),
          });
        }
      }

      // === Layer 3: Embedded local user data (last resort) ===
      const localUser = getLocalUser(email);
      if (localUser) {
        if (verifyLocalPassword(email, password)) {
          logger.info('auth.login', 'Local fallback login successful', { email });
          const token = await signToken({
            email,
            role: localUser.role,
            name: localUser.name,
            level: localUser.memberLevel,
          });
          return makeAuthResponse(token);
        } else {
          return ERR.INVALID_CREDENTIALS();
        }
      }

      return ERR.INTERNAL('Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.');
    }

    // User not found in Supabase (DB was reachable but user doesn't exist)
    logger.info('auth.login', 'Login failed: user not found', { email });
    return ERR.INVALID_CREDENTIALS();
  } catch (error) {
    logger.error('auth.login', 'Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
