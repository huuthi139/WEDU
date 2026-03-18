/**
 * DEPRECATED: Use CourseAccessContext instead.
 * This file re-exports from CourseAccessContext for backward compatibility.
 */
'use client';

export {
  CourseAccessProvider as EnrollmentProvider,
  useCourseAccess as useEnrollment,
  type LegacyEnrollment as Enrollment,
  type LegacyOrder as Order,
} from './CourseAccessContext';
