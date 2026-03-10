import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface WePowerJWTPayload extends JWTPayload {
  email: string;
  role: string;
  name: string;
  level: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set and >= 32 chars');
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: Pick<WePowerJWTPayload, 'email' | 'role' | 'name' | 'level'>): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<WePowerJWTPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as WePowerJWTPayload;
}
