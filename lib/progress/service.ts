/**
 * Learning Progress Service
 * Server-side service for managing lesson/course progress.
 */
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { logger } from '@/lib/telemetry/logger';

export interface LessonProgressRecord {
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

export interface CourseProgressRecord {
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

/**
 * Get lesson progress for a user in a specific course+lesson
 */
export async function getLessonProgress(userId: string, courseId: string, lessonId: string): Promise<LessonProgressRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId)
    .single();

  if (error || !data) return null;
  return data as LessonProgressRecord;
}

/**
 * Get all lesson progress for a user in a course
 */
export async function getCourseLesonProgress(userId: string, courseId: string): Promise<LessonProgressRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .order('last_opened_at', { ascending: false });

  if (error || !data) return [];
  return data as LessonProgressRecord[];
}

/**
 * Get course progress summary
 */
export async function getCourseProgress(userId: string, courseId: string): Promise<CourseProgressRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('course_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (error || !data) return null;
  return data as CourseProgressRecord;
}

/**
 * Upsert lesson progress (autosave)
 */
export async function upsertLessonProgress(params: {
  userId: string;
  courseId: string;
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number;
  deviceId?: string;
}): Promise<LessonProgressRecord | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const percentComplete = params.durationSeconds > 0
    ? Math.min(100, Math.round((params.positionSeconds / params.durationSeconds) * 100 * 100) / 100)
    : 0;

  // Check existing record for version conflict
  const existing = await getLessonProgress(params.userId, params.courseId, params.lessonId);

  if (existing) {
    // Conflict strategy: accept if newer timestamp or higher position
    const { data, error } = await supabase
      .from('lesson_progress')
      .update({
        position_seconds: params.positionSeconds,
        duration_seconds: params.durationSeconds,
        percent_complete: percentComplete,
        last_opened_at: now,
        updated_at: now,
        device_id: params.deviceId || existing.device_id,
        version: existing.version + 1,
      })
      .eq('id', existing.id)
      .eq('version', existing.version) // optimistic concurrency
      .select()
      .single();

    if (error) {
      // Version conflict - refetch and retry once
      logger.warn('progress.upsert', 'Version conflict, retrying', { lessonId: params.lessonId });
      const refreshed = await getLessonProgress(params.userId, params.courseId, params.lessonId);
      if (refreshed) {
        const { data: retryData } = await supabase
          .from('lesson_progress')
          .update({
            position_seconds: Math.max(params.positionSeconds, refreshed.position_seconds),
            duration_seconds: params.durationSeconds,
            percent_complete: Math.max(percentComplete, refreshed.percent_complete),
            last_opened_at: now,
            updated_at: now,
            version: refreshed.version + 1,
          })
          .eq('id', refreshed.id)
          .select()
          .single();
        return retryData as LessonProgressRecord | null;
      }
      return null;
    }
    return data as LessonProgressRecord;
  }

  // Insert new record
  const { data, error } = await supabase
    .from('lesson_progress')
    .insert({
      user_id: params.userId,
      course_id: params.courseId,
      lesson_id: params.lessonId,
      position_seconds: params.positionSeconds,
      duration_seconds: params.durationSeconds,
      percent_complete: percentComplete,
      is_completed: false,
      first_started_at: now,
      last_opened_at: now,
      updated_at: now,
      device_id: params.deviceId || null,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    logger.error('progress.insert', 'Failed to insert lesson progress', { error: error.message });
    return null;
  }
  return data as LessonProgressRecord;
}

/**
 * Mark a lesson as completed
 */
export async function markLessonComplete(userId: string, courseId: string, lessonId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      is_completed: true,
      percent_complete: 100,
      completed_at: now,
      last_opened_at: now,
      updated_at: now,
    }, {
      onConflict: 'user_id,course_id,lesson_id',
    });

  if (error) {
    logger.error('progress.complete', 'Failed to mark lesson complete', { error: error.message });
    return false;
  }

  // Recalculate course progress
  await recalculateCourseProgress(userId, courseId);

  return true;
}

/**
 * Recalculate course_progress from lesson_progress
 */
export async function recalculateCourseProgress(userId: string, courseId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Count completed lessons
  const { data: lessons } = await supabase
    .from('lesson_progress')
    .select('lesson_id, is_completed, last_opened_at, position_seconds')
    .eq('user_id', userId)
    .eq('course_id', courseId);

  const totalLessons = lessons?.length || 0;
  const completedLessons = lessons?.filter(l => l.is_completed).length || 0;
  const percentComplete = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100 * 100) / 100
    : 0;

  // Find last accessed lesson
  const sorted = (lessons || []).sort((a, b) =>
    new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime()
  );
  const lastLesson = sorted[0];

  await supabase
    .from('course_progress')
    .upsert({
      user_id: userId,
      course_id: courseId,
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      percent_complete: percentComplete,
      last_lesson_id: lastLesson?.lesson_id || null,
      last_position_seconds: lastLesson?.position_seconds || 0,
      updated_at: now,
    }, {
      onConflict: 'user_id,course_id',
    });
}
