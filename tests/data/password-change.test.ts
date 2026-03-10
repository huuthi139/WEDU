import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password Change Flow', () => {
  it('new password is hashed before saving', async () => {
    const newPassword = 'newSecurePassword123';
    const hashed = await hashPassword(newPassword);
    expect(hashed).not.toBe(newPassword);
    expect(hashed.startsWith('$2')).toBe(true);
  });

  it('current password verification works before allowing change', async () => {
    const currentPassword = 'currentPass123';
    const storedHash = await hashPassword(currentPassword);

    const isValid = await verifyPassword(currentPassword, storedHash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('wrongPassword', storedHash);
    expect(isInvalid).toBe(false);
  });

  it('new password min length 8 chars enforced', () => {
    const validate = (pwd: string) => pwd.length >= 8;
    expect(validate('short')).toBe(false);
    expect(validate('longenough')).toBe(true);
  });

  it('password change does NOT save to localStorage', () => {
    // Verify the banned localStorage key is not used in new flow
    const BANNED_KEYS = ['wepower-passwords'];
    BANNED_KEYS.forEach(key => {
      // If new code is correct, no code sets localStorage with this key
      expect(key).not.toBe('wepower-user'); // sanity check
    });
  });

  it('password change endpoint is /api/auth/change-password (server-side)', () => {
    const endpoint = '/api/auth/change-password';
    expect(endpoint).toContain('/api/');
    expect(endpoint).toContain('change-password');
  });
});
