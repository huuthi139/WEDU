import { getAuthUser } from '@/lib/auth/guards';
import { apiSuccess, ERR } from '@/lib/api/response';
import { getUserByEmail, createUserProfile } from '@/lib/supabase/users';
import { normalizeRole, getPermissionsForRole } from '@/lib/auth/permissions';
import { logger } from '@/lib/telemetry/logger';
import { LOCKED_PASSWORD_SENTINEL } from '@/lib/auth/password';

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
      // Auto-create profile if user has a valid session but no DB record
      // This ensures signup → profile flow is always safe
      logger.warn('auth.me', 'User in session but not in DB, auto-creating profile', { email: sessionUser.email });
      try {
        const created = await createUserProfile({
          email: sessionUser.email,
          name: sessionUser.name || '',
          phone: '',
          passwordHash: LOCKED_PASSWORD_SENTINEL, // Account locked until user sets a real password
          role: sessionUser.role || 'user',
          memberLevel: sessionUser.memberLevel || 'Free',
        });
        const role = normalizeRole(created.role);
        const permissions = getPermissionsForRole(role);
        return apiSuccess({
          user: {
            id: created.id || '',
            email: created.email,
            name: created.name,
            role,
            systemRole: 'student',
            memberLevel: created.member_level || 'Free',
            phone: created.phone || '',
            avatarUrl: null,
          },
          permissions,
        });
      } catch (createErr) {
        logger.error('auth.me', 'Auto-create profile failed', {
          email: sessionUser.email,
          error: createErr instanceof Error ? createErr.message : String(createErr),
        });
        // Fallback to session data if auto-create fails
        return apiSuccess({
          user: {
            id: '',
            email: sessionUser.email,
            name: sessionUser.name,
            role: sessionUser.role,
            systemRole: 'student',
            memberLevel: sessionUser.memberLevel,
            phone: '',
            avatarUrl: null,
          },
          permissions: sessionUser.permissions,
        });
      }
    }

    const role = normalizeRole(dbUser.role);
    const permissions = getPermissionsForRole(role);

    // Derive systemRole from role/system_role
    let systemRole = dbUser.system_role || 'student';
    if (!dbUser.system_role) {
      if (role === 'admin' || role === 'sub_admin') systemRole = 'admin';
      else if (role === 'instructor') systemRole = 'instructor';
      else systemRole = 'student';
    }

    return apiSuccess({
      user: {
        id: dbUser.id || '',
        email: dbUser.email,
        name: dbUser.name,
        role,
        systemRole,
        memberLevel: dbUser.member_level || 'Free',
        phone: dbUser.phone || '',
        avatarUrl: dbUser.avatar_url || null,
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
