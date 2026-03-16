/**
 * Google Sheets utilities
 * NOTE: Google Sheet is now used only for backup sync (Supabase → Sheet).
 * All primary data reads come from Supabase.
 *
 * These functions are kept for:
 * - Legacy order submission (submitOrder from client)
 * - Any remaining direct Sheet interactions
 */

interface OrderPayload {
  name: string;
  email: string;
  phone: string;
  paymentMethod: string;
  courses: { id: string; title: string; price: number }[];
  total: number;
  timestamp: string;
}

function generateOrderId(): string {
  return `WP-${crypto.randomUUID()}`;
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    bank_transfer: 'Chuyển khoản ngân hàng',
    momo: 'Ví MoMo',
    vnpay: 'VNPay',
  };
  return map[method] || method;
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export async function submitOrder(order: OrderPayload): Promise<boolean> {
  const orderId = generateOrderId();
  const courseNames = order.courses.map(c => c.title).join(', ');
  const courseIds = order.courses.map(c => c.id).join(', ');

  const rowData = [
    formatTimestamp(order.timestamp),
    orderId,
    order.name,
    order.email,
    order.phone,
    courseNames,
    courseIds,
    order.total.toString(),
    formatPaymentMethod(order.paymentMethod),
    'Đang chờ xử lý',
    '',
  ];

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowData, orderId }),
    });

    if (!res.ok) {
      throw new Error(`Order API returned ${res.status}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to submit order:', error);
    throw error;
  }
}

export { generateOrderId, formatPaymentMethod, formatTimestamp };
export type { OrderPayload };
