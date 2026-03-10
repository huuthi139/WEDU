// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isBcryptHash } from '@/lib/auth/password';

describe('Password Utilities', () => {
  it('hashPassword returns bcrypt hash', async () => {
    const hash = await hashPassword('mypassword123');
    expect(isBcryptHash(hash)).toBe(true);
    expect(hash).not.toBe('mypassword123');
  });

  it('verifyPassword succeeds with correct password against bcrypt hash', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword('correctpassword', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword fails with wrong password against bcrypt hash', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword('wrongpassword', hash);
    expect(result).toBe(false);
  });

  it('verifyPassword supports legacy plaintext (migration mode)', async () => {
    const result = await verifyPassword('plaintextpass', 'plaintextpass');
    expect(result).toBe(true);
  });

  it('verifyPassword rejects wrong plaintext (migration mode)', async () => {
    const result = await verifyPassword('wrongpass', 'plaintextpass');
    expect(result).toBe(false);
  });

  it('isBcryptHash detects bcrypt hashes correctly', async () => {
    const hash = await hashPassword('test');
    expect(isBcryptHash(hash)).toBe(true);
    expect(isBcryptHash('plaintext')).toBe(false);
    expect(isBcryptHash('123456')).toBe(false);
    expect(isBcryptHash('')).toBe(false);
  });

  it('hashPassword produces different hashes for same input (salting)', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toBe(hash2); // different because of different salts
    expect(await verifyPassword('samepassword', hash1)).toBe(true);
    expect(await verifyPassword('samepassword', hash2)).toBe(true);
  });
});
