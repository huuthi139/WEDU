/**
 * Supabase enrollment data operations
 * Handles enrollments + progress in Supabase (enrollments table)
 */
import { getSupabaseAdmin } from './client';

export interface SupabaseEnrollment {
  id?: string;
  user_email: string;
  course_id: string;
  enrolled_at: string;
  progress: number;
  completed_lessons: string[];
  last_accessed_at: string;
}

/**
 * Get all enrollments for a user
 */
export async function getEnrollmentsByUser(email: string): Promise<SupabaseEnrollment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_email', email.toLowerCase())
    .order('enrolled_at', { ascending: false });

  if (error) {
    console.warn('[Supabase Enrollments] Failed to fetch:', error.message);
    return [];
  }
  return (data || []) as SupabaseEnrollment[];
}

/**
 * Enroll a user in a course (idempotent)
 */
export async function enrollUser(email: string, courseId: string): Promise<SupabaseEnrollment | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_email', email.toLowerCase())
    .eq('course_id', courseId)
    .limit(1)
    .single();

  if (existing) return existing as SupabaseEnrollment;

  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      user_email: email.toLowerCase(),
      course_id: courseId,
      enrolled_at: now,
      progress: 0,
      completed_lessons: [],
      last_accessed_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase Enrollments] Enroll failed:', error.message);
    return null;
  }
  return data as SupabaseEnrollment;
}

/**
 * Update progress for an enrollment
 */
export async function updateProgress(
  email: string,
  courseId: string,
  lessonId: string,
  progress: number
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Get current enrollment
  const { data: current } = await supabase
    .from('enrollments')
    .select('completed_lessons')
    .eq('user_email', email.toLowerCase())
    .eq('course_id', courseId)
    .limit(1)
    .single();

  const completedLessons: string[] = current?.completed_lessons || [];
  if (lessonId && !completedLessons.includes(lessonId)) {
    completedLessons.push(lessonId);
  }

  const { error } = await supabase
    .from('enrollments')
    .update({
      progress: Math.min(100, Math.max(0, progress)),
      completed_lessons: completedLessons,
      last_accessed_at: now,
    })
    .eq('user_email', email.toLowerCase())
    .eq('course_id', courseId);

  if (error) {
    console.error('[Supabase Enrollments] Update progress failed:', error.message);
    return false;
  }
  return true;
}

/**
 * Check if user is enrolled in a course
 */
export async function isUserEnrolled(email: string, courseId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_email', email.toLowerCase())
    .eq('course_id', courseId)
    .limit(1)
    .single();

  return !!data;
}
