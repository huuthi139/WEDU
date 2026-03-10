import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getScriptUrl } from '@/lib/config';

// ---------------------------------------------------------------------------
// Google Apps Script GET-based API helpers
// ---------------------------------------------------------------------------
const MAX_ENCODED_URL = 6500; // max total URL length (Google Apps Script limit ~8192, lowered for safety)
const REQUEST_TIMEOUT = 30000; // 30s timeout per request
const SAVE_RETRIES = 3; // retry failed saves up to 3 times
const READ_RETRIES = 2; // retry failed reads up to 2 times
const RETRY_DELAY = 1000; // 1s between retries
const READ_BATCH_SIZE = 6; // parallel read concurrency
const SAVE_DELAY = 300; // delay between sequential saves to avoid rate limiting

/** Safe JSON parse – returns null when response is not JSON */
async function safeParse(res: Response): Promise<any | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json') && !ct.includes('javascript')) return null;
  try { return await res.json(); } catch { return null; }
}

/** Create a fetch with timeout */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Low-level: save a single key→value pair via Apps Script (with timeout + retries) */
async function scriptSave(scriptUrl: string, key: string, value: string): Promise<boolean> {
  const qs = new URLSearchParams({ action: 'saveChapters', courseId: key, chaptersJson: value });
  const url = `${scriptUrl}?${qs.toString()}`;

  for (let attempt = 0; attempt <= SAVE_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { redirect: 'follow' });
      const data = await safeParse(res);
      if (data?.success === true) return true;
    } catch { /* timeout or network error */ }
    if (attempt < SAVE_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
    }
  }
  return false;
}

/** Low-level: read a single key from Apps Script (with timeout + retry) */
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

/** Run async tasks in batches of N for controlled parallelism (tolerates individual failures) */
async function batchParallel<T>(tasks: (() => Promise<T>)[], batchSize: number): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn => fn()));
    results.push(...settled.map(r => r.status === 'fulfilled' ? r.value : null));
  }
  return results;
}

/** Calculate the actual URL length after encoding (accounts for URLSearchParams encoding) */
function encodedUrlLen(scriptUrl: string, key: string, value: string): number {
  const qs = new URLSearchParams({ action: 'saveChapters', courseId: key, chaptersJson: value });
  return scriptUrl.length + 1 + qs.toString().length; // +1 for '?'
}

// ---------------------------------------------------------------------------
// SAVE: courseId → { _n: <count> }
//       courseId__0 → [chapter0]  (or { _p: <partCount> } if too big)
//       courseId__0__0 → [chapter0 with lesson slice 0]
//       courseId__0__1 → [chapter0 with lesson slice 1]  etc.
// ---------------------------------------------------------------------------

