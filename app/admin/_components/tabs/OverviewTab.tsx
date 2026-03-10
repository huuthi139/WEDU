'use client';

import type { MemberLevel } from '@/lib/mockData';
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

interface OverviewTabProps {
  totalRevenue: number;
  studentsCount: number;
  coursesCount: number;
  ordersCount: number;
  vipCount: number;
  premiumCount: number;
  freeCount: number;
  recentOrders: AdminOrder[];
  onViewAllOrders: () => void;
  LevelBadge: React.ComponentType<{ level: MemberLevel }>;
}

export function OverviewTab({
  totalRevenue,
  studentsCount,
  coursesCount,
  ordersCount,
  vipCount,
  premiumCount,
  freeCount,
  recentOrders,
  onViewAllOrders,
  LevelBadge,
}: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-teal/20 to-red/5 border border-teal/20 rounded-xl p-5">
          <div className="w-10 h-10 bg-teal/20 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white mb-1">{formatPrice(totalRevenue)}</div>
          <p className="text-xs text-gray-400">Doanh thu</p>
        </div>

        <div className="bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 rounded-xl p-5">
          <div className="w-10 h-10 bg-gold/20 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white mb-1">{studentsCount}</div>
          <p className="text-xs text-gray-400">Học viên</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white mb-1">{coursesCount}</div>
          <p className="text-xs text-gray-400">Khóa học</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white mb-1">{ordersCount}</div>
          <p className="text-xs text-gray-400">Đơn hàng</p>
        </div>
      </div>

      {/* Member Level Distribution */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-5">Phân bổ hạng thành viên</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <LevelBadge level="VIP" />
                <span className="text-sm text-gray-400">{vipCount} học viên</span>
              </div>
              <span className="text-sm text-white font-bold">{studentsCount ? Math.round(vipCount / studentsCount * 100) : 0}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-amber-500 rounded-full" style={{ width: `${studentsCount ? vipCount / studentsCount * 100 : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <LevelBadge level="Premium" />
                <span className="text-sm text-gray-400">{premiumCount} học viên</span>
              </div>
              <span className="text-sm text-white font-bold">{studentsCount ? Math.round(premiumCount / studentsCount * 100) : 0}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-teal rounded-full" style={{ width: `${studentsCount ? premiumCount / studentsCount * 100 : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <LevelBadge level="Free" />
                <span className="text-sm text-gray-400">{freeCount} học viên</span>
              </div>
              <span className="text-sm text-white font-bold">{studentsCount ? Math.round(freeCount / studentsCount * 100) : 0}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gray-500 rounded-full" style={{ width: `${studentsCount ? freeCount / studentsCount * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders (overview) */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Đơn hàng gần đây</h3>
          <button onClick={onViewAllOrders} className="text-sm text-teal hover:underline">Xem tất cả</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Mã đơn</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Khách hàng</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Khóa học</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Số tiền</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.slice(0, 5).map(order => (
                <tr key={order.id} className="border-b border-white/[0.06]/50 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm text-white font-mono">{order.id}</td>
                  <td className="p-4">
                    <div className="text-sm text-white">{order.name}</div>
                    <div className="text-xs text-gray-500">{order.email}</div>
                  </td>
                  <td className="p-4 text-sm text-gray-300 max-w-[200px] truncate">{order.course}</td>
                  <td className="p-4 text-sm text-gold font-semibold">{formatPrice(order.amount)}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'Hoàn thành' ? 'bg-green-500/10 text-green-400' :
                      order.status === 'Đang chờ' ? 'bg-gold/10 text-gold' :
                      'bg-teal/10 text-teal'
                    }`}>{order.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
