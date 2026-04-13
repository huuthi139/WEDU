/**
 * Supabase order data operations
 * Handles orders in Supabase (orders table)
 */
import { getSupabaseAdmin } from './client';

export interface SupabaseOrder {
  id?: string;
  order_id: string;
  user_email: string;
  user_name: string;
  user_phone: string;
  course_names: string;
  course_ids: string;
  total: number;
  payment_method: string;
  status: string;
  note: string;
  created_at: string;
}

/**
 * Create a new order
 */
export async function createOrder(order: {
  orderId: string;
  email: string;
  name: string;
  phone: string;
  courseNames: string;
  courseIds: string;
  total: number;
  paymentMethod: string;
}): Promise<SupabaseOrder | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('orders')
    .insert({
      order_id: order.orderId,
      user_email: order.email.toLowerCase(),
      user_name: order.name,
      user_phone: order.phone,
      course_names: order.courseNames,
      course_ids: order.courseIds,
      total: order.total,
      payment_method: order.paymentMethod,
      status: 'Đang chờ xử lý',
      note: '',
      created_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase Orders] Create failed:', error.message);
    return null;
  }
  return data as SupabaseOrder;
}

/**
 * Get all orders (admin) with optional pagination
 */
export async function getAllOrders(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<{ orders: SupabaseOrder[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (opts?.status) {
    query = query.eq('status', opts.status);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.warn('[Supabase Orders] Failed to fetch:', error.message);
    return { orders: [], total: 0 };
  }
  return { orders: (data || []) as SupabaseOrder[], total: count || 0 };
}

/**
 * Get orders by user email
 */
export async function getOrdersByUser(email: string): Promise<SupabaseOrder[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_email', email.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase Orders] Failed to fetch user orders:', error.message);
    return [];
  }
  return (data || []) as SupabaseOrder[];
}

/**
 * Update order status
 * When status = 'Hoàn thành': calculate 10% commission for referrer
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('order_id', orderId)
    .select('order_id, user_id, total')
    .single();

  if (error) {
    console.error('[Supabase Orders] Update status failed:', error.message);
    return false;
  }

  // Commission on completion
  if (status === 'Hoàn thành' && order?.user_id && order.total > 0) {
    try {
      await creditAffiliateCommission(supabase, order.user_id, order.order_id, order.total);
    } catch (err) {
      console.error('[Affiliate] Commission failed:', err);
    }
  }

  return true;
}

/**
 * Credit 10% affiliate commission to referrer's wallet
 */
async function creditAffiliateCommission(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  buyerUserId: string,
  orderId: string,
  orderTotal: number,
) {
  // Find referrer
  const { data: referral } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referee_id', buyerUserId)
    .single();

  if (!referral) return; // no referrer

  const commission = Math.round(orderTotal * 0.1); // 10%

  // Upsert wallet (create if not exists)
  const { data: wallet } = await supabase
    .from('affiliate_wallets')
    .upsert(
      { user_id: referral.referrer_id, balance: 0, total_earned: 0 },
      { onConflict: 'user_id' },
    )
    .select('id, balance, total_earned')
    .single();

  if (!wallet) return;

  // Check duplicate: don't credit same order twice
  const { data: existing } = await supabase
    .from('affiliate_transactions')
    .select('id')
    .eq('wallet_id', wallet.id)
    .eq('order_id', orderId)
    .eq('type', 'commission')
    .maybeSingle();

  if (existing) return; // already credited

  // Update wallet balance
  await supabase
    .from('affiliate_wallets')
    .update({
      balance: wallet.balance + commission,
      total_earned: wallet.total_earned + commission,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  // Insert transaction
  await supabase
    .from('affiliate_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'commission',
      amount: commission,
      order_id: orderId,
      description: `Hoa hồng 10% đơn hàng ${orderId}`,
    });
}
