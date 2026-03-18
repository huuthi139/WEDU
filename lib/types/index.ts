/**
 * WEDU Platform - Centralized Type Definitions
 * Phase 4: Restructured with proper access model
 */

// =============================================
// ENUMS / CONSTANTS
// =============================================

/** System-level role for admin/management */
export type SystemRole = 'admin' | 'instructor' | 'student';

/** Per-course access tier */
export type AccessTier = 'free' | 'premium' | 'vip';

/** Lesson content type */
export type LessonType = 'video' | 'text' | 'pdf' | 'audio' | 'quiz' | 'live' | 'replay';

/** Course access source */
export type AccessSource = 'manual' | 'order' | 'gift' | 'admin' | 'scholarship' | 'system';

/** Course access status */
export type AccessStatus = 'active' | 'expired' | 'cancelled';

// Legacy types kept for backward compatibility during migration
export type MemberLevel = 'Free' | 'Premium' | 'VIP';
export type UserRole = 'admin' | 'sub_admin' | 'instructor' | 'student' | 'user';
export type EnrollmentStatus = 'active' | 'paused' | 'completed';
export type OrderStatus = 'Đang chờ xử lý' | 'Đang xử lý' | 'Hoàn thành' | 'Đã hủy';
export type CourseBadge = 'NEW' | 'BESTSELLER' | 'PREMIUM' | 'Hot';

// =============================================
// PROFILE (maps to public.users)
// =============================================

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  system_role: SystemRole;
  member_level: MemberLevel;
  avatar_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Profile without sensitive fields (for frontend) */
export interface ProfilePublic {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  systemRole: SystemRole;
  memberLevel: MemberLevel;
  avatarUrl: string | null;
}

// =============================================
// COURSE (maps to public.courses)
// =============================================

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  instructor: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  enrollmentsCount: number;
  duration: number;
  lessonsCount: number;
  isFree: boolean;
  badge?: CourseBadge | string;
  memberLevel: MemberLevel;
  slug?: string;
  isActive?: boolean;
  isPublished?: boolean;
  progress?: number;
}

