import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/client';

/**
 * POST /api/admin/fix-prices
 *
 * Fixes corrupted course prices caused by the Google Sheet import bug
 * where Vietnamese number formatting ("1.868.000") was parsed as 1.868
 * by parseFloat (which stops at the second dot).
 *
 * Strategy: any price under 10000 is almost certainly corrupted
 * (real prices are in millions of VND). Multiply by 1,000,000 and round.
 */
export async function POST(_req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find all courses with suspiciously low prices (< 10000 means likely corrupted)
  const { data: courses, error: fetchErr } = await supabase
    .from('courses')
    .select('id, title, price, original_price')
    .lt('price', 10000)
    .gt('price', 0);

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  }

  if (!courses || courses.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No corrupted prices found (all prices >= 10000 or = 0)',
      fixed: 0,
    });
  }

  const results: Array<{ id: string; title: string; oldPrice: number; newPrice: number }> = [];

  for (const c of courses) {
    // Multiply by 1,000,000 and round to nearest 1000 to reconstruct the original value
    const newPrice = Math.round(c.price * 1000000 / 1000) * 1000;
    const updateData: Record<string, number> = { price: newPrice };

    // Also fix original_price if it looks corrupted
    if (c.original_price && c.original_price > 0 && c.original_price < 10000) {
      updateData.original_price = Math.round(c.original_price * 1000000 / 1000) * 1000;
    }

    const { error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', c.id);

    if (!error) {
      results.push({
        id: c.id,
        title: c.title,
        oldPrice: c.price,
        newPrice,
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Fixed ${results.length} course prices`,
    fixed: results.length,
    details: results,
  });
}
