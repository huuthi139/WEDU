import { NextRequest } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getUserByEmail } from '@/lib/supabase/users';

interface JWTPayloadShape {
  email?: string;
  role?: string;
  userId?: string;
}

async function decodeToken(request: NextRequest): Promise<JWTPayloadShape | null> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return null;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return null;
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as JWTPayloadShape;
  } catch {
    return null;
  }
}

/**
 * Verify admin access from JWT cookie.
 */
export async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string; userEmail?: string }> {
  const payload = await decodeToken(request);
  if (!payload) return { isAdmin: false };
  const role = payload.role || '';
  // Look up DB user to get UUID
  let userId = payload.userId;
  if (!userId && payload.email) {
    const dbUser = await getUserByEmail(payload.email);
    userId = dbUser?.id;
  }
  return { isAdmin: hasAdminAccess(role), userId, userEmail: payload.email };
}

/**
 * Verify any authenticated user from JWT cookie.
 * Resolves the DB user ID from email.
 */
export async function verifyAuth(request: NextRequest): Promise<{ authenticated: boolean; userId?: string; userEmail?: string; role?: string }> {
  const payload = await decodeToken(request);
  if (!payload?.email) return { authenticated: false };
  const dbUser = await getUserByEmail(payload.email);
  return {
    authenticated: true,
    userId: dbUser?.id || payload.userId,
    userEmail: payload.email,
    role: payload.role || 'user',
  };
}
