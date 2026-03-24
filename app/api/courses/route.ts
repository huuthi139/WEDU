import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getAllCourses } from '@/lib/supabase/courses';
import { getCachedCourses, setCachedCourses } from '@/lib/supabase/courses-cache';
import { courseRowToFrontend, type CourseRow } from '@/lib/types';

/**
 * GET /api/courses
 *
 * Data flow (priority order):
 * 1. In-memory cache (30s TTL) — fastest, avoids external calls
 * 2. Supabase courses table — ONLY source of truth
 *
 * No fallback data — Supabase is the sole source of truth.
 * If Supabase is unreachable, return an error so issues are visible.
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
    const rows = await getAllCourses();
    const courses = rows.map(row => courseRowToFrontend(row as unknown as CourseRow));

    setCachedCourses(courses);

    const response = NextResponse.json({ success: true, courses });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    // Serve stale cache on error if available
    const cached = getCachedCourses();
    if (cached.courses && cached.courses.length > 0) {
      const response = NextResponse.json({ success: true, courses: cached.courses });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách khóa học', courses: [] },
      { status: 500 },
    );
  }
}
