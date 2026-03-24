/**
 * Supabase course data operations
 * Handles course CRUD in Supabase (courses table)
 */
import { getSupabaseAdmin } from './client';

export interface SupabaseCourse {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  instructor: string;
  category: string;
  price: number;
  original_price?: number;
  rating: number;
  reviews_count: number;
  enrollments_count: number;
  duration: number;
  lessons_count: number;
  badge?: string;
  member_level: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all active courses from Supabase
 * Computes enrollments_count from course_access (not the stale column in courses table)
 */
export async function getAllCourses(): Promise<SupabaseCourse[]> {
  const supabase = getSupabaseAdmin();

  const [coursesRes, accessRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, description, thumbnail, instructor, category, price, original_price, rating, reviews_count, duration, lessons_count, badge, member_level, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('course_access')
      .select('id, course_id')
      .eq('status', 'active'),
  ]);

  if (coursesRes.error) {
    console.error('[Supabase Courses] Failed to fetch:', coursesRes.error.message);
    throw new Error(`Supabase query failed: ${coursesRes.error.message}`);
  }

  // Build student count map from course_access
  const studentCountMap: Record<string, number> = {};
  const accessRows = accessRes.data || [];
  if (accessRes.error) {
    console.warn('[Courses] course_access query error:', accessRes.error.message);
  }
  for (const row of accessRows) {
    const courseId = row.course_id;
    if (courseId) {
      studentCountMap[courseId] = (studentCountMap[courseId] || 0) + 1;
    }
  }

  console.log(`[Courses] course_access rows: ${accessRows.length}, studentCountMap:`, JSON.stringify(studentCountMap));

  const courses = (coursesRes.data || []) as SupabaseCourse[];
  for (const course of courses) {
    course.enrollments_count = studentCountMap[course.id] || 0;
  }

  return courses;
}

/**
 * Get all courses including inactive (for admin)
 * Enriches with real lesson count (from lessons via course_sections)
 * and real student count (from course_access where status='active')
 */
export async function getAllCoursesAdmin(): Promise<SupabaseCourse[]> {
  const supabase = getSupabaseAdmin();

  // Fetch courses (excluding stale enrollments_count column),
  // lesson counts, and active student counts in parallel
  const [coursesRes, lessonsRes, accessRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, description, thumbnail, instructor, category, price, original_price, rating, reviews_count, duration, lessons_count, badge, member_level, is_active, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('lessons')
      .select('id, course_sections!inner(course_id)'),
    supabase
      .from('course_access')
      .select('id, course_id')
      .eq('status', 'active'),
  ]);

  if (coursesRes.error) {
    console.warn('[Supabase Courses] Failed to fetch for admin:', coursesRes.error.message);
    return [];
  }

  // Build lesson count map: course_id -> count
  const lessonCountMap: Record<string, number> = {};
  if (lessonsRes.data) {
    for (const row of lessonsRes.data as any[]) {
      const courseId = row.course_sections?.course_id;
      if (courseId) {
        lessonCountMap[courseId] = (lessonCountMap[courseId] || 0) + 1;
      }
    }
  }

  // Build student count map: course_id -> count
  const studentCountMap: Record<string, number> = {};
  if (accessRes.data) {
    for (const row of accessRes.data) {
      const courseId = row.course_id;
      if (courseId) {
        studentCountMap[courseId] = (studentCountMap[courseId] || 0) + 1;
      }
    }
  }

  // Enrich courses with real counts
  const courses = (coursesRes.data || []) as SupabaseCourse[];
  for (const course of courses) {
    course.lessons_count = lessonCountMap[course.id] || 0;
    course.enrollments_count = studentCountMap[course.id] || 0;
  }

  return courses;
}

/**
 * Get a single course by ID
 * Computes enrollments_count from course_access (not the stale column in courses table)
 */
export async function getCourseById(id: string): Promise<SupabaseCourse | null> {
  const supabase = getSupabaseAdmin();

  const [courseRes, accessRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, title, description, thumbnail, instructor, category, price, original_price, rating, reviews_count, duration, lessons_count, badge, member_level, is_active, created_at, updated_at')
      .eq('id', id)
      .single(),
    supabase
      .from('course_access')
      .select('id')
      .eq('course_id', id)
      .eq('status', 'active'),
  ]);

  if (courseRes.error || !courseRes.data) return null;

  const course = courseRes.data as SupabaseCourse;
  course.enrollments_count = accessRes.data?.length || 0;
  return course;
}

/**
 * Create or update a course (upsert)
 */
export async function upsertCourse(course: {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  instructor?: string;
  category?: string;
  price?: number;
  original_price?: number;
  rating?: number;
  reviews_count?: number;
  duration?: number;
  lessons_count?: number;
  badge?: string;
  member_level?: string;
  is_active?: boolean;
}): Promise<SupabaseCourse | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const courseData = {
    id: course.id,
    title: course.title,
    description: course.description || '',
    thumbnail: course.thumbnail || '',
    instructor: course.instructor || 'WePower Academy',
    category: course.category || '',
    price: course.price ?? 0,
    original_price: course.original_price ?? null,
    rating: course.rating ?? 0,
    reviews_count: course.reviews_count ?? 0,
    duration: course.duration ?? 0,
    lessons_count: course.lessons_count ?? 0,
    badge: course.badge || null,
    member_level: course.member_level || 'Free',
    is_active: course.is_active !== false,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('courses')
    .upsert(courseData, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[Supabase Courses] Upsert failed:', error.message, error.details, error.hint);
    throw new Error(error.message);
  }
  return data as SupabaseCourse;
}

/**
 * Bulk upsert courses (for syncing from Google Sheets)
 */
export async function bulkUpsertCourses(courses: Array<{
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  instructor?: string;
  category?: string;
  price?: number;
  original_price?: number;
  rating?: number;
  reviews_count?: number;
  duration?: number;
  lessons_count?: number;
  badge?: string;
  member_level?: string;
}>): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const coursesData = courses.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description || '',
    thumbnail: c.thumbnail || '',
    instructor: c.instructor || 'WePower Academy',
    category: c.category || '',
    price: c.price ?? 0,
    original_price: c.original_price ?? null,
    rating: c.rating ?? 0,
    reviews_count: c.reviews_count ?? 0,
    duration: c.duration ?? 0,
    lessons_count: c.lessons_count ?? 0,
    badge: c.badge || null,
    member_level: c.member_level || 'Free',
    is_active: true,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('courses')
    .upsert(coursesData, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase Courses] Bulk upsert failed:', error.message);
    return 0;
  }
  return coursesData.length;
}

/**
 * Soft-delete a course (set is_active to false)
 */
export async function deleteCourse(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('courses')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Supabase Courses] Delete failed:', error.message);
    return false;
  }
  return true;
}
