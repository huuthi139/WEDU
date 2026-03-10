'use client';

import { formatPrice } from '@/lib/utils';

interface AdminOrder {
  id: string;
  name: string;
  email: string;
  course: string;
  amount: number;
  status: string;
  date: string;
  method: string;
}

interface OrdersTabProps {
  recentOrders: AdminOrder[];
  updateOrderStatus: (orderId: string, status: 'Hoàn thành' | 'Đang chờ' | 'Đang xử lý') => void;
}

export function OrdersTab({
  recentOrders,
  updateOrderStatus,
}: OrdersTabProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="p-6 border-b border-white/[0.06]">
        <h3 className="text-lg font-bold text-white">Đơn hàng ({recentOrders.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Mã đơn</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Khách hàng</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Khóa học</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Số tiền</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Phương thức</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Trạng thái</th>
              <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map(order => (
              <tr key={order.id} className="border-b border-white/[0.06]/50 hover:bg-white/[0.02]">
                <td className="p-4 text-sm text-white font-mono">{order.id}</td>
                <td className="p-4">
                  <div className="text-sm text-white">{order.name}</div>
                  <div className="text-xs text-gray-500">{order.email}</div>
                </td>
                <td className="p-4 text-sm text-gray-300 max-w-[200px] truncate">{order.course}</td>
                <td className="p-4 text-sm text-gold font-semibold">{formatPrice(order.amount)}</td>
                <td className="p-4 text-sm text-gray-400">{order.method}</td>
                <td className="p-4">
                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value as 'Hoàn thành' | 'Đang chờ' | 'Đang xử lý')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border-none cursor-pointer focus:outline-none ${
                      order.status === 'Hoàn thành' ? 'bg-green-500/10 text-green-400' :
                      order.status === 'Đang chờ' ? 'bg-gold/10 text-gold' :
                      'bg-teal/10 text-teal'
                    }`}
                  >
                    <option value="Đang chờ">Đang chờ</option>
                    <option value="Đang xử lý">Đang xử lý</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                  </select>
                </td>
                <td className="p-4 text-sm text-gray-400">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentOrders.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400">Chưa có đơn hàng nào</p>
            <p className="text-gray-500 text-sm mt-1">Đơn hàng sẽ xuất hiện khi học viên thanh toán</p>
          </div>
        )}
      </div>
    </div>
  );
}
