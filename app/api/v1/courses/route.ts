import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { getAllCourses } from '@/lib/supabase/courses';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/courses
 * List all active courses.
 */
export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const courses = await getAllCourses();

    const data = courses.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      instructor: c.instructor,
      category: c.category,
      price: c.price,
      original_price: c.original_price ?? null,
      member_level: c.member_level,
      lessons_count: c.lessons_count,
      enrollments_count: c.enrollments_count,
      duration: c.duration,
      rating: c.rating,
      is_active: c.is_active,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
