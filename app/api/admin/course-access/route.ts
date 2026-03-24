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
 * GET /api/admin/course-access
 * List course_access records with filters and pagination.
 *
 * Query params:
 * - email: filter by user email (partial match)
 * - course_id: filter by course id
 * - access_tier: filter by tier (free/premium/vip)
 * - status: filter by status (active/expired/cancelled)
 * - page: page number (default 1)
 * - limit: items per page (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const email = searchParams.get('email') || '';
  const courseId = searchParams.get('course_id') || '';
  const accessTier = searchParams.get('access_tier') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  try {
    // Build query with joins to get user email/name and course title
    let query = supabase
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
        users!inner(id, email, name),
        courses!inner(id, title)
      `, { count: 'exact' });

    // Apply filters
    if (email) {
      query = query.ilike('users.email', `%${email}%`);
    }
    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    if (accessTier && ['free', 'premium', 'vip'].includes(accessTier)) {
      query = query.eq('access_tier', accessTier);
    }
    if (status && ['active', 'expired', 'cancelled'].includes(status)) {
      query = query.eq('status', status);
    }

    // Pagination
    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Format response
    const records = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      user_email: row.users?.email || '',
      user_name: row.users?.name || '',
      course_id: row.course_id,
      course_title: row.courses?.title || '',
      access_tier: row.access_tier,
      status: row.status,
      source: row.source,
      activated_at: row.activated_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/course-access
 * Update a course_access record (upgrade, revoke, edit).
 *
 * Body:
 * {
 *   id: string           // course_access id
 *   access_tier?: string  // new tier
 *   status?: string       // new status (active/expired/cancelled)
 *   expires_at?: string   // new expiry date
 * }
 */
export async function PATCH(request: NextRequest) {
  const { isAdmin, userId: actorUserId } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const id = body.id as string;
  const revokeUserId = body.user_id as string;
  const revokeCourseId = body.course_id as string;
  const action = body.action as string;

  // Support revoke by user_id + course_id
  if (action === 'revoke' && revokeUserId && revokeCourseId) {
    const { data: record } = await supabase
      .from('course_access')
      .select('id')
      .eq('user_id', revokeUserId)
      .eq('course_id', revokeCourseId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('course_access')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', record.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    writeAuditLog({
      actorUserId,
      actionType: 'course_access_revoke',
      targetTable: 'course_access',
      targetId: record.id,
      entityKey: `${revokeUserId}::${revokeCourseId}`,
      oldValue: { status: 'active' },
      newValue: { status: 'cancelled' },
      status: 'success',
    }).catch(() => {});

    return NextResponse.json({ success: true });
  }

  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  // Fetch existing record
  const { data: existing, error: fetchErr } = await supabase
    .from('course_access')
    .select('id, user_id, course_id, access_tier, status, source, activated_at, expires_at')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.access_tier && ['free', 'premium', 'vip'].includes(body.access_tier as string)) {
    updates.access_tier = body.access_tier;
  }
  if (body.status && ['active', 'expired', 'cancelled'].includes(body.status as string)) {
    updates.status = body.status;
    if (body.status === 'cancelled') {
      updates.revoked_at = new Date().toISOString();
    }
  }
  if (body.expires_at !== undefined) {
    updates.expires_at = body.expires_at || null;
  }

  const { error } = await supabase
    .from('course_access')
    .update(updates)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Audit log
  const actionType = updates.access_tier && updates.access_tier !== existing.access_tier
    ? 'course_access_upgrade'
    : updates.status === 'cancelled'
    ? 'course_access_revoke'
    : 'course_access_upsert';

  writeAuditLog({
    actorUserId,
    actionType,
    targetTable: 'course_access',
    targetId: id,
    entityKey: `${existing.user_id}::${existing.course_id}`,
    oldValue: {
      access_tier: existing.access_tier,
      status: existing.status,
      expires_at: existing.expires_at,
    },
    newValue: updates as Record<string, unknown>,
    status: 'success',
  }).catch(() => {});

  return NextResponse.json({ success: true, updated: updates });
}

/**
 * POST /api/admin/course-access
 * Grant course access to a user. Auto-resolves access_tier from user's member_level.
 *
 * Body:
 * {
 *   user_id: string
 *   course_id: string
 * }
 */
export async function POST(request: NextRequest) {
  const { isAdmin, userId: actorUserId } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const userId = body.user_id as string;
  const courseId = body.course_id as string;
  if (!userId || !courseId) {
    return NextResponse.json({ success: false, error: 'user_id and course_id are required' }, { status: 400 });
  }

  try {
    // Look up user's member_level to determine access_tier
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, member_level')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Map member_level → access_tier
    const levelToTier: Record<string, string> = {
      Free: 'free',
      Premium: 'premium',
      VIP: 'vip',
    };
    const accessTier = levelToTier[user.member_level] || 'free';

    // Check for existing active access
    const { data: existing } = await supabase
      .from('course_access')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      // Reactivate if cancelled/expired, or update tier
      const { error } = await supabase
        .from('course_access')
        .update({ access_tier: accessTier, status: 'active', activated_at: now, updated_at: now })
        .eq('id', existing.id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('course_access')
        .insert({
          user_id: userId,
          course_id: courseId,
          access_tier: accessTier,
          status: 'active',
          source: 'manual',
          activated_at: now,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // Auto-upgrade member_level when granting course access
    // Free + any course → Premium, Premium + vip tier course → VIP
    const LEVEL_RANK: Record<string, number> = { Free: 0, Premium: 1, VIP: 2 };
    const currentLevel = user.member_level || 'Free';
    const currentRank = LEVEL_RANK[currentLevel] ?? 0;

    // Look up course's member_level (tier) to determine upgrade
    const { data: course } = await supabase
      .from('courses')
      .select('member_level')
      .eq('id', courseId)
      .single();

    let newLevel = currentLevel;
    if (currentRank === 0) {
      // Free user + any course → Premium
      newLevel = 'Premium';
    }
    if (course?.member_level === 'VIP' || accessTier === 'vip') {
      // Adding VIP tier course → VIP
      newLevel = 'VIP';
    }

    if (newLevel !== currentLevel) {
      await supabase
        .from('users')
        .update({ member_level: newLevel, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    writeAuditLog({
      actorUserId,
      actionType: 'course_access_upsert',
      targetTable: 'course_access',
      targetId: `${userId}::${courseId}`,
      entityKey: `${userId}::${courseId}`,
      oldValue: undefined,
      newValue: { access_tier: accessTier, status: 'active', source: 'manual', member_level: newLevel },
      status: 'success',
    }).catch(() => {});

    return NextResponse.json({ success: true, access_tier: accessTier, member_level: newLevel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
