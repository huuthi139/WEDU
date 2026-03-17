/**
 * Centralized permission service.
 * Permissions are resolved server-side only.
 * Client receives a list of permission strings from /api/auth/me.
 */

export type Role = 'admin' | 'sub_admin' | 'instructor' | 'student' | 'user';

// Map roles to their permissions
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'profile.read', 'profile.update',
    'course.view', 'course.enroll',
    'lesson.view', 'lesson.progress.write', 'lesson.note.write',
    'review.create',
    'post.create',
    'admin.dashboard.view',
    'admin.user.manage',
    'admin.course.manage',
    'admin.lesson.manage',
    'admin.content.publish',
    'admin.staff.manage',
    'admin.order.manage',
  ],
  sub_admin: [
    'profile.read', 'profile.update',
    'course.view', 'course.enroll',
    'lesson.view', 'lesson.progress.write', 'lesson.note.write',
    'review.create',
    'post.create',
    'admin.dashboard.view',
    'admin.course.manage',
    'admin.lesson.manage',
    'admin.content.publish',
    'admin.order.manage',
  ],
  instructor: [
    'profile.read', 'profile.update',
    'course.view', 'course.enroll',
    'lesson.view', 'lesson.progress.write', 'lesson.note.write',
    'review.create',
    'post.create',
    'admin.dashboard.view',
    'admin.course.manage',
    'admin.lesson.manage',
  ],
  student: [
    'profile.read', 'profile.update',
    'course.view', 'course.enroll',
    'lesson.view', 'lesson.progress.write', 'lesson.note.write',
    'review.create',
    'post.create',
  ],
  user: [
    'profile.read', 'profile.update',
    'course.view', 'course.enroll',
    'lesson.view', 'lesson.progress.write', 'lesson.note.write',
    'review.create',
    'post.create',
  ],
};

export function getPermissionsForRole(role: string): string[] {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS.user;
}

export function hasPermission(role: string, permission: string): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role: string, permissions: string[]): boolean {
  const userPerms = getPermissionsForRole(role);
  return permissions.some(p => userPerms.includes(p));
}

export function normalizeRole(role: string | undefined): Role {
  if (!role) return 'user';
  const r = role.toLowerCase().trim();

  // Admin variants
  if (['admin', 'administrator', 'quản trị', 'quản trị viên', 'qtv'].some(v => r.includes(v)) && !r.includes('sub')) {
    return 'admin';
  }
  if (['sub_admin', 'sub-admin', 'admin phụ', 'quản lý'].some(v => r.includes(v))) {
    return 'sub_admin';
  }
  if (r === 'instructor') return 'instructor';
  if (r === 'student') return 'student';
  return 'user';
}

export function isAdminLevelRole(role: string): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'sub_admin';
}
