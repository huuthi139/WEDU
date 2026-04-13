import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/client';

const VALID_TIERS = ['free', 'premium', 'vip'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const accessTier = typeof body.accessTier === 'string' ? body.accessTier.toLowerCase() : '';

  if (!VALID_TIERS.includes(accessTier)) {
    return NextResponse.json(
      { success: false, error: `accessTier phải là: ${VALID_TIERS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('course_access')
    .update({ access_tier: accessTier, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, user_id, course_id, access_tier, updated_at')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.code === 'PGRST116' ? 'Không tìm thấy course_access' : error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, data });
}
