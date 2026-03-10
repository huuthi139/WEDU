import { NextResponse } from 'next/server';

// Force dynamic - không cache static lúc build
export const dynamic = 'force-dynamic';

import { getScriptUrl, getSheetId } from '@/lib/config';

// Column positions in Google Sheet (0-indexed)
// Data order: ID, Title, Description, Thumbnail, Instructor, Price, OriginalPrice, Rating, ReviewsCount, EnrollmentsCount, Duration, LessonsCount, Badge, Category
const COL = {
  ID: 0,
  TITLE: 1,
  DESCRIPTION: 2,
  THUMBNAIL: 3,
  INSTRUCTOR: 4,
  PRICE: 5,
  ORIGINAL_PRICE: 6,
  RATING: 7,
  REVIEWS_COUNT: 8,
  ENROLLMENTS_COUNT: 9,
  DURATION: 10,
  LESSONS_COUNT: 11,
  BADGE: 12,
  CATEGORY: 13,
  MEMBER_LEVEL: 14,
};

function parseCSVRow(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSVRows(csv: string): string[][] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => parseCSVRow(line));
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

// Fetch chapter stats from pre-computed _stats entries saved alongside chapters
async function fetchChapterStats(timeoutMs = 12000): Promise<Record<string, { lessonsCount: number; duration: number }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const scriptUrl = getScriptUrl();
    const res = await fetch(`${scriptUrl}?action=getAllChapters`, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json') && !ct.includes('javascript')) return {};
    let data: any;
    try { data = await res.json(); } catch { return {}; }
    if (data.success && data.data) {
      const stats: Record<string, { lessonsCount: number; duration: number }> = {};
      const allData = data.data as Record<string, any>;

      // Read pre-computed stats (saved at "{courseId}_stats" key)
      for (const [key, value] of Object.entries(allData)) {
        if (key.endsWith('_stats') && value && typeof value === 'object') {
          const v = value as any;
          if (v.lessonsCount !== undefined) {
            const courseId = key.replace('_stats', '');
            stats[courseId] = {
              lessonsCount: Number(v.lessonsCount) || 0,
              duration: Number(v.duration) || 0,
            };
          }
        }
      }

      // Fallback: for courses without _stats, try direct array format
      for (const [courseId, chapters] of Object.entries(allData)) {
        if (courseId.includes('__') || courseId.includes('_stats')) continue;
        if (stats[courseId]) continue; // already have pre-computed stats
        if (!Array.isArray(chapters)) continue;

        let totalLessons = 0;
        let totalDuration = 0;
        for (const ch of chapters) {
          const lessons = ch.lessons || [];
          totalLessons += lessons.length;
          for (const ls of lessons) {
            totalDuration += parseDurationToSeconds(ls.duration || '');
          }
        }
        if (totalLessons > 0) {
          stats[courseId] = { lessonsCount: totalLessons, duration: totalDuration };
        }
      }
      return stats;
    }
  } catch {
    // Timeout or network error - fall back to sheet values
  } finally {
    clearTimeout(timeout);
  }
  return {};
}

// In-memory cache to avoid hitting Google Sheets on every request
let cachedCourses: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function fetchAndParseCourses() {
  const [coursesRes, chapterStats] = await Promise.all([
    fetch(
      `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq?tqx=out:csv&sheet=Courses`,
      { cache: 'no-store' }
    ),
    fetchChapterStats(),
  ]);

  const csv = await coursesRes.text();
  const rows = parseCSVRows(csv);

  return rows
    .filter(cols => cols[COL.ID] && cols[COL.TITLE])
    .map(cols => {
      const id = cols[COL.ID] || '';
      const price = Number(cols[COL.PRICE]?.replace(/,/g, '')) || 0;
      const originalPrice = cols[COL.ORIGINAL_PRICE] ? Number(cols[COL.ORIGINAL_PRICE]?.replace(/,/g, '')) : undefined;
      const rating = Number(cols[COL.RATING]?.replace(',', '.')) || 0;

      const real = chapterStats[id];
      const sheetLessons = Number(cols[COL.LESSONS_COUNT]) || 0;
      const sheetDuration = Number(cols[COL.DURATION]) || 0;
      const sheetEnrollments = Number(cols[COL.ENROLLMENTS_COUNT]?.replace(/,/g, '')) || 0;

      return {
        id,
        thumbnail: cols[COL.THUMBNAIL] || '',
        title: cols[COL.TITLE] || '',
        description: cols[COL.DESCRIPTION] || '',
        instructor: cols[COL.INSTRUCTOR] || 'Wepower Edu App',
        price,
        originalPrice,
        rating,
        reviewsCount: Number(cols[COL.REVIEWS_COUNT]) || 0,
        enrollmentsCount: sheetEnrollments,
        duration: real ? real.duration : sheetDuration,
        lessonsCount: real ? real.lessonsCount : sheetLessons,
        isFree: price === 0,
        badge: cols[COL.BADGE] || undefined,
        category: cols[COL.CATEGORY] || '',
        memberLevel: cols[COL.MEMBER_LEVEL] || 'Free',
      };
    });
}

export async function GET() {
  try {
    const now = Date.now();

    // Serve from cache if still fresh
    if (cachedCourses && now - cacheTimestamp < CACHE_TTL_MS) {
      const response = NextResponse.json({ success: true, courses: cachedCourses });
      response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
      return response;
    }

    const courses = await fetchAndParseCourses();
    cachedCourses = courses;
    cacheTimestamp = now;

    const response = NextResponse.json({ success: true, courses });
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    // Serve stale cache on error if available
    if (cachedCourses) {
      const response = NextResponse.json({ success: true, courses: cachedCourses });
      response.headers.set('Cache-Control', 'public, s-maxage=60');
      return response;
    }
    return NextResponse.json({ success: true, courses: [] });
  }
}
