import { NextResponse } from 'next/server';

// Force dynamic - không cache static lúc build
export const dynamic = 'force-dynamic';

import { getScriptUrl, getSheetId } from '@/lib/config';
import { FALLBACK_COURSES } from '@/lib/fallback-data';

/**
 * Parse a number that may be formatted with locale separators or currency symbols.
 * Handles: "1.868.000 đ", "1,868,000", "4,8", "868000", "4.8", ""
 */
function parseFormattedNumber(val: string | undefined | null): number {
  if (!val) return 0;
  const s = val.toString().trim();
  if (!s) return 0;

  // Remove currency symbols, spaces, and non-numeric chars except . and ,
  const cleaned = s.replace(/[^\d.,\-]/g, '').trim();
  if (!cleaned) return 0;

  // Pattern: dots as thousand separators (e.g., "1.868.000" or "1.500.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, '')) || 0;
  }

  // Pattern: commas as thousand separators (e.g., "1,868,000")
  if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, '')) || 0;
  }

  // Pattern: comma as decimal separator (e.g., "4,8" or "4,85")
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    return Number(cleaned.replace(',', '.')) || 0;
  }

  // Default: try as-is, then try removing commas, then dots
  const direct = Number(cleaned);
  if (!isNaN(direct)) return direct;

  const noComma = Number(cleaned.replace(/,/g, ''));
  if (!isNaN(noComma)) return noComma;

  return 0;
}

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
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Map CSV row to course object
function rowToCourse(cols: string[], chapterStats: Record<string, { lessonsCount: number; duration: number }>) {
  const id = cols[COL.ID] || '';
  const price = parseFormattedNumber(cols[COL.PRICE]);
  const originalPrice = cols[COL.ORIGINAL_PRICE] ? parseFormattedNumber(cols[COL.ORIGINAL_PRICE]) : undefined;
  const rating = parseFormattedNumber(cols[COL.RATING]);

  const real = chapterStats[id];
  const sheetLessons = parseFormattedNumber(cols[COL.LESSONS_COUNT]);
  const sheetDuration = parseFormattedNumber(cols[COL.DURATION]);
  const sheetEnrollments = parseFormattedNumber(cols[COL.ENROLLMENTS_COUNT]);

  return {
    id,
    thumbnail: cols[COL.THUMBNAIL] || '',
    title: cols[COL.TITLE] || '',
    description: cols[COL.DESCRIPTION] || '',
    instructor: cols[COL.INSTRUCTOR] || 'WEDU',
    price,
    originalPrice,
    rating,
    reviewsCount: parseFormattedNumber(cols[COL.REVIEWS_COUNT]),
    enrollmentsCount: sheetEnrollments,
    duration: real ? real.duration : sheetDuration,
    lessonsCount: real ? real.lessonsCount : sheetLessons,
    isFree: price === 0,
    badge: cols[COL.BADGE] || undefined,
    category: cols[COL.CATEGORY] || '',
    memberLevel: cols[COL.MEMBER_LEVEL] || 'Free',
  };
}

/** Fetch courses from Supabase */
async function fetchSupabaseCourses(): Promise<any[]> {
  try {
    const { getAllCourses } = await import('@/lib/supabase/courses');
    const courses = await getAllCourses();
    return courses.map(c => ({
      id: c.id,
      thumbnail: c.thumbnail || '',
      title: c.title || '',
      description: c.description || '',
      instructor: c.instructor || 'WEDU',
      price: c.price || 0,
      originalPrice: c.original_price || undefined,
      rating: c.rating || 0,
      reviewsCount: c.reviews_count || 0,
      enrollmentsCount: c.enrollments_count || 0,
      duration: c.duration || 0,
      lessonsCount: c.lessons_count || 0,
      isFree: (c.price || 0) === 0,
      badge: c.badge || undefined,
      category: c.category || '',
      memberLevel: c.member_level || 'Free',
    }));
  } catch (err) {
    console.warn('[Courses] Supabase unavailable:', err instanceof Error ? err.message : err);
    return [];
  }
}

