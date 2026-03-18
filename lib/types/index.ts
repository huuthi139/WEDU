/**
 * WEDU Platform - Centralized Type Definitions
 * All entity types aligned with Supabase schema.
 */

// =============================================
// ENUMS / CONSTANTS
// =============================================

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
  member_level: MemberLevel;
  avatar_url: string | null;
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
// COURSE SECTION (maps to public.course_sections)
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
  title: string;
  description: string;
  duration: string;
  duration_seconds: number;
  video_url: string;
  direct_play_url: string;
  is_preview: boolean;
  sort_order: number;
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
  created_at: string;
}

// =============================================
// ENROLLMENT (maps to public.enrollments)
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
// COURSE ENROLLMENT (maps to public.course_enrollments)
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
  price: number;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  course_id: string;
  course_title: string;
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
// MAPPERS: Convert between DB row and frontend shape
// =============================================

export function courseRowToFrontend(row: CourseRow): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    thumbnail: row.thumbnail || '',
    instructor: row.instructor || 'WEDU',
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
    memberLevel: row.member_level,
    avatarUrl: row.avatar_url || null,
  };
}

export function enrollmentRowToFrontend(row: EnrollmentRow): Enrollment {
  return {
    courseId: row.course_id,
    enrolledAt: row.enrolled_at,
    progress: row.progress || 0,
    completedLessons: Array.isArray(row.completed_lessons) ? row.completed_lessons : [],
    lastAccessedAt: row.last_accessed_at,
  };
}
