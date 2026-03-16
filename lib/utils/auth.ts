export type UserRole = 'admin' | 'sub_admin' | 'instructor' | 'student' | 'user';

/** All roles that have admin-level access */
const ADMIN_ROLES = ['admin', 'administrator', 'quản trị', 'quản trị viên', 'qtv'];
const SUB_ADMIN_ROLES = ['sub_admin', 'sub-admin', 'admin phụ', 'quản lý'];

export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return ADMIN_ROLES.some(v => normalized.includes(v));
}

/** Check if user has sub-admin role */
export function isSubAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return SUB_ADMIN_ROLES.some(v => normalized.includes(v));
}

/** Check if user has any admin-level access (admin or sub_admin) */
export function hasAdminAccess(role: string | undefined): boolean {
  return isAdminRole(role) || isSubAdminRole(role);
}

export function isInstructorRole(role: string | undefined): boolean {
  if (!role) return false;
  return role === 'instructor' || isAdminRole(role) || isSubAdminRole(role);
}

/** Get human-readable role label in Vietnamese */
export function getRoleLabel(role: string | undefined): string {
  if (!role) return 'Học viên';
  switch (role.toLowerCase().trim()) {
    case 'admin': return 'Admin';
    case 'sub_admin': return 'Admin phụ';
    case 'instructor': return 'Giảng viên';
    default: return 'Học viên';
  }
}

/** Available roles for assignment by admin */
export const ASSIGNABLE_ROLES = [
  { value: 'user', label: 'Học viên' },
  { value: 'sub_admin', label: 'Admin phụ' },
  { value: 'instructor', label: 'Giảng viên' },
] as const;

export const DEMO_USERS = [
  {
    email: 'admin@wedu.vn',
    plainPassword: '123456',
    role: 'admin',
    name: 'Admin WEDU',
    memberLevel: 'VIP',
    phone: '',
  },
] as const;
