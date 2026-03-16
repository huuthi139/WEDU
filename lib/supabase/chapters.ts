/**
 * Supabase chapter data operations
 * Stores course chapters as JSON in Supabase (chapters table)
 */
import { getSupabaseAdmin } from './client';

export interface SupabaseChapterData {
  id?: string;
  course_id: string;
  chapters_json: any[];
  lessons_count: number;
  duration: number;
  updated_at: string;
}

/**
 * Get chapters for a course
 */
export async function getChaptersByCourse(courseId: string): Promise<any[] | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('chapters')
    .select('chapters_json')
    .eq('course_id', courseId)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.chapters_json || [];
}

/**
 * Save chapters for a course (upsert)
 */
export async function saveChapters(
  courseId: string,
  chapters: any[],
  lessonsCount: number,
  duration: number
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('chapters')
    .upsert({
      course_id: courseId,
      chapters_json: chapters,
      lessons_count: lessonsCount,
      duration,
      updated_at: now,
    }, { onConflict: 'course_id' });

  if (error) {
    console.error('[Supabase Chapters] Save failed:', error.message);
    return false;
  }
  return true;
}

/**
 * Get all chapter stats (for course listing)
 */
export async function getAllChapterStats(): Promise<Record<string, { lessonsCount: number; duration: number }>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('chapters')
    .select('course_id, lessons_count, duration');

  if (error || !data) return {};

  const stats: Record<string, { lessonsCount: number; duration: number }> = {};
  for (const row of data) {
    stats[row.course_id] = {
      lessonsCount: row.lessons_count || 0,
      duration: row.duration || 0,
    };
  }
  return stats;
}
