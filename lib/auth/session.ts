import { cookies } from 'next/headers';
import { signToken, verifyToken, type WeduJWTPayload } from './jwt';

export const SESSION_COOKIE = 'wedu-token';

export async function createSession(user: { userId: string; email: string; role: string; name: string; level: string }): Promise<void> {
  const token = await signToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function getSession(): Promise<WeduJWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
