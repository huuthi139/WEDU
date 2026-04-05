import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getSupabaseAdmin } from '@/lib/supabase/client';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean }> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return { isAdmin: false };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return { isAdmin: false };
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    return { isAdmin: hasAdminAccess(role) };
  } catch {
    return { isAdmin: false };
  }
}

/**
 * GET /api/admin/users/[id]/courses
 * Returns all course_access records for a user, joined with courses table.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('course_access')
    .select('id, course_id, access_tier, activated_at, expires_at, status, source, courses(id, title)')
    .eq('user_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const courses = (data || []).map((ca: Record<string, unknown>) => {
    const course = ca.courses as { id: string; title: string } | null;
    return {
      course_access_id: ca.id,
      course_id: ca.course_id,
      title: course?.title || `Course ${ca.course_id}`,
      access_tier: ca.access_tier,
      activated_at: ca.activated_at,
      expires_at: ca.expires_at,
      status: ca.status,
      source: ca.source,
    };
  });

  return NextResponse.json({ success: true, courses });
}