/** Find the maximum number of lessons (starting at offset) that fit within the URL limit */
function maxLessonBatch(scriptUrl: string, chKey: string, chapter: any, lessons: any[], offset: number): number {
  const meta = { id: chapter.id, title: chapter.title };
  let lo = 1, hi = lessons.length - offset;
  const allJson = JSON.stringify([{ ...meta, lessons: lessons.slice(offset) }]);
  if (encodedUrlLen(scriptUrl, chKey, allJson) <= MAX_ENCODED_URL) return hi;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const midJson = JSON.stringify([{ ...meta, lessons: lessons.slice(offset, offset + mid) }]);
    if (encodedUrlLen(scriptUrl, chKey, midJson) <= MAX_ENCODED_URL) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

async function saveAllChapters(scriptUrl: string, courseId: string, chapters: any[]): Promise<{ success: boolean; error?: string }> {
  for (let i = 0; i < chapters.length; i++) {
    // Add delay between saves to avoid Google Apps Script rate limiting
    if (i > 0) await new Promise(r => setTimeout(r, SAVE_DELAY));

    const chKey = `${courseId}__${i}`;
    const ch = chapters[i];
    const chJson = JSON.stringify([ch]);

    if (encodedUrlLen(scriptUrl, chKey, chJson) <= MAX_ENCODED_URL) {
      if (!await scriptSave(scriptUrl, chKey, chJson)) {
        return { success: false, error: `Lỗi lưu chương ${i + 1}` };
      }
    } else {
      const lessons = ch.lessons || [];
      let offset = 0;
      let partIdx = 0;

      while (offset < lessons.length) {
        if (partIdx > 0) await new Promise(r => setTimeout(r, SAVE_DELAY));
        const partKey = `${chKey}__${partIdx}`;
        const batch = maxLessonBatch(scriptUrl, partKey, ch, lessons, offset);
        const partChapter = { id: ch.id, title: ch.title, lessons: lessons.slice(offset, offset + batch) };
        const partJson = JSON.stringify([partChapter]);
        if (!await scriptSave(scriptUrl, partKey, partJson)) {
          return { success: false, error: `Lỗi lưu chương ${i + 1} phần ${partIdx + 1}` };
        }
        offset += batch;
        partIdx++;
      }

      await new Promise(r => setTimeout(r, SAVE_DELAY));
      if (!await scriptSave(scriptUrl, chKey, JSON.stringify({ _p: partIdx }))) {
        return { success: false, error: `Lỗi lưu index chương ${i + 1}` };
      }
    }
  }

  await new Promise(r => setTimeout(r, SAVE_DELAY));
  if (!await scriptSave(scriptUrl, courseId, JSON.stringify({ _n: chapters.length }))) {
    return { success: false, error: 'Lỗi lưu master index' };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// READ: parallel batch reads, supports _n/_p and old _chunks formats
// ---------------------------------------------------------------------------

async function readAllChapters(scriptUrl: string, courseId: string): Promise<{ chapters: any[]; complete: boolean; expectedChapters: number }> {
  const raw = await scriptRead(scriptUrl, courseId);
  if (!raw) return { chapters: [], complete: true, expectedChapters: 0 };

  // --- New format: { _n: count } ---
  if (raw._n !== undefined) {
    const count = raw._n as number;
    if (count === 0) return { chapters: [], complete: true, expectedChapters: 0 };

    // Step 1: Read all chapter indices in parallel batches
    const chapterTasks = Array.from({ length: count }, (_, i) =>
      () => scriptRead(scriptUrl, `${courseId}__${i}`)
    );
    const chapterDatas = await batchParallel(chapterTasks, READ_BATCH_SIZE);

    // Step 1b: Retry any failed chapter reads individually
    for (let i = 0; i < count; i++) {
      if (!chapterDatas[i]) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        chapterDatas[i] = await scriptRead(scriptUrl, `${courseId}__${i}`);
      }
    }

    // Step 2: Identify partitioned chapters and read their parts in parallel
    const partTasks: { chapterIdx: number; partIdx: number; key: string }[] = [];
    for (let i = 0; i < count; i++) {
      const chData = chapterDatas[i];
      if (chData?._p !== undefined) {
        for (let p = 0; p < chData._p; p++) {
          partTasks.push({
            chapterIdx: i,
            partIdx: p,
            key: `${courseId}__${i}__${p}`,
          });
        }
      }
    }

    // Read all partition parts in parallel batches
    const partResults = await batchParallel(
      partTasks.map(t => () => scriptRead(scriptUrl, t.key)),
      READ_BATCH_SIZE
    );

    // Step 2b: Retry any failed part reads individually
    for (let idx = 0; idx < partResults.length; idx++) {
      if (!partResults[idx]) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        partResults[idx] = await scriptRead(scriptUrl, partTasks[idx].key);
      }
    }

    // Index part results by chapter
    const partsByChapter: Record<number, any[]> = {};
    for (let idx = 0; idx < partTasks.length; idx++) {
      const { chapterIdx } = partTasks[idx];
      if (!partsByChapter[chapterIdx]) partsByChapter[chapterIdx] = [];
      partsByChapter[chapterIdx].push(partResults[idx]);
    }

    // Step 3: Assemble chapters
    const result: any[] = [];
    let readFailures = 0;
    for (let i = 0; i < count; i++) {
      const chData = chapterDatas[i];
      if (!chData) { readFailures++; continue; }

      if (chData._p !== undefined) {
        const parts = partsByChapter[i] || [];
        const allLessons: any[] = [];
        let chapterMeta: any = null;
        let partFailed = false;
        for (const partData of parts) {
          if (Array.isArray(partData) && partData[0]) {
            if (!chapterMeta) chapterMeta = { id: partData[0].id, title: partData[0].title };
            allLessons.push(...(partData[0].lessons || []));
          } else {
            partFailed = true;
          }
        }
        if (partFailed) readFailures++;
        if (chapterMeta) result.push({ ...chapterMeta, lessons: allLessons });
      } else if (Array.isArray(chData) && chData[0]) {
        result.push(chData[0]);
      }
    }

    return { chapters: result, complete: readFailures === 0, expectedChapters: count };
  }

  // --- Old format: { _chunks: [...] } ---
  if (raw._chunks) {
    const chunkTasks = raw._chunks.map((chunkId: string) =>
      () => scriptRead(scriptUrl, chunkId)
    );
    const chunkDatas = await batchParallel(chunkTasks, READ_BATCH_SIZE);

    // Collect lesson chunk IDs that need reading
    const lessonChunkTasks: { chunkIdx: number; chIdx: number; task: () => Promise<any> }[] = [];
    for (let ci = 0; ci < chunkDatas.length; ci++) {
      const chunkData = chunkDatas[ci];
      if (!chunkData) continue;
      const arr = Array.isArray(chunkData) ? chunkData : [chunkData];
      for (let chi = 0; chi < arr.length; chi++) {
        if (arr[chi]._lessonChunks) {
          for (const partId of arr[chi]._lessonChunks) {
            lessonChunkTasks.push({ chunkIdx: ci, chIdx: chi, task: () => scriptRead(scriptUrl, partId) });
          }
        }
      }
    }

    const lessonResults = await batchParallel(lessonChunkTasks.map(t => t.task), READ_BATCH_SIZE);
    const lessonDataMap: Record<string, any[]> = {};
    for (let idx = 0; idx < lessonChunkTasks.length; idx++) {
      const key = `${lessonChunkTasks[idx].chunkIdx}_${lessonChunkTasks[idx].chIdx}`;
      if (!lessonDataMap[key]) lessonDataMap[key] = [];
      lessonDataMap[key].push(lessonResults[idx]);
    }

    const result: any[] = [];
    for (let ci = 0; ci < chunkDatas.length; ci++) {
      const chunkData = chunkDatas[ci];
      if (!chunkData) continue;
      const arr = Array.isArray(chunkData) ? chunkData : [chunkData];
      for (let chi = 0; chi < arr.length; chi++) {
        const ch = arr[chi];
        if (ch._lessonChunks) {
          const key = `${ci}_${chi}`;
          const parts = lessonDataMap[key] || [];
          const allLessons: any[] = [];
          let meta: any = null;
          for (const partData of parts) {
            if (Array.isArray(partData) && partData[0]) {
              if (!meta) meta = { id: partData[0].id, title: partData[0].title };
              allLessons.push(...(partData[0].lessons || []));
            }
          }
          if (meta) result.push({ ...meta, lessons: allLessons });
        } else {
          result.push(ch);
        }
      }
    }
    return { chapters: result, complete: true, expectedChapters: result.length };
  }

  // --- Direct array (small course, no chunking) ---
  if (Array.isArray(raw)) return { chapters: raw, complete: true, expectedChapters: raw.length };

  return { chapters: [], complete: true, expectedChapters: 0 };
}

// ---------------------------------------------------------------------------
// Cleanup old data before saving new data (with time limit)
// ---------------------------------------------------------------------------
async function cleanupOldData(scriptUrl: string, courseId: string, timeLimitMs = 10000): Promise<void> {
  const start = Date.now();
  const isTimedOut = () => Date.now() - start > timeLimitMs;

  const raw = await scriptRead(scriptUrl, courseId);
  if (!raw) return;

  const empty = '[]';

  if (raw._n !== undefined) {
    for (let i = 0; i < raw._n && !isTimedOut(); i++) {
      const chData = await scriptRead(scriptUrl, `${courseId}__${i}`);
      if (isTimedOut()) break;
      if (chData?._p !== undefined) {
        for (let p = 0; p < chData._p && !isTimedOut(); p++) {
          await scriptSave(scriptUrl, `${courseId}__${i}__${p}`, empty);
        }
      }
      if (!isTimedOut()) {
        await scriptSave(scriptUrl, `${courseId}__${i}`, empty);
      }
    }
  } else if (raw._chunks) {
    for (const chunkId of raw._chunks) {
      if (isTimedOut()) break;
      const chunkData = await scriptRead(scriptUrl, chunkId);
      if (chunkData) {
        const arr = Array.isArray(chunkData) ? chunkData : [chunkData];
        for (const ch of arr) {
          if (ch._lessonChunks) {
            for (const partId of ch._lessonChunks) {
              if (isTimedOut()) break;
              await scriptSave(scriptUrl, partId, empty);
            }
          }
        }
      }
      if (!isTimedOut()) {
        await scriptSave(scriptUrl, chunkId, empty);
      }
    }
  }
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

    const { chapters, complete, expectedChapters } = await readAllChapters(getScriptUrl(), courseId);
    return NextResponse.json({
      success: true,
      chapters,
      complete,
      expectedChapters,
      loadedChapters: chapters.length,
    });
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
    const scriptUrl = getScriptUrl();

    // Integrity check: verify the received data is self-consistent
    // (catches transmission truncation without blocking intentional deletions)
    if (expectedLessons !== undefined) {
      const actualLessons = chapters.reduce((sum: number, ch: any) => sum + (ch.lessons?.length || 0), 0);
      if (actualLessons !== expectedLessons) {
        return NextResponse.json({
          success: false,
          error: `Dữ liệu không khớp: nhận ${actualLessons} bài nhưng client báo ${expectedLessons}. Thử lưu lại.`,
        }, { status: 400 });
      }
    }

    // Save FIRST, then clean up old data (prevents data loss if save fails)
    const result = await saveAllChapters(scriptUrl, courseId, chapters);

    // Clean up old chunks AFTER successful save (best-effort, time-limited)
    if (result.success) {
      try { await cleanupOldData(scriptUrl, courseId, 8000); } catch (error) { console.error('[Chapters] Background task error:', error instanceof Error ? error.message : String(error)); }
    }

    if (result.success) {
      let totalLessons = 0;
      let totalDuration = 0;
      let totalChapters = chapters.length;
      for (const ch of chapters) {
        const lessons = ch.lessons || [];
        totalLessons += lessons.length;
        for (const ls of lessons) {
          const dur = ls.duration || '';
          const parts = dur.split(':');
          if (parts.length === 2) {
            totalDuration += (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
          } else {
            totalDuration += parseInt(dur, 10) || 0;
          }
        }
      }
      const statsJson = JSON.stringify({ lessonsCount: totalLessons, duration: totalDuration, chaptersCount: totalChapters });
      try { await scriptSave(scriptUrl, `${courseId}_stats`, statsJson); } catch (error) { console.error('[Chapters] Background task error:', error instanceof Error ? error.message : String(error)); }

      return NextResponse.json({
        success: true,
        verified: true,
        savedLessonsCount: totalLessons,
        expectedLessonsCount: totalLessons,
        message: `Đã lưu ${totalChapters} chương, ${totalLessons} bài học`,
      });
    }

    return NextResponse.json({ success: false, error: result.error || 'Lưu thất bại' }, { status: 500 });
  } catch (error: any) {
    console.error('Chapters POST error:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' }, { status: 500 });
  }
}
