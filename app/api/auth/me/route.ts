import { getAuthUser } from '@/lib/auth/guards';
import { apiSuccess, ERR } from '@/lib/api/response';
import { getUserByEmail } from '@/lib/supabase/users';
import { normalizeRole, getPermissionsForRole } from '@/lib/auth/permissions';
import { logger } from '@/lib/telemetry/logger';

/**
 * GET /api/auth/me
 * Single source of truth for client auth state hydration.
 * Reads session from httpOnly cookie, fetches user from DB.
 */
export async function GET() {
  const sessionUser = await getAuthUser();

  if (!sessionUser) {
    return ERR.UNAUTHORIZED('Chưa đăng nhập');
  }

  try {
    // Fetch fresh user data from DB (source of truth for profile + role)
    const dbUser = await getUserByEmail(sessionUser.email);

    if (!dbUser) {
      logger.warn('auth.me', 'User in session but not found in DB', { email: sessionUser.email });
      return ERR.UNAUTHORIZED('Tài khoản không tồn tại');
    }

    const role = normalizeRole(dbUser.role);
    const permissions = getPermissionsForRole(role);

    return apiSuccess({
      user: {
        id: dbUser.id || '',
        email: dbUser.email,
        name: dbUser.name,
        role,
        memberLevel: dbUser.member_level || 'Free',
        phone: dbUser.phone || '',
        avatarUrl: null,
      },
      permissions,
    });
  } catch (error) {
    logger.error('auth.me', 'Failed to fetch user from DB', {
      email: sessionUser.email,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback to session data if DB is unreachable
    return apiSuccess({
      user: {
        id: '',
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
        memberLevel: sessionUser.memberLevel,
        phone: '',
        avatarUrl: null,
      },
      permissions: sessionUser.permissions,
    });
  }
}
