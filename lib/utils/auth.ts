export type UserRole = 'admin' | 'instructor' | 'student' | 'user';

export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  const adminValues = ['admin', 'administrator', 'quản trị', 'quản trị viên', 'qtv'];
  return adminValues.some(v => normalized.includes(v));
}

export function isInstructorRole(role: string | undefined): boolean {
  if (!role) return false;
  return role === 'instructor' || role === 'admin';
}

export const DEMO_USERS = [
  {
    email: 'admin@wepower.vn',
    plainPassword: '123456',
    role: 'admin',
    name: 'Admin WePower',
    memberLevel: 'VIP',
    phone: '',
  },
] as const;
