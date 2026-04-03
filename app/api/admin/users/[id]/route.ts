import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { writeAuditLog } from '@/lib/telemetry/audit';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return { isAdmin: false };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return { isAdmin: false };
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    const userId = (payload as { userId?: string }).userId;
    return { isAdmin: hasAdminAccess(role), userId };
  } catch {
    return { isAdmin: false };
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user profile: name, phone, member_level, status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAdmin, userId: actorUserId } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fetch existing user
  const { data: existing, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, phone, member_level, status, email')
    .eq('id', id)
    .limit(1)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy user' }, { status: 404 });
  }

  // Build update object from allowed fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.phone === 'string') updates.phone = body.phone.trim();
  if (typeof body.member_level === 'string' && ['Free', 'Premium', 'VIP'].includes(body.member_level as string)) {
    updates.member_level = body.member_level;
  }
  if (typeof body.status === 'string' && ['active', 'inactive', 'banned'].includes(body.status as string)) {
    updates.status = body.status;
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  // Audit log
  writeAuditLog({
    actorUserId,
    actionType: 'user_update',
    targetTable: 'users',
    targetId: id,
    entityKey: existing.email,
    oldValue: { name: existing.name, phone: existing.phone, member_level: existing.member_level, status: existing.status },
    newValue: updates as Record<string, unknown>,
    status: 'success',
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user + all course_access records. Orders are kept for history.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAdmin, userId: actorUserId } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch user info for audit
  const { data: existing } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', id)
    .limit(1)
    .single();

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy user' }, { status: 404 });
  }

  // Delete course_access records first
  await supabase.from('course_access').delete().eq('user_id', id);

  // Delete user
  const { error: deleteErr } = await supabase.from('users').delete().eq('id', id);

  if (deleteErr) {
    return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 });
  }

  // Audit log
  writeAuditLog({
    actorUserId,
    actionType: 'user_delete',
    targetTable: 'users',
    targetId: id,
    entityKey: existing.email,
    oldValue: { email: existing.email, name: existing.name },
    status: 'success',
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
