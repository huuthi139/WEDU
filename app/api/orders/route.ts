import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/supabase/orders';
import { grantCourseAccess } from '@/lib/supabase/course-access';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { getSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rowData, orderId, courseItems } = body;

    // Validate order data
    if (!rowData || !Array.isArray(rowData) || rowData.length === 0 || rowData.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu đơn hàng không hợp lệ' },
        { status: 400 }
      );
    }

    // Sanitize each cell to prevent injection
    const sanitizedRowData = rowData.map((cell: unknown) => {
      if (typeof cell !== 'string') return cell;
      if (cell.length > 1000) return cell.slice(0, 1000);
      if (/^[=+\-@\t\r]/.test(cell)) return "'" + cell;
      return cell;
    });

    // Save to Supabase (source of truth)
    const order = await createOrder({
      orderId: orderId || `WP-${crypto.randomUUID()}`,
      email: String(sanitizedRowData[3] || ''),
      name: String(sanitizedRowData[2] || ''),
      phone: String(sanitizedRowData[4] || ''),
      courseNames: String(sanitizedRowData[5] || ''),
      courseIds: String(sanitizedRowData[6] || ''),
      total: Number(sanitizedRowData[7]) || 0,
      paymentMethod: String(sanitizedRowData[8] || ''),
    });

    // Grant course access for purchased courses
    const session = await getSession();
    if (session && order) {
      const supabase = getSupabaseAdmin();
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.email.toLowerCase())
        .limit(1)
        .single();

      if (user) {
        // Parse courseIds from order data
        const courseIdsStr = String(sanitizedRowData[6] || '');
        const courseIds = courseIdsStr.split(',').map((id: string) => id.trim()).filter(Boolean);

        // If courseItems are provided with access_tier info, use them
        if (Array.isArray(courseItems) && courseItems.length > 0) {
          for (const item of courseItems) {
            const tier = item.accessTier || 'premium';
            await grantCourseAccess({
              userId: user.id,
              courseId: item.courseId,
              accessTier: tier,
              source: 'order',
            });

            // Also create order_item with access_tier
            await supabase.from('order_items').insert({
              order_id: order.id,
              course_id: item.courseId,
              course_title: item.courseTitle || '',
              access_tier: tier,
              price: item.price || 0,
            });
          }
        } else {
          // Fallback: grant premium access for all courses in order
          for (const courseId of courseIds) {
            await grantCourseAccess({
              userId: user.id,
              courseId,
              accessTier: 'premium',
              source: 'order',
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, orderId: orderId || order?.order_id });
  } catch (error) {
    console.error('Order API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process order' },
      { status: 500 }
    );
  }
}
