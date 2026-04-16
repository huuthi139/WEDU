import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/students
 * List students with filter, pagination, and search.
 *
 * Query params:
 * - search: filter by name, email, or phone (partial match)
 * - member_level: filter by Free | Premium | VIP
 * - status: filter by active | inactive | banned
 * - page: page number (default 1)
 * - limit: items per page (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get('search') || '';
  const memberLevel = searchParams.get('member_level') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('users')
      .select('id, email, name, phone, role, member_level, status, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      const s = `%${search}%`;
      query = query.or(`email.ilike.${s},name.ilike.${s},phone.ilike.${s}`);
    }
    if (memberLevel && ['Free', 'Premium', 'VIP'].includes(memberLevel)) {
      query = query.eq('member_level', memberLevel);
    }
    if (status && ['active', 'inactive', 'banned'].includes(status)) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
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