/** Row shape from Supabase courses table */
export interface CourseRow {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  instructor: string;
  category: string;
  price: number;
  original_price: number | null;
  rating: number;
  reviews_count: number;
  enrollments_count: number;
  duration: number;
  lessons_count: number;
  badge: string | null;
  member_level: string;
  slug: string | null;
  is_active: boolean;
  is_published: boolean | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// COURSE CHAPTER (maps to public.course_chapters)
// =============================================

export interface CourseChapter {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  sessions?: CourseSession[];
}

export interface CourseChapterRow {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// =============================================
// COURSE SESSION (maps to public.course_sessions)
// =============================================

export interface CourseSession {
  id: string;
  courseId: string;
  chapterId: string;
  title: string;
  description: string;
  sortOrder: number;
  lessons?: LessonFrontend[];
}

export interface CourseSessionRow {
  id: string;
  course_id: string;
  chapter_id: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// =============================================
// COURSE SECTION (legacy - maps to public.course_sections)
// Kept for backward compatibility
// =============================================

export interface CourseSection {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  lessons?: Lesson[];
}

export interface CourseSectionRow {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// =============================================
// LESSON (maps to public.lessons)
// =============================================

/** Frontend lesson shape with new access_tier */
export interface LessonFrontend {
  id: string;
  courseId: string;
  chapterId: string | null;
  sessionId: string | null;
  title: string;
  slug: string;
  lessonType: LessonType;
  accessTier: AccessTier;
  summary: string;
  content: string;
  videoId: string;
  videoUrl: string;
  directPlayUrl: string;
  durationSeconds: number;
  duration: string;
  sortOrder: number;
  status: string;
}

/** Legacy lesson interface (backward compat) */
export interface Lesson {
  id: string;
  courseId: string;
  sectionId: string | null;
  title: string;
  description: string;
  duration: string;
  durationSeconds: number;
  videoUrl: string;
  directPlayUrl: string;
  isPreview: boolean;
  sortOrder: number;
}

export interface LessonRow {
  id: string;
  course_id: string;
  section_id: string | null;
  chapter_id: string | null;
  session_id: string | null;
  title: string;
  description: string;
  slug: string;
  lesson_type: string;
  access_tier: string;
  summary: string;
  content: string;
  video_id: string;
  video_url: string;
  direct_play_url: string;
  duration: string;
  duration_seconds: number;
  is_preview: boolean;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// LESSON RESOURCE (maps to public.lesson_resources)
// =============================================

export interface LessonResource {
  id: string;
  lessonId: string;
  title: string;
  resourceType: string;
  url: string;
  fileSize: number;
}

export interface LessonResourceRow {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  url: string;
  file_size: number;
  sort_order: number;
  created_at: string;
}

// =============================================
// COURSE ACCESS (maps to public.course_access)
// Per-course access control - replaces enrollment-based access
// =============================================

export interface CourseAccess {
  id: string;
  userId: string;
  courseId: string;
  accessTier: AccessTier;
  source: AccessSource;
  status: AccessStatus;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CourseAccessRow {
  id: string;
  user_id: string;
  course_id: string;
  access_tier: string;
  source: string;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// ENROLLMENT (legacy - maps to public.enrollments)
// Kept for backward compatibility
// =============================================

export interface Enrollment {
  courseId: string;
  enrolledAt: string;
  progress: number;
  completedLessons: string[];
  lastAccessedAt: string;
}

export interface EnrollmentRow {
  id: string;
  user_email: string;
  course_id: string;
  enrolled_at: string;
  progress: number;
  completed_lessons: string[];
  last_accessed_at: string;
}

// =============================================
// COURSE ENROLLMENT (legacy - maps to public.course_enrollments)
// =============================================

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
}

export interface CourseEnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  updated_at: string;
}

// =============================================
// LESSON PROGRESS (maps to public.lesson_progress)
// =============================================

export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number;
  percentComplete: number;
  isCompleted: boolean;
  firstStartedAt: string;
  lastOpenedAt: string;
  completedAt: string | null;
  version: number;
}

export interface LessonProgressRow {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  position_seconds: number;
  duration_seconds: number;
  percent_complete: number;
  is_completed: boolean;
  first_started_at: string;
  last_opened_at: string;
  completed_at: string | null;
  updated_at: string;
  device_id: string | null;
  version: number;
}

// =============================================
// COURSE PROGRESS (maps to public.course_progress)
// =============================================

export interface CourseProgress {
  id: string;
  userId: string;
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  lastLessonId: string | null;
  lastPositionSeconds: number;
}

export interface CourseProgressRow {
  id: string;
  user_id: string;
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  percent_complete: number;
  last_lesson_id: string | null;
  last_position_seconds: number;
  updated_at: string;
}

// =============================================
// ORDER (maps to public.orders)
// =============================================

export interface Order {
  id: string;
  orderId: string;
  userEmail: string;
  userName: string;
  userPhone: string;
  courseNames: string;
  courseIds: string;
  total: number;
  paymentMethod: string;
  status: string;
  note: string;
  createdAt: string;
}

export interface OrderRow {
  id: string;
  order_id: string;
  user_email: string;
  user_name: string;
  user_phone: string;
  course_names: string;
  course_ids: string;
  total: number;
  payment_method: string;
  status: string;
  note: string;
  created_at: string;
}

// =============================================
// ORDER ITEM (maps to public.order_items)
// =============================================

export interface OrderItem {
  id: string;
  orderId: string;
  courseId: string;
  courseTitle: string;
  accessTier: AccessTier;
  price: number;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  course_id: string;
  course_title: string;
  access_tier: string;
  price: number;
  created_at: string;
}

// =============================================
// REVIEW (maps to public.reviews)
// =============================================

export interface Review {
  id: string;
  courseId: string;
  userEmail: string;
  userName: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface ReviewRow {
  id: string;
  course_id: string;
  user_email: string;
  user_name: string;
  rating: number;
  content: string;
  created_at: string;
}

// =============================================
// CHAPTER (legacy JSONB format from public.chapters)
// =============================================

export interface ChapterLesson {
  id: string;
  title: string;
  duration: string;
  directPlayUrl?: string;
  isPreview?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: ChapterLesson[];
}

// =============================================
// ACCESS TIER HELPERS
// =============================================

const ACCESS_TIER_RANK: Record<AccessTier, number> = {
  free: 0,
  premium: 1,
  vip: 2,
};

/** Check if a given access tier meets the required tier */
export function meetsAccessTier(userTier: AccessTier | undefined, requiredTier: AccessTier): boolean {
  if (requiredTier === 'free') return true;
  if (!userTier) return false;
  return ACCESS_TIER_RANK[userTier] >= ACCESS_TIER_RANK[requiredTier];
}

/** Convert legacy MemberLevel to AccessTier */
export function memberLevelToAccessTier(level: MemberLevel | string): AccessTier {
  switch (level) {
    case 'VIP': return 'vip';
    case 'Premium': return 'premium';
    default: return 'free';
  }
}

/** Convert AccessTier to display label */
export function accessTierLabel(tier: AccessTier): string {
  switch (tier) {
    case 'vip': return 'VIP';
    case 'premium': return 'Premium';
    default: return 'Free';
  }
}

// =============================================
// MAPPERS: Convert between DB row and frontend shape
// =============================================

export function courseRowToFrontend(row: CourseRow): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    thumbnail: row.thumbnail || '',
    instructor: row.instructor || 'WePower Academy',
    category: row.category || '',
    price: Number(row.price) || 0,
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    rating: Number(row.rating) || 0,
    reviewsCount: row.reviews_count || 0,
    enrollmentsCount: row.enrollments_count || 0,
    duration: row.duration || 0,
    lessonsCount: row.lessons_count || 0,
    isFree: Number(row.price) === 0,
    badge: (row.badge as CourseBadge) || undefined,
    memberLevel: (row.member_level as MemberLevel) || 'Free',
    slug: row.slug || undefined,
    isActive: row.is_active,
    isPublished: row.is_published ?? true,
  };
}

export function profileRowToPublic(row: Profile): ProfilePublic {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || '',
    role: row.role,
    systemRole: row.system_role || 'student',
    memberLevel: row.member_level,
    avatarUrl: row.avatar_url || null,
  };
}

export function courseAccessRowToFrontend(row: CourseAccessRow): CourseAccess {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    accessTier: row.access_tier as AccessTier,
    source: row.source as AccessSource,
    status: row.status as AccessStatus,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function lessonRowToFrontend(row: LessonRow): LessonFrontend {
  return {
    id: row.id,
    courseId: row.course_id,
    chapterId: row.chapter_id,
    sessionId: row.session_id,
    title: row.title,
    slug: row.slug || '',
    lessonType: (row.lesson_type || 'video') as LessonType,
    accessTier: (row.access_tier || 'free') as AccessTier,
    summary: row.summary || '',
    content: row.content || '',
    videoId: row.video_id || '',
    videoUrl: row.video_url || '',
    directPlayUrl: row.direct_play_url || '',
    durationSeconds: row.duration_seconds || 0,
    duration: row.duration || '',
    sortOrder: row.sort_order || 0,
    status: row.status || 'published',
  };
}

/** Legacy mapper - kept for backward compatibility */
export function enrollmentRowToFrontend(row: EnrollmentRow): Enrollment {
  return {
    courseId: row.course_id,
    enrolledAt: row.enrolled_at,
    progress: row.progress || 0,
    completedLessons: Array.isArray(row.completed_lessons) ? row.completed_lessons : [],
    lastAccessedAt: row.last_accessed_at,
  };
}
