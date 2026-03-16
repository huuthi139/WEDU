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
 * Get all orders (admin)
 */
export async function getAllOrders(): Promise<SupabaseOrder[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase Orders] Failed to fetch:', error.message);
    return [];
  }
  return (data || []) as SupabaseOrder[];
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
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('order_id', orderId);

  if (error) {
    console.error('[Supabase Orders] Update status failed:', error.message);
    return false;
  }
  return true;
}
