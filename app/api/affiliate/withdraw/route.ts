import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSupabaseAdmin } from '@/lib/supabase/client';

/**
 * POST /api/affiliate/withdraw
 * Create a withdrawal request (deducts from balance)
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const amount = typeof body.amount === 'number' ? body.amount : 0;

  if (amount <= 0) {
    return NextResponse.json({ success: false, error: 'Số tiền không hợp lệ' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Get wallet
  const { data: wallet } = await supabase
    .from('affiliate_wallets')
    .select('id, balance')
    .eq('user_id', session.userId)
    .single();

  if (!wallet) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy ví' }, { status: 404 });
  }

  if (wallet.balance < amount) {
    return NextResponse.json({ success: false, error: 'Số dư không đủ' }, { status: 400 });
  }

  // Deduct balance
  await supabase
    .from('affiliate_wallets')
    .update({
      balance: wallet.balance - amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  // Create withdrawal transaction (paid=false → admin sẽ mark paid sau)
  const { data: tx } = await supabase
    .from('affiliate_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'withdrawal',
      amount,
      description: 'Yêu cầu rút tiền',
      paid: false,
    })
    .select('id, type, amount, description, paid, created_at')
    .single();

  return NextResponse.json({ success: true, transaction: tx });
}
