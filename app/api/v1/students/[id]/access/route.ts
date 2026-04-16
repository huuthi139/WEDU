import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { grantCourseAccess, revokeCourseAccess } from '@/lib/supabase/course-access';
import { getUserById } from '@/lib/supabase/users';

/**
 * POST /api/v1/students/[id]/access
 * Grant course access to a student.
 *
 * Body:
 * {
 *   course_id: string
 *   access_tier?: "free" | "premium" | "vip" (default: based on user member_level)
 *   expires_at?: string (ISO date, optional)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { id: userId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const courseId = typeof body.course_id === 'string' ? body.course_id.trim() : '';
  if (!courseId) {
    return NextResponse.json({ success: false, error: 'course_id is required' }, { status: 400 });
  }

  // Verify user exists
  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Determine access tier
  const LEVEL_TO_TIER: Record<string, string> = { Free: 'free', Premium: 'premium', VIP: 'vip' };
  const requestedTier = typeof body.access_tier === 'string' && ['free', 'premium', 'vip'].includes(body.access_tier)
    ? body.access_tier
    : LEVEL_TO_TIER[user.member_level] || 'free';

  const expiresAt = typeof body.expires_at === 'string' ? body.expires_at : null;

  try {
    const record = await grantCourseAccess({
      userId,
      courseId,
      accessTier: requestedTier as 'free' | 'premium' | 'vip',
      source: 'api',
      expiresAt,
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Failed to grant access' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/students/[id]/access
 * Revoke course access from a student.
 *
 * Body:
 * {
 *   course_id: string
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { id: userId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const courseId = typeof body.course_id === 'string' ? body.course_id.trim() : '';
  if (!courseId) {
    return NextResponse.json({ success: false, error: 'course_id is required' }, { status: 400 });
  }

  try {
    const ok = await revokeCourseAccess(userId, courseId);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to revoke access or record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
