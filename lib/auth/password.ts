import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Sentinel value stored in password_hash for imported users who have not
 * yet activated their account.  It is deliberately NOT a valid bcrypt hash
 * so `verifyPassword` will always return false and the account cannot be
 * logged into until the user sets a real password via the reset-password flow.
 */
export const LOCKED_PASSWORD_SENTINEL = '!IMPORTED_LOCKED';

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  if (isLockedPassword(stored)) return false;
  if (!isBcryptHash(stored)) return false;
  return bcrypt.compare(plaintext, stored);
}

export function isBcryptHash(value: string): boolean {
  return typeof value === 'string' && value.startsWith('$2');
}

/** Returns true when the account has never had a real password set. */
export function isLockedPassword(hash: string): boolean {
  return !hash || hash === LOCKED_PASSWORD_SENTINEL;
}
