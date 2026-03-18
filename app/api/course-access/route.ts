import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getCourseAccessByUser } from '@/lib/supabase/course-access';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import type { CourseAccess, AccessTier } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/course-access
 * Returns all course access records for the authenticated user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Get user ID from session
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.email.toLowerCase())
    .limit(1)
    .single();

  if (!user) {
    return NextResponse.json({ success: true, accessList: [] });
  }

  const rows = await getCourseAccessByUser(user.id);

  const accessList: CourseAccess[] = rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    accessTier: row.access_tier as AccessTier,
    source: row.source as any,
    status: row.status as any,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ success: true, accessList });
}
