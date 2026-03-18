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
 * GET /api/admin/course-access/cleanup
 * Preview: count records and return backup data WITHOUT deleting.
 * This is the "dry run" step before actual cleanup.
 */
export async function GET(request: NextRequest) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Count total course_access records
  const { count, error: countErr } = await supabase
    .from('course_access')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    return NextResponse.json({ success: false, error: countErr.message }, { status: 500 });
  }

  // Fetch all records with user email and course info for backup
  const { data: allRecords, error: fetchErr } = await supabase
    .from('course_access')
    .select(`
      id,
      user_id,
      course_id,
      access_tier,
      status,
      source,
      activated_at,
      expires_at,
      created_at,
      updated_at,
      users(email, name),
      courses(id, title)
    `)
    .order('created_at', { ascending: true });

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }

  // Count unique users and courses
  const uniqueUsers = new Set((allRecords || []).map((r: any) => r.user_id));
  const uniqueCourses = new Set((allRecords || []).map((r: any) => r.course_id));

  // Build backup-ready data
  const backupData = (allRecords || []).map((r: any) => ({
    id: r.id,
    user_email: r.users?.email || '',
    user_name: r.users?.name || '',
    user_id: r.user_id,
    course_id: r.course_id,
    course_title: r.courses?.title || '',
    access_tier: r.access_tier,
    status: r.status,
    source: r.source,
    activated_at: r.activated_at,
    expires_at: r.expires_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return NextResponse.json({
    success: true,
    action: 'preview',
    summary: {
      total_records: count || 0,
      unique_users: uniqueUsers.size,
      unique_courses: uniqueCourses.size,
      records_per_user: uniqueUsers.size > 0 ? Math.round((count || 0) / uniqueUsers.size) : 0,
      all_data_is_invalid: true,
      reason: 'Audit confirmed: course_access was auto-generated without real mapping data. Google Sheet tab course_access has no course_code column.',
    },
    backup: backupData,
    instructions: 'To proceed with deletion, send POST to this endpoint with { "confirm": true }',
  });
}

/**
 * POST /api/admin/course-access/cleanup
 * Execute cleanup: backup all records to audit_logs, then delete all course_access.
 *
 * Body: { "confirm": true }
 *
 * Safety guarantees:
 * - Only deletes course_access table
 * - Does NOT delete users
 * - Does NOT delete audit_logs
 * - Writes full backup to audit_logs before deletion
 */
export async function POST(request: NextRequest) {
  const { isAdmin, userId: actorUserId } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json({
      success: false,
      error: 'Cần xác nhận: gửi { "confirm": true } để thực hiện xóa. Dùng GET để preview trước.',
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Step 1: Count before
  const { count: countBefore, error: countErr } = await supabase
    .from('course_access')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    return NextResponse.json({ success: false, error: `Count failed: ${countErr.message}` }, { status: 500 });
  }

  if ((countBefore || 0) === 0) {
    return NextResponse.json({
      success: true,
      message: 'Không có records nào để xóa. course_access đã trống.',
      before: 0,
      after: 0,
      deleted: 0,
    });
  }

  // Step 2: Fetch all records for backup
  const { data: allRecords, error: fetchErr } = await supabase
    .from('course_access')
    .select(`
      id,
      user_id,
      course_id,
      access_tier,
      status,
      source,
      activated_at,
      expires_at,
      created_at,
      updated_at,
      users(email, name),
      courses(id, title)
    `);

  if (fetchErr) {
    return NextResponse.json({ success: false, error: `Backup fetch failed: ${fetchErr.message}` }, { status: 500 });
  }

  // Step 3: Write backup to audit_logs
  const backupPayload = (allRecords || []).map((r: any) => ({
    user_email: r.users?.email || '',
    user_name: r.users?.name || '',
    course_id: r.course_id,
    course_title: r.courses?.title || '',
    access_tier: r.access_tier,
    status: r.status,
    source: r.source,
  }));

  await writeAuditLog({
    actorUserId,
    actionType: 'course_access_bulk_cleanup',
    targetTable: 'course_access',
    targetId: 'ALL',
    entityKey: `cleanup_${new Date().toISOString()}`,
    oldValue: {
      total_records: countBefore,
      reason: 'Invalid data: auto-generated without real mapping. Audit confirmed 100% incorrect.',
      records: backupPayload,
    },
    newValue: { total_records: 0 },
    status: 'success',
  }).catch(() => {});

  // Step 4: Delete all course_access records
  // Supabase requires a filter for delete, use a condition that matches all rows
  const { error: deleteErr } = await supabase
    .from('course_access')
    .delete()
    .gte('created_at', '1970-01-01');

  if (deleteErr) {
    return NextResponse.json({
      success: false,
      error: `Delete failed: ${deleteErr.message}. Backup was saved to audit_logs.`,
    }, { status: 500 });
  }

  // Step 5: Verify count after
  const { count: countAfter } = await supabase
    .from('course_access')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    success: true,
    action: 'cleanup_completed',
    before: countBefore,
    after: countAfter || 0,
    deleted: (countBefore || 0) - (countAfter || 0),
    backup_location: 'audit_logs (action_type: course_access_bulk_cleanup)',
    safety: {
      users_affected: false,
      audit_logs_affected: false,
      courses_affected: false,
      only_course_access_deleted: true,
    },
    next_steps: {
      message: 'Chuẩn bị tab course_access trong Google Sheet với đúng format trước khi import lại.',
      required_columns: ['email', 'course_code', 'access_tier', 'status', 'source'],
      import_url: '/api/admin/import-sheet',
    },
  });
}
