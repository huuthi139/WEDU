import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchCoursesFromSheet } from '@/lib/googleSheets/courses';
import { FALLBACK_COURSES } from '@/lib/fallback-data';
import { getCachedCourses, setCachedCourses } from '@/lib/supabase/courses-cache';

/**
 * GET /api/courses
 *
 * Data flow (priority order):
 * 1. In-memory cache (30s TTL) — fastest, avoids external calls
 * 2. Google Sheets CSV export — PRIMARY source of truth
 * 3. Fallback embedded data — offline / error resilience
 *
 * Architecture:
 *   Google Sheets (Courses tab)
 *       ↓ CSV export
 *   /api/courses (parse + transform)
 *       ↓ cache
 *   Frontend (CoursesContext)
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

    // 2. Fetch from Google Sheets (primary source of truth)
    const sheetId = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
    let courses: any[] = [];

    if (sheetId) {
      courses = await fetchCoursesFromSheet(sheetId);
    }

    // 3. Fallback to embedded data if Google Sheets returned nothing
    if (courses.length === 0) {
      console.warn('[Courses] Google Sheets returned empty, using fallback data');
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
