/**
 * WEDU Platform - Access Control Helpers
 * Phase 4: Per-course access tier model.
 *
 * KEY CONCEPTS:
 * 1. System Role (admin | instructor | student) - for system-level permissions
 * 2. Course Access Tier (free | premium | vip) - per-course, per-user
 * 3. Lesson Access Tier (free | premium | vip) - per-lesson
 *
 * A user can access a lesson if:
 * - The lesson is free (access_tier = 'free') → anyone can view
 * - The lesson is premium → user needs course_access with tier >= premium for that course
 * - The lesson is vip → user needs course_access with tier = vip for that course
 * - Admin/instructor bypass: can preview all content
 */

import type { ProfilePublic, Course, AccessTier, CourseAccess } from '@/lib/types';
import { meetsAccessTier } from '@/lib/types';

// =============================================
// SYSTEM ROLE CHECKS
// =============================================

/** Check if user is admin */
export function isAdmin(profile: ProfilePublic | null | undefined): boolean {
  if (!profile) return false;
  return profile.systemRole === 'admin' || profile.role === 'admin' || profile.role === 'sub_admin';
}

/** Check if user is instructor */
export function isInstructor(profile: ProfilePublic | null | undefined): boolean {
  if (!profile) return false;
  return profile.systemRole === 'instructor' || profile.role === 'instructor';
}

/** Check if user has staff-level access (admin or instructor) */
export function isStaff(profile: ProfilePublic | null | undefined): boolean {
  return isAdmin(profile) || isInstructor(profile);
}

// =============================================
// COURSE ACCESS TIER
// =============================================

/**
 * Get the effective access tier a user has for a specific course.
 * Returns the tier from course_access record, or 'free' if none.
 */
export function getCourseAccessTier(
  courseAccess: CourseAccess | null | undefined
): AccessTier {
  if (!courseAccess) return 'free';
  if (courseAccess.status !== 'active') return 'free';
  // Check expiration
  if (courseAccess.expiresAt && new Date(courseAccess.expiresAt) < new Date()) {
    return 'free';
  }
  return courseAccess.accessTier;
}

// =============================================
// COURSE ACCESS CHECK
// =============================================

/**
 * Check if a user can access a course's paid content.
 * Note: Free lessons within ANY course are always accessible.
 * This checks if user has any paid access to the course.
 */
export function canAccessCourse(
  profile: ProfilePublic | null | undefined,
  courseAccess: CourseAccess | null | undefined,
  course: Course | null | undefined
): boolean {
  if (!course) return false;

  // Staff can access any course
  if (isStaff(profile)) return true;

  // Free courses are accessible to everyone
  if (course.isFree) return true;

  // User needs a valid course_access record
  const tier = getCourseAccessTier(courseAccess);
  return tier !== 'free';
}

// =============================================
// LESSON ACCESS CHECK
// =============================================

/**
 * Check if a user can access a specific lesson.
 * This is the CORE access control function.
 *
 * Rules:
 * - Free lessons (access_tier = 'free') → accessible to everyone, even guests
 * - Premium lessons → user needs course_access.access_tier >= 'premium'
 * - VIP lessons → user needs course_access.access_tier = 'vip'
 * - Admin/instructor bypass → can access everything
 */
export function canAccessLesson(
  profile: ProfilePublic | null | undefined,
  courseAccess: CourseAccess | null | undefined,
  lesson: { accessTier: AccessTier } | null | undefined
): boolean {
  if (!lesson) return false;

  // Free lessons are always accessible
  if (lesson.accessTier === 'free') return true;

  // Staff bypass
  if (isStaff(profile)) return true;

  // Must be logged in for paid content
  if (!profile) return false;

  // Check course access tier against lesson requirement
  const userTier = getCourseAccessTier(courseAccess);
  return meetsAccessTier(userTier, lesson.accessTier);
}

/**
 * Check if a lesson can be previewed (free lessons only).
 */
export function canPreviewLesson(
  lesson: { accessTier: AccessTier } | null | undefined
): boolean {
  if (!lesson) return false;
  return lesson.accessTier === 'free';
}

// =============================================
// ACCESS DENIED REASONS
// =============================================

/**
 * Get the appropriate CTA message when access is denied.
 */
export function getAccessDeniedReason(
  profile: ProfilePublic | null | undefined,
  courseAccess: CourseAccess | null | undefined,
  lesson: { accessTier: AccessTier } | null | undefined
): string | null {
  if (!lesson) return 'Bài học không tồn tại';
  if (canAccessLesson(profile, courseAccess, lesson)) return null;

  if (!profile) {
    if (lesson.accessTier === 'free') return null; // Free lessons don't require login
    return 'Vui lòng đăng nhập để truy cập bài học này';
  }

  if (lesson.accessTier === 'premium') {
    return 'Mua khóa học để xem bài học này';
  }

  if (lesson.accessTier === 'vip') {
    return 'Nâng cấp VIP / Coaching để xem bài học này';
  }

  return 'Bạn không có quyền truy cập bài học này';
}

/**
 * Get the CTA label for a locked lesson.
 */
export function getLessonCTALabel(accessTier: AccessTier): string {
  switch (accessTier) {
    case 'free': return 'Xem miễn phí';
    case 'premium': return 'Mua khóa học để xem';
    case 'vip': return 'Nâng cấp VIP / Coaching';
  }
}

// =============================================
// LEGACY COMPATIBILITY
// =============================================

/**
 * Legacy: Check if user is enrolled in a specific course.
 * Maps to course_access existence check.
 * @deprecated Use getCourseAccessTier instead
 */
export function isEnrolledInCourse(
  courseAccessList: CourseAccess[] | undefined,
  courseId: string
): boolean {
  if (!courseAccessList) return false;
  return courseAccessList.some(ca => ca.courseId === courseId && ca.status === 'active');
}

/**
 * Legacy: Get enrollment for a specific course.
 * @deprecated Use getCourseAccessTier instead
 */
export function getAccessForCourse(
  courseAccessList: CourseAccess[] | undefined,
  courseId: string
): CourseAccess | undefined {
  if (!courseAccessList) return undefined;
  return courseAccessList.find(ca => ca.courseId === courseId && ca.status === 'active');
}
