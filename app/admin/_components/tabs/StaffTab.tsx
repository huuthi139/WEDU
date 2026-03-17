'use client';

import { useState, useEffect, useCallback } from 'react';
import { getRoleLabel, ASSIGNABLE_ROLES } from '@/lib/utils/auth';

interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  memberLevel: string;
  createdAt: string;
}

interface StaffTabProps {
  isMainAdmin: boolean;
}

export function StaffTab({ isMainAdmin }: StaffTabProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'staff_only'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setStaff(data.data?.staff || data.staff || []);
      } else {
        setError(data.error?.message || data.error || 'Không thể tải danh sách');
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleRoleChange = async (email: string, newRole: string) => {
    setUpdating(email);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        // Update local state
        setStaff(prev => prev.map(s => s.email === email ? { ...s, role: newRole } : s));
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.error);
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setUpdating(null);
    }
  };

  const filteredStaff = staff.filter(s => {
    // Search filter
    const matchesSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());

    // Role filter
    const matchesFilter = filter === 'all' || s.role !== 'user';

    return matchesSearch && matchesFilter;
  });

  const staffCount = staff.filter(s => s.role !== 'user' && s.role !== 'admin').length;
  const adminCount = staff.filter(s => s.role === 'admin').length;
  const subAdminCount = staff.filter(s => s.role === 'sub_admin').length;
  const instructorCount = staff.filter(s => s.role === 'instructor').length;

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30';
      case 'sub_admin': return 'bg-teal/10 text-teal border border-teal/20';
      case 'instructor': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      default: return 'bg-white/5 text-gray-400 border border-white/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Tổng nhân sự</p>
          <p className="text-2xl font-bold text-white">{staffCount}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Admin</p>
          <p className="text-2xl font-bold text-gold">{adminCount}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Admin phụ</p>
          <p className="text-2xl font-bold text-teal">{subAdminCount}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Giảng viên</p>
          <p className="text-2xl font-bold text-purple-400">{instructorCount}</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400">
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5 pl-10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-teal text-white' : 'bg-white/[0.03] text-gray-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            Tất cả ({staff.length})
          </button>
          <button
            onClick={() => setFilter('staff_only')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'staff_only' ? 'bg-teal text-white' : 'bg-white/[0.03] text-gray-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            Nhân sự ({staffCount + adminCount})
          </button>
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <div className="text-center py-12">
          <svg className="w-8 h-8 text-teal animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 text-sm">Đang tải...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 text-sm">Không tìm thấy nhân sự nào</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nhân sự</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SĐT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Quyền hiện tại</th>
                  {isMainAdmin && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Thay đổi quyền</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(member => (
                  <tr key={member.id || member.email} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          member.role === 'admin' ? 'bg-gold/30' :
                          member.role === 'sub_admin' ? 'bg-teal/30' :
                          member.role === 'instructor' ? 'bg-purple-500/30' :
                          'bg-white/10'
                        }`}>
                          {member.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm text-white font-medium">{member.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{member.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{member.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${roleBadgeClass(member.role)}`}>
                        {getRoleLabel(member.role)}
                      </span>
                    </td>
                    {isMainAdmin && (
                      <td className="px-4 py-3">
                        {member.role === 'admin' ? (
                          <span className="text-xs text-gray-600 italic">Admin chính</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={member.role}
                              onChange={e => handleRoleChange(member.email, e.target.value)}
                              disabled={updating === member.email}
                              className="bg-dark border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal disabled:opacity-50 cursor-pointer"
                            >
                              {ASSIGNABLE_ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            {updating === member.email && (
                              <svg className="w-4 h-4 text-teal animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/[0.04]">
            {filteredStaff.map(member => (
              <div key={member.id || member.email} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      member.role === 'admin' ? 'bg-gold/30' :
                      member.role === 'sub_admin' ? 'bg-teal/30' :
                      member.role === 'instructor' ? 'bg-purple-500/30' :
                      'bg-white/10'
                    }`}>
                      {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{member.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${roleBadgeClass(member.role)}`}>
                    {getRoleLabel(member.role)}
                  </span>
                </div>
                {isMainAdmin && member.role !== 'admin' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Đổi quyền:</span>
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member.email, e.target.value)}
                      disabled={updating === member.email}
                      className="flex-1 bg-dark border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal disabled:opacity-50"
                    >
                      {ASSIGNABLE_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {updating === member.email && (
                      <svg className="w-4 h-4 text-teal animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-2">Phân quyền nhân sự</h4>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${roleBadgeClass('admin')}`}>Admin</span>
            <span>Toàn quyền quản trị hệ thống, phân quyền nhân sự</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${roleBadgeClass('sub_admin')}`}>Admin phụ</span>
            <span>Quản lý khóa học, học viên, đơn hàng (không phân quyền nhân sự)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${roleBadgeClass('instructor')}`}>Giảng viên</span>
            <span>Quản lý nội dung khóa học được giao</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${roleBadgeClass('user')}`}>Học viên</span>
            <span>Người dùng thông thường, chỉ xem và học</span>
          </div>
        </div>
      </div>
    </div>
  );
}
