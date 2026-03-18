/**
 * Supabase course sections & lessons operations (normalized tables)
 */
import { getSupabaseAdmin } from './client';
import type { CourseSectionRow, LessonRow } from '@/lib/types';

/**
 * Get all sections for a course with their lessons
 */
export async function getSectionsByCourse(courseId: string): Promise<(CourseSectionRow & { lessons: LessonRow[] })[]> {
  const supabase = getSupabaseAdmin();

  // Fetch sections
  const { data: sections, error: secErr } = await supabase
    .from('course_sections')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (secErr || !sections || sections.length === 0) return [];

  // Fetch lessons for all sections
  const { data: lessons, error: lesErr } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (lesErr) {
    console.warn('[Supabase Sections] Failed to fetch lessons:', lesErr.message);
  }

  const lessonMap = new Map<string, LessonRow[]>();
  for (const lesson of (lessons || []) as LessonRow[]) {
    const key = lesson.section_id || '__no_section__';
    if (!lessonMap.has(key)) lessonMap.set(key, []);
    lessonMap.get(key)!.push(lesson);
  }

  return (sections as CourseSectionRow[]).map(sec => ({
    ...sec,
    lessons: lessonMap.get(sec.id) || [],
  }));
}

/**
 * Get a single lesson by ID
 */
export async function getLessonById(lessonId: string): Promise<LessonRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (error || !data) return null;
  return data as LessonRow;
}

/**
 * Get all lessons for a course (flat list)
 */
export async function getLessonsByCourse(courseId: string): Promise<LessonRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return data as LessonRow[];
}

/**
 * Create a section
 */
export async function createSection(data: {
  courseId: string;
  title: string;
  description?: string;
  sortOrder?: number;
}): Promise<CourseSectionRow | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: section, error } = await supabase
    .from('course_sections')
    .insert({
      course_id: data.courseId,
      title: data.title,
      description: data.description || '',
      sort_order: data.sortOrder ?? 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase Sections] Create failed:', error.message);
    return null;
  }
  return section as CourseSectionRow;
}

/**
 * Create a lesson
 */
export async function createLesson(data: {
  courseId: string;
  sectionId?: string;
  title: string;
  description?: string;
  duration?: string;
  durationSeconds?: number;
  videoUrl?: string;
  directPlayUrl?: string;
  isPreview?: boolean;
  sortOrder?: number;
}): Promise<LessonRow | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: lesson, error } = await supabase
    .from('lessons')
    .insert({
      course_id: data.courseId,
      section_id: data.sectionId || null,
      title: data.title,
      description: data.description || '',
      duration: data.duration || '00:00',
      duration_seconds: data.durationSeconds || 0,
      video_url: data.videoUrl || '',
      direct_play_url: data.directPlayUrl || '',
      is_preview: data.isPreview || false,
      sort_order: data.sortOrder ?? 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase Lessons] Create failed:', error.message);
    return null;
  }
  return lesson as LessonRow;
}
