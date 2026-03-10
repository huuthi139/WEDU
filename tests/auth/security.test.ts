// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isBcryptHash } from '@/lib/auth/password';
import { signToken, verifyToken } from '@/lib/auth/jwt';

describe('Security Regression Tests', () => {
  it('CRITICAL: stored password is never plaintext after registration', async () => {
    const userInputPassword = 'userpassword123';
    const stored = await hashPassword(userInputPassword);
    expect(stored).not.toBe(userInputPassword);
    expect(isBcryptHash(stored)).toBe(true);
  });

  it('CRITICAL: hardcoded admin password 123456 is hashed before storage', async () => {
    const hardcoded = '123456';
    const stored = await hashPassword(hardcoded);
    expect(stored).not.toBe(hardcoded);
    expect(isBcryptHash(stored)).toBe(true);
    expect(await verifyPassword(hardcoded, stored)).toBe(true);
  });

  it('CRITICAL: JWT role cannot be forged via base64 manipulation', async () => {
    const studentToken = await signToken({
      email: 'student@test.com',
      role: 'student',
      name: 'Student',
      level: 'free',
    });
    const parts = studentToken.split('.');
    // Attacker replaces payload with admin role
    const maliciousPayload = Buffer.from(
      JSON.stringify({ email: 'student@test.com', role: 'admin', name: 'Student', level: 'free' })
    ).toString('base64url');
    const forgedToken = `${parts[0]}.${maliciousPayload}.${parts[2]}`;
    // Must throw — cannot verify with wrong signature
    await expect(verifyToken(forgedToken)).rejects.toThrow();
  });

  it('CRITICAL: expired token is rejected', async () => {
    const { SignJWT } = await import('jose');
    const expiredToken = await new SignJWT({ email: 'user@test.com', role: 'student' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // expired 1 second ago
      .sign(new TextEncoder().encode('test-secret-key-minimum-32-characters-long!!'));
    await expect(verifyToken(expiredToken)).rejects.toThrow();
  });

  it('CRITICAL: password from different user cannot authenticate another account', async () => {
    const user1Hash = await hashPassword('user1password');
    const user2Hash = await hashPassword('user2password');
    expect(await verifyPassword('user1password', user2Hash)).toBe(false);
    expect(await verifyPassword('user2password', user1Hash)).toBe(false);
  });

  it('CRITICAL: empty password is rejected', async () => {
    const hash = await hashPassword('validpassword');
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('migration: plaintext password is successfully verified then upgradeable', async () => {
    const storedPlaintext = 'oldpassword'; // legacy user not yet migrated
    const inputPassword = 'oldpassword';
    // Verify succeeds with plaintext
    expect(await verifyPassword(inputPassword, storedPlaintext)).toBe(true);
    // Upgrade: hash it
    const newHash = await hashPassword(inputPassword);
    expect(isBcryptHash(newHash)).toBe(true);
    // Verify succeeds with new hash
    expect(await verifyPassword(inputPassword, newHash)).toBe(true);
  });
});