async function fetchAndParseCourses() {
  // Method 1: Try Supabase first (source of truth for admin-managed courses)
  const supabaseCourses = await fetchSupabaseCourses();
  if (supabaseCourses.length > 0) {
    return supabaseCourses;
  }

  // Method 2: Google Sheets CSV export (fallback / legacy)
  try {
    const [coursesRes, chapterStats] = await Promise.all([
      fetch(
        `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq?tqx=out:csv&sheet=Courses`,
        { cache: 'no-store' }
      ),
      fetchChapterStats(),
    ]);

    const csv = await coursesRes.text();
    const rows = parseCSVRows(csv);

    if (rows.length > 0) {
      const sheetCourses = rows
        .filter(cols => cols[COL.ID] && cols[COL.TITLE])
        .map(cols => rowToCourse(cols, chapterStats));

      // Sync Google Sheets courses to Supabase in background
      syncSheetCoursesToSupabase(sheetCourses).catch(() => {});

      return sheetCourses;
    }
  } catch (csvErr) {
    console.warn('[Courses] Google Sheets CSV unavailable:', csvErr instanceof Error ? csvErr.message : csvErr);
  }

  // Method 3: Google Apps Script fallback
  try {
    const scriptUrl = getScriptUrl();
    const res = await fetch(`${scriptUrl}?action=getCourses`, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();

    if (data.success && Array.isArray(data.courses)) {
      return data.courses.map((c: Record<string, string | number>) => ({
        id: String(c.ID || c.id || ''),
        thumbnail: String(c.Thumbnail || c.thumbnail || ''),
        title: String(c.Title || c.title || ''),
        description: String(c.Description || c.description || ''),
        instructor: String(c.Instructor || c.instructor || 'WEDU'),
        price: Number(c.Price || c.price || 0),
        originalPrice: c.OriginalPrice || c.originalPrice ? Number(c.OriginalPrice || c.originalPrice) : undefined,
        rating: Number(c.Rating || c.rating || 0),
        reviewsCount: Number(c.ReviewsCount || c.reviewsCount || 0),
        enrollmentsCount: Number(c.EnrollmentsCount || c.enrollmentsCount || 0),
        duration: Number(c.Duration || c.duration || 0),
        lessonsCount: Number(c.LessonsCount || c.lessonsCount || 0),
        isFree: Number(c.Price || c.price || 0) === 0,
        badge: String(c.Badge || c.badge || '') || undefined,
        category: String(c.Category || c.category || ''),
        memberLevel: String(c.MemberLevel || c.memberLevel || 'Free'),
      }));
    }
  } catch (scriptErr) {
    console.warn('[Courses] Google Apps Script unavailable:', scriptErr instanceof Error ? scriptErr.message : scriptErr);
  }

  return [];
}

/** Sync Google Sheets courses to Supabase (one-time migration, non-blocking) */
async function syncSheetCoursesToSupabase(courses: any[]) {
  try {
    const { bulkUpsertCourses } = await import('@/lib/supabase/courses');
    const count = await bulkUpsertCourses(courses.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      instructor: c.instructor,
      category: c.category,
      price: c.price,
      original_price: c.originalPrice,
      rating: c.rating,
      reviews_count: c.reviewsCount,
      enrollments_count: c.enrollmentsCount,
      duration: c.duration,
      lessons_count: c.lessonsCount,
      badge: c.badge,
      member_level: c.memberLevel,
    })));
    if (count > 0) {
      console.log(`[Courses] Synced ${count} courses from Google Sheets to Supabase`);
    }
  } catch (err) {
    console.warn('[Courses] Supabase sync failed:', err instanceof Error ? err.message : err);
  }
}

function isDnsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('EAI_AGAIN') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo');
}

export async function GET() {
  try {
    const now = Date.now();

    // Serve from cache if still fresh
    if (cachedCourses && now - cacheTimestamp < CACHE_TTL_MS) {
      const response = NextResponse.json({ success: true, courses: cachedCourses });
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return response;
    }

    let courses = await fetchAndParseCourses();

    // Fallback to embedded data if external sources returned nothing
    if (courses.length === 0) {
      console.warn('[Courses] External sources returned empty, using fallback data');
      courses = FALLBACK_COURSES;
    }

    cachedCourses = courses;
    cacheTimestamp = now;

    const response = NextResponse.json({ success: true, courses });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    // Serve stale cache on error if available
    if (cachedCourses) {
      const response = NextResponse.json({ success: true, courses: cachedCourses });
      response.headers.set('Cache-Control', 'public, s-maxage=60');
      return response;
    }
    // Last resort: use fallback data
    return NextResponse.json({ success: true, courses: FALLBACK_COURSES });
  }
}
