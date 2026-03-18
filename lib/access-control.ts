/**
 * WEDU Platform - Access Control Helpers
 * Reusable functions for checking user permissions on frontend and backend.
 */

import type { ProfilePublic, Course, Enrollment, MemberLevel } from '@/lib/types';

// =============================================
// ROLE CHECKS
// =============================================

/** Check if user is admin or sub_admin */
export function isAdmin(profile: ProfilePublic | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'admin' || profile.role === 'sub_admin';
}

/** Check if user is instructor */
export function isInstructor(profile: ProfilePublic | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'instructor';
}

/** Check if user has admin-level access (admin, sub_admin, or instructor) */
export function isStaff(profile: ProfilePublic | null | undefined): boolean {
  return isAdmin(profile) || isInstructor(profile);
}

// =============================================
// MEMBER LEVEL CHECKS
// =============================================

const LEVEL_RANK: Record<MemberLevel, number> = {
  Free: 0,
  Premium: 1,
  VIP: 2,
};

/** Check if user's member level meets the required level */
export function meetsLevelRequirement(
  userLevel: MemberLevel | undefined,
  requiredLevel: MemberLevel | undefined
): boolean {
  if (!requiredLevel || requiredLevel === 'Free') return true;
  if (!userLevel) return false;
  return LEVEL_RANK[userLevel] >= LEVEL_RANK[requiredLevel];
}

// =============================================
// COURSE ACCESS
// =============================================

/** Check if user can access a course (view lessons) */
export function canAccessCourse(
  profile: ProfilePublic | null | undefined,
  enrollment: Enrollment | null | undefined,
  course: Course | null | undefined
): boolean {
  if (!course) return false;

  // Admins and instructors can access any course
  if (isStaff(profile)) return true;

  // Free courses are accessible to everyone who is logged in
  if (course.isFree && profile) return true;

  // User must be enrolled
  if (enrollment) return true;

  return false;
}

/** Check if user can access a specific lesson */
export function canAccessLesson(
  profile: ProfilePublic | null | undefined,
  enrollment: Enrollment | null | undefined,
  course: Course | null | undefined,
  lesson: { isPreview?: boolean } | null | undefined
): boolean {
  // Preview lessons are always accessible
  if (lesson?.isPreview) return true;

  // Otherwise, check course access
  return canAccessCourse(profile, enrollment, course);
}

/** Get the reason why access is denied */
export function getAccessDeniedReason(
  profile: ProfilePublic | null | undefined,
  enrollment: Enrollment | null | undefined,
  course: Course | null | undefined
): string | null {
  if (!course) return 'Khóa học không tồn tại';
  if (canAccessCourse(profile, enrollment, course)) return null;

  if (!profile) return 'Vui lòng đăng nhập để truy cập khóa học';

  if (!enrollment) {
    if (course.price > 0) {
      return 'Bạn cần đăng ký khóa học này để truy cập nội dung';
    }
    return 'Bạn cần ghi danh khóa học này';
  }

  return 'Bạn không có quyền truy cập khóa học này';
}

// =============================================
// ENROLLMENT CHECKS
// =============================================

/** Check if user is enrolled in a specific course */
export function isEnrolledInCourse(
  enrollments: Enrollment[] | undefined,
  courseId: string
): boolean {
  if (!enrollments) return false;
  return enrollments.some(e => e.courseId === courseId);
}

/** Get enrollment for a specific course */
export function getEnrollmentForCourse(
  enrollments: Enrollment[] | undefined,
  courseId: string
): Enrollment | undefined {
  if (!enrollments) return undefined;
  return enrollments.find(e => e.courseId === courseId);
}
