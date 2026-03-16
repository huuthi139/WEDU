import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getAllOrders, updateOrderStatus } from '@/lib/supabase/orders';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return false;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return false;
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    return hasAdminAccess(role);
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/orders
 * Fetch all orders from Supabase for admin dashboard
 */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const orders = await getAllOrders();

  return NextResponse.json({
    success: true,
    orders: orders.map(o => ({
      id: o.order_id,
      name: o.user_name,
      email: o.user_email,
      phone: o.user_phone,
      course: o.course_names,
      courseIds: o.course_ids,
      amount: o.total,
      status: o.status,
      date: o.created_at,
      method: o.payment_method,
      note: o.note,
    })),
  });
}

/**
 * PATCH /api/admin/orders
 * Update order status
 */
export async function PATCH(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const { orderId, status } = await request.json();
  if (!orderId || !status) {
    return NextResponse.json({ success: false, error: 'Missing orderId or status' }, { status: 400 });
  }

  const ok = await updateOrderStatus(orderId, status);
  return NextResponse.json({ success: ok });
}
