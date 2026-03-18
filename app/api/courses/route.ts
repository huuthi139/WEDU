import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getAllCourses } from '@/lib/supabase/courses';
import { FALLBACK_COURSES } from '@/lib/fallback-data';
import { getCachedCourses, setCachedCourses } from '@/lib/supabase/courses-cache';
import { courseRowToFrontend, type CourseRow } from '@/lib/types';
import { fetchCoursesFromSheet } from '@/lib/googleSheets/courses';

/**
 * GET /api/courses
 *
 * Data flow (priority order):
 * 1. In-memory cache (30s TTL) — fastest, avoids external calls
 * 2. Supabase courses table — PRIMARY source of truth
 * 3. Google Sheets CSV — secondary live source
 * 4. Fallback embedded data — offline / error resilience
 */
export async function GET() {
  try {
    // 1. Serve from cache if still fresh
    const cached = getCachedCourses();
    if (cached.fresh && cached.courses) {
      const response = NextResponse.json({ success: true, courses: cached.courses });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    // 2. Fetch from Supabase (primary source of truth)
    let courses: any[] = [];
    try {
      const rows = await getAllCourses();
      if (rows.length > 0) {
        courses = rows.map(row => courseRowToFrontend(row as unknown as CourseRow));
      }
    } catch (err) {
      console.warn('[Courses] Supabase fetch failed:', err instanceof Error ? err.message : String(err));
    }

    // 3. Try Google Sheets if Supabase returned nothing
    if (courses.length === 0) {
      const sheetId = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
      if (sheetId) {
        try {
          const sheetCourses = await fetchCoursesFromSheet(sheetId);
          if (sheetCourses.length > 0) {
            courses = sheetCourses;
            console.log(`[Courses] Using ${sheetCourses.length} courses from Google Sheets`);
          }
        } catch (err) {
          console.warn('[Courses] Google Sheets fetch failed:', err instanceof Error ? err.message : String(err));
        }
      }
    }

    // 4. Fallback to embedded data
    if (courses.length === 0) {
      console.warn('[Courses] All sources empty, using fallback data');
      courses = FALLBACK_COURSES;
    }

    setCachedCourses(courses);

    const response = NextResponse.json({ success: true, courses });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    // Serve stale cache on error
    const cached = getCachedCourses();
    if (cached.courses) {
      const response = NextResponse.json({ success: true, courses: cached.courses });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }
    return NextResponse.json({ success: true, courses: FALLBACK_COURSES });
  }
}
