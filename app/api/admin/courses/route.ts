import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { invalidateCoursesCache } from '@/lib/supabase/courses-cache';
import { logger } from '@/lib/telemetry/logger';

function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 },
  );
}

/** GET - List all courses (admin) */
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const { getAllCoursesAdmin } = await import('@/lib/supabase/courses');
    const courses = await getAllCoursesAdmin();
    return NextResponse.json({ success: true, courses });
  } catch (err) {
    logger.error('admin.courses.get', 'Failed to list courses', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách khóa học' }, { status: 500 });
  }
}

/** POST - Create or update a course */
export async function POST(request: NextRequest) {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const body = await request.json();
    const { upsertCourse } = await import('@/lib/supabase/courses');

    const course = await upsertCourse({
      id: body.id || String(Date.now()),
      title: body.title || '',
      description: body.description || '',
      thumbnail: body.thumbnail || '',
      instructor: body.instructor || 'WePower Academy',
      category: body.category || '',
      price: Number(body.price) || 0,
      original_price: body.originalPrice ? Number(body.originalPrice) : undefined,
      rating: Number(body.rating) || 0,
      reviews_count: Number(body.reviewsCount) || 0,
      enrollments_count: Number(body.enrollmentsCount) || 0,
      duration: Number(body.duration) || 0,
      lessons_count: Number(body.lessonsCount) || 0,
      badge: body.badge || undefined,
      member_level: body.memberLevel || 'Free',
      is_active: body.isActive !== false,
    });

    invalidateCoursesCache();

    logger.info('admin.courses.upsert', 'Course saved', { courseId: course?.id, actor: adminUser.email });

    return NextResponse.json({ success: true, course });
  } catch (err) {
    logger.error('admin.courses.upsert', 'Failed to save course', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Không thể lưu khóa học' }, { status: 500 });
  }
}

/** DELETE - Soft delete a course */
export async function DELETE(request: NextRequest) {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID khóa học' }, { status: 422 });
    }

    const { deleteCourse } = await import('@/lib/supabase/courses');
    const success = await deleteCourse(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Không thể xóa khóa học' }, { status: 500 });
    }

    invalidateCoursesCache();

    logger.info('admin.courses.delete', 'Course deleted', { courseId: id, actor: adminUser.email });

    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    logger.error('admin.courses.delete', 'Failed to delete course', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
