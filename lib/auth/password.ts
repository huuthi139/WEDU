import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plaintext, stored);
  }
  return plaintext === stored; // legacy plaintext — migration support
}

export function isBcryptHash(value: string): boolean {
  return typeof value === 'string' && value.startsWith('$2');
}
