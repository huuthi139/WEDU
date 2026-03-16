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
 */
export async function getAllCourses(): Promise<SupabaseCourse[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase Courses] Failed to fetch:', error.message);
    return [];
  }
  return (data || []) as SupabaseCourse[];
}

/**
 * Get all courses including inactive (for admin)
 */
export async function getAllCoursesAdmin(): Promise<SupabaseCourse[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase Courses] Failed to fetch for admin:', error.message);
    return [];
  }
  return (data || []) as SupabaseCourse[];
}

/**
 * Get a single course by ID
 */
export async function getCourseById(id: string): Promise<SupabaseCourse | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as SupabaseCourse;
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
  enrollments_count?: number;
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
    instructor: course.instructor || 'WEDU',
    category: course.category || '',
    price: course.price ?? 0,
    original_price: course.original_price ?? null,
    rating: course.rating ?? 0,
    reviews_count: course.reviews_count ?? 0,
    enrollments_count: course.enrollments_count ?? 0,
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
    console.error('[Supabase Courses] Upsert failed:', error.message);
    return null;
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
  enrollments_count?: number;
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
    instructor: c.instructor || 'WEDU',
    category: c.category || '',
    price: c.price ?? 0,
    original_price: c.original_price ?? null,
    rating: c.rating ?? 0,
    reviews_count: c.reviews_count ?? 0,
    enrollments_count: c.enrollments_count ?? 0,
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
