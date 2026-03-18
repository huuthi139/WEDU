import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/supabase/orders';

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rowData, orderId } = body;

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

    return NextResponse.json({ success: true, orderId: orderId || order?.order_id });
  } catch (error) {
    console.error('Order API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process order' },
      { status: 500 }
    );
  }
}
