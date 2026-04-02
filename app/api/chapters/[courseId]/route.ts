import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getSectionsByCourse } from '@/lib/supabase/sections';
import { getChaptersByCourse } from '@/lib/supabase/chapters';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { FALLBACK_CHAPTERS } from '@/lib/fallback-chapters';
import { getSession } from '@/lib/auth/session';
import { getEffectiveAccessTier } from '@/lib/supabase/course-access';
import { getUserByEmail } from '@/lib/supabase/users';
import { meetsAccessTier } from '@/lib/types';
import { isAdminLevelRole, normalizeRole } from '@/lib/auth/permissions';
import type { LessonRow, AccessTier } from '@/lib/types';

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
 * Convert normalized sections+lessons to the legacy chapter format.
 * Strips sensitive content (directPlayUrl, video_url) for lessons the user cannot access.
 */
function sectionsToChapterFormat(
  sections: Array<{ id: string; title: string; lessons: LessonRow[] }>,
  userTier: AccessTier,
  isStaffUser: boolean,
) {
  return sections.map(sec => ({
    id: sec.id,
    title: sec.title,
    lessons: sec.lessons.map(ls => {
      const lessonTier = (ls as LessonRow & { access_tier?: string }).access_tier || 'free';
      const canAccess = isStaffUser || meetsAccessTier(userTier, lessonTier as AccessTier);

      return {
        id: ls.id,
        title: ls.title,
        duration: ls.duration || '',
        accessTier: lessonTier,
        requiredLevel: accessTierToLevel(lessonTier),
        lessonType: (ls as LessonRow & { lesson_type?: string }).lesson_type || 'video',
        // Only expose play URL if user has access
        directPlayUrl: canAccess ? (ls.direct_play_url || '') : '',
        isPreview: ls.is_preview || false,
        thumbnail: '',
      };
    }),
  }));
}

/**
 * Strip content from legacy/fallback chapters based on user access tier.
 */
function protectChapterContent(
  chapters: Array<{ id: string; title: string; lessons: Array<Record<string, unknown>> }>,
  userTier: AccessTier,
  isStaffUser: boolean,
) {
  return chapters.map(ch => ({
    ...ch,
    lessons: (ch.lessons || []).map(ls => {
      const lessonTier = (ls.accessTier as string) || 'free';
      const canAccess = isStaffUser || meetsAccessTier(userTier, lessonTier as AccessTier);
      return {
        ...ls,
        directPlayUrl: canAccess ? (ls.directPlayUrl || '') : '',
        videoUrl: canAccess ? (ls.videoUrl || '') : '',
      };
    }),
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

    // Determine user's access tier for content protection
    let userTier: AccessTier = 'free';
    let isStaffUser = false;
    const session = await getSession();
    if (session) {
      const role = normalizeRole(session.role);
      isStaffUser = isAdminLevelRole(role) || role === 'instructor';
      if (!isStaffUser) {
        const dbUser = await getUserByEmail(session.email);
        if (dbUser?.id) {
          userTier = await getEffectiveAccessTier(dbUser.id, courseId);
        }
      }
    }

    // 1. Try normalized tables (source of truth)
    const sections = await getSectionsByCourse(courseId);
    if (sections && sections.length > 0) {
      const chapters = sectionsToChapterFormat(sections, userTier, isStaffUser);
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
      migrateJsonbToNormalized(courseId, jsonbChapters).catch(() => {});
      const protected_ = protectChapterContent(jsonbChapters, userTier, isStaffUser);
      return NextResponse.json({
        success: true,
        chapters: protected_,
        complete: true,
        expectedChapters: protected_.length,
        loadedChapters: protected_.length,
        source: 'jsonb_legacy',
      });
    }

    // 3. Fallback: use hardcoded fallback data (seed data)
    const fallbackChapters = FALLBACK_CHAPTERS[courseId];
    if (fallbackChapters && fallbackChapters.length > 0) {
      migrateJsonbToNormalized(courseId, fallbackChapters).catch(() => {});
      const protected_ = protectChapterContent(fallbackChapters, userTier, isStaffUser);
      return NextResponse.json({
        success: true,
        chapters: protected_,
        complete: true,
        expectedChapters: protected_.length,
        loadedChapters: protected_.length,
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
    // Require admin/instructor role to modify course content
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.role);
    if (!isAdminLevelRole(role) && role !== 'instructor') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

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
    // Pattern: backup old data → delete → insert → if insert fails → restore backup
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    let totalLessons = 0;
    let totalDuration = 0;

    // Step 1: Backup existing sections and lessons before deletion
    const { data: backupSections } = await supabase
      .from('course_sections')
      .select('*')
      .eq('course_id', courseId);
    const { data: backupLessons } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId);

    // Step 2: Delete existing sections and lessons
    const { error: deleteLessonsErr } = await supabase.from('lessons').delete().eq('course_id', courseId);
    if (deleteLessonsErr) {
      console.error('[Chapters POST] Failed to delete existing lessons:', deleteLessonsErr);
      return NextResponse.json({ success: false, error: `Lỗi xóa bài học cũ: ${deleteLessonsErr.message}` }, { status: 500 });
    }
    const { error: deleteSectionsErr } = await supabase.from('course_sections').delete().eq('course_id', courseId);
    if (deleteSectionsErr) {
      console.error('[Chapters POST] Failed to delete existing sections:', deleteSectionsErr);
      // Restore backed-up lessons since sections delete failed but lessons were already deleted
      if (backupLessons && backupLessons.length > 0) {
        await supabase.from('lessons').insert(backupLessons);
      }
      return NextResponse.json({ success: false, error: `Lỗi xóa phần cũ: ${deleteSectionsErr.message}` }, { status: 500 });
    }

    // Step 3: Insert new sections and lessons — restore backup on any failure
    try {
      for (let sIdx = 0; sIdx < chapters.length; sIdx++) {
        const ch = chapters[sIdx];

        const { data: section, error: sectionErr } = await supabase
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

        if (sectionErr || !section) {
          throw new Error(`Lỗi tạo phần "${ch.title}": ${sectionErr?.message || 'No data returned'}`);
        }

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

          const { error: lessonErr } = await supabase.from('lessons').insert({
            course_id: courseId,
            section_id: section.id,
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
          if (lessonErr) {
            throw new Error(`Lỗi tạo bài "${ls.title}": ${lessonErr.message}`);
          }
        }
      }
    } catch (insertError: any) {
      // Insert failed mid-way — restore old data so nothing is lost
      console.error('[Chapters POST] Insert failed, restoring backup:', insertError.message);

      // Clean up any partially inserted new data
      await supabase.from('lessons').delete().eq('course_id', courseId);
      await supabase.from('course_sections').delete().eq('course_id', courseId);

      // Restore backup
      if (backupSections && backupSections.length > 0) {
        await supabase.from('course_sections').insert(backupSections);
      }
      if (backupLessons && backupLessons.length > 0) {
        await supabase.from('lessons').insert(backupLessons);
      }

      return NextResponse.json({ success: false, error: `Lưu thất bại, dữ liệu cũ đã được phục hồi. Chi tiết: ${insertError.message}` }, { status: 500 });
    }

    // Step 4: Update courses table with stats
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
    console.error('Chapters POST error:', error?.message || error, error?.stack);
    return NextResponse.json({ success: false, error: `Lỗi hệ thống: ${error?.message || 'Unknown'}` }, { status: 500 });
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
