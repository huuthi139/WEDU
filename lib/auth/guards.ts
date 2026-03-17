/**
 * Server-side auth guards for route handlers and server components.
 */
import { getSession, SESSION_COOKIE } from './session';
import { hasPermission, isAdminLevelRole, normalizeRole, getPermissionsForRole } from './permissions';
import type { WeduJWTPayload } from './jwt';
import { cookies } from 'next/headers';

export interface AuthUser {
  email: string;
  name: string;
  role: string;
  memberLevel: string;
  permissions: string[];
}

/**
 * Get the authenticated user from the session cookie.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const role = normalizeRole(session.role);
  return {
    email: session.email,
    name: session.name,
    role,
    memberLevel: session.level || 'Free',
    permissions: getPermissionsForRole(role),
  };
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new AuthError('AUTH_UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục', 401);
  }
  return user;
}

/**
 * Require a specific permission. Throws if not authenticated or lacking permission.
 */
export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    throw new AuthError('AUTH_FORBIDDEN', 'Bạn không có quyền thực hiện hành động này', 403);
  }
  return user;
}

/**
 * Require admin-level access (admin or sub_admin).
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!isAdminLevelRole(user.role)) {
    throw new AuthError('AUTH_FORBIDDEN', 'Chỉ admin mới có quyền truy cập', 403);
  }
  return user;
}

/**
 * Check if there's a valid session cookie (lightweight check for middleware).
 */
export async function hasValidSessionCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return !!token;
  } catch {
    return false;
  }
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
