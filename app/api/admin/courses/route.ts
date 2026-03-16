import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole, hasAdminAccess } from '@/lib/utils/auth';
import { invalidateCoursesCache } from '@/lib/supabase/courses-cache';

/** Verify admin or sub_admin access via JWT session cookie */
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return false;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return false;
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    return hasAdminAccess(role);
  } catch {
    return false;
  }
}

function forbidden() {
  return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
}

/** GET - List all courses (admin) */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !hasAdminAccess(clientRole)) return forbidden();
  }

  try {
    const { getAllCoursesAdmin } = await import('@/lib/supabase/courses');
    const courses = await getAllCoursesAdmin();
    return NextResponse.json({ success: true, courses });
  } catch (err) {
    console.error('[Admin Courses] GET error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách khóa học' }, { status: 500 });
  }
}

/** POST - Create or update a course */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !hasAdminAccess(clientRole)) return forbidden();
  }

  try {
    const body = await request.json();
    const { upsertCourse } = await import('@/lib/supabase/courses');

    const course = await upsertCourse({
      id: body.id || String(Date.now()),
      title: body.title || '',
      description: body.description || '',
      thumbnail: body.thumbnail || '',
      instructor: body.instructor || 'WEDU',
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

    // Invalidate public courses cache so next fetch returns fresh data
    invalidateCoursesCache();

    return NextResponse.json({ success: true, course });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    console.error('[Admin Courses] POST error:', message);
    return NextResponse.json({ success: false, error: `Không thể lưu khóa học: ${message}` }, { status: 500 });
  }
}

/** DELETE - Soft delete a course */
export async function DELETE(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !hasAdminAccess(clientRole)) return forbidden();
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID khóa học' }, { status: 400 });
    }

    const { deleteCourse } = await import('@/lib/supabase/courses');
    const success = await deleteCourse(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Không thể xóa khóa học' }, { status: 500 });
    }

    // Invalidate public courses cache
    invalidateCoursesCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Admin Courses] DELETE error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
