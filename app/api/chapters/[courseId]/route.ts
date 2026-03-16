import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getChaptersByCourse, saveChapters } from '@/lib/supabase/chapters';

// ---------------------------------------------------------------------------
// Google Apps Script fallback (read-only, for migrating old data)
// ---------------------------------------------------------------------------
const REQUEST_TIMEOUT = 30000;
const READ_RETRIES = 2;
const RETRY_DELAY = 1000;
const READ_BATCH_SIZE = 6;

function getScriptUrl(): string | null {
  return process.env.GOOGLE_SCRIPT_URL || null;
}

async function safeParse(res: Response): Promise<any | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json') && !ct.includes('javascript')) return null;
  try { return await res.json(); } catch { return null; }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function scriptRead(scriptUrl: string, key: string): Promise<any> {
  const qs = new URLSearchParams({ action: 'getChapters', courseId: key });
  const url = `${scriptUrl}?${qs.toString()}`;

  for (let attempt = 0; attempt <= READ_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { redirect: 'follow', cache: 'no-store' });
      const data = await safeParse(res);
      if (!data?.success) {
        if (attempt < READ_RETRIES) { await new Promise(r => setTimeout(r, RETRY_DELAY)); continue; }
        return null;
      }
      return data.chapters ?? null;
    } catch {
      if (attempt < READ_RETRIES) { await new Promise(r => setTimeout(r, RETRY_DELAY)); continue; }
      return null;
    }
  }
  return null;
}

async function batchParallel<T>(tasks: (() => Promise<T>)[], batchSize: number): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn => fn()));
    results.push(...settled.map(r => r.status === 'fulfilled' ? r.value : null));
  }
  return results;
}

/** Read from GAS (legacy format support) */
async function readFromGAS(courseId: string): Promise<any[] | null> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return null;

  try {
    const raw = await scriptRead(scriptUrl, courseId);
    if (!raw) return null;

    // New format: { _n: count }
    if (raw._n !== undefined) {
      const count = raw._n as number;
      if (count === 0) return [];

      const chapterTasks = Array.from({ length: count }, (_, i) =>
        () => scriptRead(scriptUrl, `${courseId}__${i}`)
      );
      const chapterDatas = await batchParallel(chapterTasks, READ_BATCH_SIZE);

      // Retry failed reads
      for (let i = 0; i < count; i++) {
        if (!chapterDatas[i]) {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          chapterDatas[i] = await scriptRead(scriptUrl, `${courseId}__${i}`);
        }
      }

      // Handle partitioned chapters
      const partTasks: { chapterIdx: number; key: string }[] = [];
      for (let i = 0; i < count; i++) {
        const chData = chapterDatas[i];
        if (chData?._p !== undefined) {
          for (let p = 0; p < chData._p; p++) {
            partTasks.push({ chapterIdx: i, key: `${courseId}__${i}__${p}` });
          }
        }
      }

      const partResults = await batchParallel(
        partTasks.map(t => () => scriptRead(scriptUrl, t.key)),
        READ_BATCH_SIZE
      );

      const partsByChapter: Record<number, any[]> = {};
      for (let idx = 0; idx < partTasks.length; idx++) {
        const { chapterIdx } = partTasks[idx];
        if (!partsByChapter[chapterIdx]) partsByChapter[chapterIdx] = [];
        partsByChapter[chapterIdx].push(partResults[idx]);
      }

      const result: any[] = [];
      for (let i = 0; i < count; i++) {
        const chData = chapterDatas[i];
        if (!chData) continue;

        if (chData._p !== undefined) {
          const parts = partsByChapter[i] || [];
          const allLessons: any[] = [];
          let chapterMeta: any = null;
          for (const partData of parts) {
            if (Array.isArray(partData) && partData[0]) {
              if (!chapterMeta) chapterMeta = { id: partData[0].id, title: partData[0].title };
              allLessons.push(...(partData[0].lessons || []));
            }
          }
          if (chapterMeta) result.push({ ...chapterMeta, lessons: allLessons });
        } else if (Array.isArray(chData) && chData[0]) {
          result.push(chData[0]);
        }
      }
      return result;
    }

    // Direct array (small course)
    if (Array.isArray(raw)) return raw;

    return null;
  } catch {
    return null;
  }
}

// Parse "MM:SS" duration to seconds
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(':');
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return parseInt(duration, 10) || 0;
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

    // 1. Try Supabase (source of truth)
    const chapters = await getChaptersByCourse(courseId);
    if (chapters && chapters.length > 0) {
      return NextResponse.json({
        success: true,
        chapters,
        complete: true,
        expectedChapters: chapters.length,
        loadedChapters: chapters.length,
      });
    }

    // 2. Fallback: read from GAS (legacy data migration)
    const gasChapters = await readFromGAS(courseId);
    if (gasChapters && gasChapters.length > 0) {
      // Migrate to Supabase in background
      let totalLessons = 0;
      let totalDuration = 0;
      for (const ch of gasChapters) {
        const lessons = ch.lessons || [];
        totalLessons += lessons.length;
        for (const ls of lessons) {
          totalDuration += parseDurationToSeconds(ls.duration || '');
        }
      }
      saveChapters(courseId, gasChapters, totalLessons, totalDuration).catch(() => {});

      return NextResponse.json({
        success: true,
        chapters: gasChapters,
        complete: true,
        expectedChapters: gasChapters.length,
        loadedChapters: gasChapters.length,
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

    // Calculate stats
    let totalLessons = 0;
    let totalDuration = 0;
    for (const ch of chapters) {
      const lessons = ch.lessons || [];
      totalLessons += lessons.length;
      for (const ls of lessons) {
        totalDuration += parseDurationToSeconds(ls.duration || '');
      }
    }

    // Save to Supabase (source of truth)
    const ok = await saveChapters(courseId, chapters, totalLessons, totalDuration);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Lưu thất bại' }, { status: 500 });
    }

    // Background sync to GAS (optional, for legacy compatibility)
    const scriptUrl = getScriptUrl();
    if (scriptUrl) {
      syncChaptersToGAS(scriptUrl, courseId, chapters).catch(() => {});
    }

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

/** Background sync chapters to GAS (fire-and-forget) */
async function syncChaptersToGAS(scriptUrl: string, courseId: string, chapters: any[]): Promise<void> {
  try {
    // Save stats
    let totalLessons = 0;
    let totalDuration = 0;
    for (const ch of chapters) {
      totalLessons += (ch.lessons || []).length;
      for (const ls of (ch.lessons || [])) {
        totalDuration += parseDurationToSeconds(ls.duration || '');
      }
    }
    const statsJson = JSON.stringify({ lessonsCount: totalLessons, duration: totalDuration, chaptersCount: chapters.length });

    const qs = new URLSearchParams({ action: 'saveChapters', courseId: `${courseId}_stats`, chaptersJson: statsJson });
    await fetchWithTimeout(`${scriptUrl}?${qs.toString()}`, { redirect: 'follow' }, 10000);
  } catch {
    // Ignore sync failures
  }
}
