import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getSectionsByCourse } from '@/lib/supabase/sections';
import { getChaptersByCourse } from '@/lib/supabase/chapters';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { FALLBACK_CHAPTERS } from '@/lib/fallback-chapters';
import type { LessonRow } from '@/lib/types';

// Parse "MM:SS" duration to seconds
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(':');
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return parseInt(duration, 10) || 0;
}

/**
 * Map access_tier DB value to display MemberLevel.
 */
function accessTierToLevel(tier: string | undefined): string {
  switch (tier) {
    case 'vip': return 'VIP';
    case 'premium': return 'Premium';
    default: return 'Free';
  }
}

/**
 * Convert normalized sections+lessons to the legacy chapter format
 * that the frontend expects.
 */
function sectionsToChapterFormat(sections: Array<{ id: string; title: string; lessons: LessonRow[] }>) {
  return sections.map(sec => ({
    id: sec.id,
    title: sec.title,
    lessons: sec.lessons.map(ls => ({
      id: ls.id,
      title: ls.title,
      duration: ls.duration || '',
      accessTier: (ls as any).access_tier || 'free',
      requiredLevel: accessTierToLevel((ls as any).access_tier),
      lessonType: (ls as any).lesson_type || 'video',
      directPlayUrl: ls.direct_play_url || '',
      isPreview: ls.is_preview || false,
      thumbnail: '',
    })),
  }));
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    if (!courseId) return NextResponse.json({ success: false, error: 'Missing courseId' }, { status: 400 });

    // 1. Try normalized tables (source of truth)
    const sections = await getSectionsByCourse(courseId);
    if (sections && sections.length > 0) {
      const chapters = sectionsToChapterFormat(sections);
      return NextResponse.json({
        success: true,
        chapters,
        complete: true,
        expectedChapters: chapters.length,
        loadedChapters: chapters.length,
        source: 'normalized',
      });
    }

    // 2. Fallback: try legacy JSONB chapters table
    const jsonbChapters = await getChaptersByCourse(courseId);
    if (jsonbChapters && jsonbChapters.length > 0) {
      // Migrate to normalized tables in background
      migrateJsonbToNormalized(courseId, jsonbChapters).catch(() => {});

      return NextResponse.json({
        success: true,
        chapters: jsonbChapters,
        complete: true,
        expectedChapters: jsonbChapters.length,
        loadedChapters: jsonbChapters.length,
        source: 'jsonb_legacy',
      });
    }

    // 3. Fallback: use hardcoded fallback data (seed data)
    const fallbackChapters = FALLBACK_CHAPTERS[courseId];
    if (fallbackChapters && fallbackChapters.length > 0) {
      // Migrate to normalized tables in background
      migrateJsonbToNormalized(courseId, fallbackChapters).catch(() => {});

      return NextResponse.json({
        success: true,
        chapters: fallbackChapters,
        complete: true,
        expectedChapters: fallbackChapters.length,
        loadedChapters: fallbackChapters.length,
        source: 'fallback',
      });
    }

    return NextResponse.json({ success: true, chapters: [], complete: true, expectedChapters: 0 });
  } catch (error) {
    console.error('Chapters GET error:', error);
    return NextResponse.json({ success: true, chapters: [], complete: false, expectedChapters: -1 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    if (!courseId) return NextResponse.json({ success: false, error: 'Missing courseId' }, { status: 400 });

    const body = await request.json();
    const chapters = body.chapters || [];
    const expectedLessons = body.expectedLessons as number | undefined;

    // Integrity check
    if (expectedLessons !== undefined) {
      const actualLessons = chapters.reduce((sum: number, ch: any) => sum + (ch.lessons?.length || 0), 0);
      if (actualLessons !== expectedLessons) {
        return NextResponse.json({
          success: false,
          error: `Dữ liệu không khớp: nhận ${actualLessons} bài nhưng client báo ${expectedLessons}. Thử lưu lại.`,
        }, { status: 400 });
      }
    }

    // Save to normalized tables (source of truth)
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    let totalLessons = 0;
    let totalDuration = 0;

    // Delete existing sections and lessons for this course
    await supabase.from('lessons').delete().eq('course_id', courseId);
    await supabase.from('course_sections').delete().eq('course_id', courseId);

    // Insert sections and lessons
    for (let sIdx = 0; sIdx < chapters.length; sIdx++) {
      const ch = chapters[sIdx];

      const { data: section } = await supabase
        .from('course_sections')
        .insert({
          course_id: courseId,
          title: ch.title || `Phần ${sIdx + 1}`,
          description: '',
          sort_order: sIdx,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (!section) continue;

      const lessons = ch.lessons || [];
      for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
        const ls = lessons[lIdx];
        const durationSecs = parseDurationToSeconds(ls.duration || '');
        totalLessons++;
        totalDuration += durationSecs;

        // Map requiredLevel to access_tier for backward compat
        let accessTier = ls.accessTier || 'free';
        if (!ls.accessTier && ls.requiredLevel) {
          accessTier = ls.requiredLevel === 'VIP' ? 'vip' : ls.requiredLevel === 'Premium' ? 'premium' : 'free';
        }
        if (!ls.accessTier && ls.isPreview) {
          accessTier = 'free';
        }

        await supabase.from('lessons').insert({
          course_id: courseId,
          section_id: section.id,
          chapter_id: section.id,
          title: ls.title || `Bài ${lIdx + 1}`,
          description: '',
          duration: ls.duration || '00:00',
          duration_seconds: durationSecs,
          video_url: '',
          direct_play_url: ls.directPlayUrl || '',
          is_preview: ls.isPreview || accessTier === 'free',
          access_tier: accessTier,
          lesson_type: ls.lessonType || 'video',
          sort_order: lIdx,
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Update courses table with stats
    await supabase
      .from('courses')
      .update({
        lessons_count: totalLessons,
        duration: totalDuration,
        updated_at: now,
      })
      .eq('id', courseId);

    return NextResponse.json({
      success: true,
      verified: true,
      savedLessonsCount: totalLessons,
      expectedLessonsCount: totalLessons,
      message: `Đã lưu ${chapters.length} chương, ${totalLessons} bài học`,
    });
  } catch (error: any) {
    console.error('Chapters POST error:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }, { status: 500 });
  }
}

/**
 * Background migration: convert JSONB/fallback chapter data to normalized tables.
 * This runs once per course when data is found in old format but not in normalized tables.
 */
async function migrateJsonbToNormalized(courseId: string, chapters: any[]): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    let totalLessons = 0;
    let totalDuration = 0;

    for (let sIdx = 0; sIdx < chapters.length; sIdx++) {
      const ch = chapters[sIdx];

      const { data: section } = await supabase
        .from('course_sections')
        .insert({
          course_id: courseId,
          title: ch.title || `Phần ${sIdx + 1}`,
          description: '',
          sort_order: sIdx,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (!section) continue;

      const lessons = ch.lessons || [];
      if (lessons.length > 0) {
        const lessonRows = lessons.map((ls: any, lIdx: number) => {
          const durationSecs = parseDurationToSeconds(ls.duration || '');
          totalLessons++;
          totalDuration += durationSecs;
          // Map requiredLevel to access_tier
          let accessTier = ls.accessTier || 'free';
          if (!ls.accessTier && ls.requiredLevel) {
            accessTier = ls.requiredLevel === 'VIP' ? 'vip' : ls.requiredLevel === 'Premium' ? 'premium' : 'free';
          }
          if (!ls.accessTier && ls.isPreview) {
            accessTier = 'free';
          }
          return {
            course_id: courseId,
            section_id: section.id,
            chapter_id: section.id,
            title: ls.title || `Bài ${lIdx + 1}`,
            description: '',
            duration: ls.duration || '00:00',
            duration_seconds: durationSecs,
            video_url: '',
            direct_play_url: ls.directPlayUrl || '',
            is_preview: ls.isPreview || accessTier === 'free',
            access_tier: accessTier,
            lesson_type: ls.lessonType || 'video',
            sort_order: lIdx,
            created_at: now,
            updated_at: now,
          };
        });

        await supabase.from('lessons').insert(lessonRows);
      }
    }

    // Update courses table with stats
    await supabase
      .from('courses')
      .update({
        lessons_count: totalLessons,
        duration: totalDuration,
        updated_at: now,
      })
      .eq('id', courseId);

    console.log(`[Chapters] Migrated course ${courseId} to normalized tables: ${chapters.length} sections, ${totalLessons} lessons`);
  } catch (err) {
    console.error(`[Chapters] Migration failed for course ${courseId}:`, err);
  }
}
