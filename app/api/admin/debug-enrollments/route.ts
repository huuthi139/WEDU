import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { invalidateCoursesCache, debugCacheState } from '@/lib/supabase/courses-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debug-enrollments
 * Debug endpoint to trace where enrollmentsCount values come from.
 * Requires admin auth.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Query all data sources in parallel
  const [
    courseAccessAll,
    courseAccessActive,
    enrollmentsAll,
    coursesRaw,
  ] = await Promise.all([
    supabase.from('course_access').select('id, course_id, user_id, status', { count: 'exact' }),
    supabase.from('course_access').select('id, course_id, status', { count: 'exact' }).eq('status', 'active'),
    supabase.from('enrollments').select('id, course_id, user_email', { count: 'exact' }),
    supabase.from('courses').select('id, title, enrollments_count').eq('is_active', true),
  ]);

  // Check in-memory cache state (including stale data)
  const cached = debugCacheState();
  const cacheEnrollments = cached.courses
    ? cached.courses.map((c: any) => ({ id: c.id, title: c.title, enrollmentsCount: c.enrollmentsCount }))
    : null;

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    raw_db: {
      course_access_total: courseAccessAll.count ?? courseAccessAll.data?.length ?? 'error',
      course_access_active: courseAccessActive.count ?? courseAccessActive.data?.length ?? 'error',
      course_access_sample: (courseAccessAll.data || []).slice(0, 10),
      enrollments_total: enrollmentsAll.count ?? enrollmentsAll.data?.length ?? 'error',
      enrollments_sample: (enrollmentsAll.data || []).slice(0, 10),
      courses_enrollments_count_column: (coursesRaw.data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        enrollments_count_in_db: c.enrollments_count,
      })),
    },
    in_memory_cache: {
      has_cached_courses: !!cached.courses,
      is_fresh: cached.fresh,
      age_ms: cached.ageMs,
      cached_enrollments: cacheEnrollments,
    },
    errors: {
      course_access: courseAccessAll.error?.message || null,
      enrollments: enrollmentsAll.error?.message || null,
      courses: coursesRaw.error?.message || null,
    },
  });
}

/**
 * POST /api/admin/debug-enrollments
 * Force invalidate cache and return fresh data.
 */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Force invalidate the in-memory cache
  invalidateCoursesCache();

  // Now fetch fresh data through the normal path
  const { getAllCourses } = await import('@/lib/supabase/courses');
  const rows = await getAllCourses();

  return NextResponse.json({
    success: true,
    message: 'Cache invalidated. Fresh data fetched from Supabase.',
    courses: rows.map(c => ({
      id: c.id,
      title: c.title,
      enrollments_count: c.enrollments_count,
    })),
  });
}
