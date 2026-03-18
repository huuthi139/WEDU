import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getAllCourses } from '@/lib/supabase/courses';
import { FALLBACK_COURSES } from '@/lib/fallback-data';
import { getCachedCourses, setCachedCourses } from '@/lib/supabase/courses-cache';
import { courseRowToFrontend, type CourseRow } from '@/lib/types';

/**
 * GET /api/courses
 *
 * Data flow (priority order):
 * 1. In-memory cache (30s TTL) — fastest, avoids external calls
 * 2. Supabase courses table — ONLY source of truth
 * 3. Fallback embedded data — offline / error resilience
 *
 * Phase 4.7: Google Sheets removed from runtime. Supabase is sole source of truth.
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

    // 2. Fetch from Supabase (only source of truth)
    let courses: any[] = [];
    try {
      const rows = await getAllCourses();
      if (rows.length > 0) {
        courses = rows.map(row => courseRowToFrontend(row as unknown as CourseRow));
      }
    } catch (err) {
      console.warn('[Courses] Supabase fetch failed:', err instanceof Error ? err.message : String(err));
    }

    // 3. Fallback to embedded data
    if (courses.length === 0) {
      console.warn('[Courses] Supabase empty, using fallback data');
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
