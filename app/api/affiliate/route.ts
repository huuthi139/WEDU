import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate
 * Returns wallet, transactions, referral count for current user
 */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Get or create wallet
  const { data: wallet } = await supabase
    .from('affiliate_wallets')
    .upsert(
      { user_id: session.userId, balance: 0, total_earned: 0 },
      { onConflict: 'user_id' },
    )
    .select('id, balance, total_earned')
    .single();

  if (!wallet) {
    return NextResponse.json({ success: false, error: 'Wallet error' }, { status: 500 });
  }

  // Get transactions + referral count in parallel
  const [{ data: transactions }, { count: referralCount }] = await Promise.all([
    supabase
      .from('affiliate_transactions')
      .select('id, type, amount, order_id, description, paid, created_at')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', session.userId),
  ]);

  return NextResponse.json({
    success: true,
    wallet: {
      balance: wallet.balance,
      totalEarned: wallet.total_earned,
    },
    transactions: transactions || [],
    referralCount: referralCount || 0,
    refCode: session.userId,
  });
}
