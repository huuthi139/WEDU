// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '@/lib/auth/jwt';

const mockUser = {
  email: 'test@wepower.vn',
  role: 'student',
  name: 'Test User',
  level: 'free',
};

describe('JWT Utilities', () => {
  it('signToken returns a valid JWT string', async () => {
    const token = await signToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('verifyToken decodes correct payload', async () => {
    const token = await signToken(mockUser);
    const payload = await verifyToken(token);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.role).toBe(mockUser.role);
    expect(payload.name).toBe(mockUser.name);
    expect(payload.level).toBe(mockUser.level);
  });

  it('verifyToken rejects tampered token', async () => {
    const token = await signToken(mockUser);
    const tampered = token.slice(0, -5) + 'XXXXX';
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it('verifyToken rejects token signed with wrong secret', async () => {
    const { SignJWT } = await import('jose');
    const fakeToken = await new SignJWT({ email: 'hacker@evil.com', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode('wrong-secret-key-minimum-32-chars!!'));
    await expect(verifyToken(fakeToken)).rejects.toThrow();
  });

  it('admin token contains admin role', async () => {
    const adminToken = await signToken({ ...mockUser, role: 'admin' });
    const payload = await verifyToken(adminToken);
    expect(payload.role).toBe('admin');
  });

  it('token cannot be used to forge admin role via base64 decode', async () => {
    const token = await signToken(mockUser);
    const parts = token.split('.');
    const fakePayload = Buffer.from(JSON.stringify({ email: 'hacker@evil.com', role: 'admin' })).toString('base64url');
    const forgedToken = `${parts[0]}.${fakePayload}.${parts[2]}`;
    await expect(verifyToken(forgedToken)).rejects.toThrow();
  });
});
