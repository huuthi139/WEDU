'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface CourseAccessRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  course_id: string;
  course_title: string;
  access_tier: string;
  status: string;
  source: string;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  premium: 'bg-teal/20 text-teal border-teal/30',
  vip: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  expired: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch { return dateStr; }
}

export default function CourseAccessPage() {
  const [records, setRecords] = useState<CourseAccessRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [emailFilter, setEmailFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Edit modal
  const [editing, setEditing] = useState<CourseAccessRecord | null>(null);
  const [editTier, setEditTier] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editExpires, setEditExpires] = useState('');
  const [saving, setSaving] = useState(false);

  // Cleanup state
  const [cleanupPreview, setCleanupPreview] = useState<{
    total_records: number;
    unique_users: number;
    unique_courses: number;
    records_per_user: number;
  } | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    before: number;
    after: number;
    deleted: number;
  } | null>(null);
  const [cleanupConfirmText, setCleanupConfirmText] = useState('');

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (emailFilter) params.set('email', emailFilter);
      if (tierFilter) params.set('access_tier', tierFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/course-access?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
        setPagination(data.pagination);
      } else {
        setError(data.error || 'Lỗi tải dữ liệu');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [emailFilter, tierFilter, statusFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords(1);
  };

  const handleEdit = (record: CourseAccessRecord) => {
    setEditing(record);
    setEditTier(record.access_tier);
    setEditStatus(record.status);
    setEditExpires(record.expires_at ? record.expires_at.split('T')[0] : '');
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/course-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editing.id,
          access_tier: editTier,
          status: editStatus,
          expires_at: editExpires || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditing(null);
        fetchRecords(pagination.page);
      } else {
        alert(data.error || 'Lỗi cập nhật');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupPreview = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/admin/course-access/cleanup', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setCleanupPreview(data.summary);
      } else {
        setError(data.error || 'Lỗi preview cleanup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleCleanupExecute = async () => {
    if (cleanupConfirmText !== 'XOA TAT CA') return;
    setCleanupLoading(true);
    try {
      const res = await fetch('/api/admin/course-access/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (data.success) {
        setCleanupResult({ before: data.before, after: data.after, deleted: data.deleted });
        setCleanupPreview(null);
        setCleanupConfirmText('');
        fetchRecords(1);
      } else {
        setError(data.error || 'Lỗi cleanup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý Course Access</h1>
            <p className="text-sm text-gray-400 mt-1">Xem và chỉnh sửa quyền truy cập khóa học</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors">
              ← Admin
            </Link>
            <Link href="/admin/import" className="px-4 py-2 bg-teal text-white rounded-lg text-sm hover:bg-teal/80 transition-colors">
              Import
            </Link>
          </div>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="text"
                value={emailFilter}
                onChange={e => setEmailFilter(e.target.value)}
                placeholder="Tìm theo email..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Access Tier</label>
              <select
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-teal/50"
              >
                <option value="">Tất cả</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-teal/50"
              >
                <option value="">Tất cả</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-teal text-white rounded-lg text-sm font-semibold hover:bg-teal/80 transition-colors"
            >
              Tìm kiếm
            </button>
          </div>
        </form>

        {/* Cleanup Section */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-red-400">Cleanup dữ liệu sai</h3>
              <p className="text-xs text-gray-400 mt-0.5">Xóa toàn bộ course_access invalid. Backup tự động lưu vào audit_logs.</p>
            </div>
            {!cleanupPreview && !cleanupResult && (
              <button
                onClick={handleCleanupPreview}
                disabled={cleanupLoading}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {cleanupLoading ? 'Đang kiểm tra...' : 'Preview Cleanup'}
              </button>
            )}
          </div>

          {cleanupPreview && (
            <div className="space-y-3">
              <div className="bg-black/30 rounded-lg p-3 text-sm">
                <p className="text-red-300 font-semibold mb-2">Sẽ xóa:</p>
                <ul className="space-y-1 text-gray-300 text-xs">
                  <li>• <span className="text-white font-mono">{cleanupPreview.total_records}</span> course_access records</li>
                  <li>• <span className="text-white font-mono">{cleanupPreview.unique_users}</span> users × <span className="text-white font-mono">{cleanupPreview.unique_courses}</span> courses = mỗi user có <span className="text-white font-mono">{cleanupPreview.records_per_user}</span> records</li>
                  <li>• Lý do: dữ liệu auto-generated, không có mapping thật từ Google Sheet</li>
                  <li className="text-green-400">• KHÔNG xóa users, courses, hoặc audit_logs</li>
                  <li className="text-green-400">• Backup đầy đủ sẽ lưu vào audit_logs trước khi xóa</li>
                </ul>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={cleanupConfirmText}
                  onChange={e => setCleanupConfirmText(e.target.value)}
                  placeholder='Gõ "XOA TAT CA" để xác nhận'
                  className="flex-1 px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={handleCleanupExecute}
                  disabled={cleanupConfirmText !== 'XOA TAT CA' || cleanupLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {cleanupLoading ? 'Đang xóa...' : 'Xóa toàn bộ'}
                </button>
                <button
                  onClick={() => { setCleanupPreview(null); setCleanupConfirmText(''); }}
                  className="px-3 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {cleanupResult && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
              <p className="text-green-400 font-semibold mb-1">Cleanup hoàn tất</p>
              <ul className="space-y-0.5 text-xs text-gray-300">
                <li>• Trước: <span className="text-white font-mono">{cleanupResult.before}</span> records</li>
                <li>• Sau: <span className="text-white font-mono">{cleanupResult.after}</span> records</li>
                <li>• Đã xóa: <span className="text-white font-mono">{cleanupResult.deleted}</span> records</li>
                <li>• Backup: audit_logs (action_type: course_access_bulk_cleanup)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {pagination.total} bản ghi
              {loading && <span className="ml-2 text-gray-400 animate-pulse">Đang tải...</span>}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Email</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Tên</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Khóa học</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Tier</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Source</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Kích hoạt</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Hết hạn</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase">Cập nhật</th>
                  <th className="text-left p-3 text-xs font-semibold text-gray-400 uppercase w-20"></th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500 text-sm">
                      Không có bản ghi nào.
                    </td>
                  </tr>
                )}
                {records.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="p-3 text-sm text-white font-mono">{r.user_email}</td>
                    <td className="p-3 text-sm text-gray-300">{r.user_name}</td>
                    <td className="p-3 text-sm text-gray-300 max-w-[200px] truncate">{r.course_title}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${TIER_COLORS[r.access_tier] || TIER_COLORS.free}`}>
                        {r.access_tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[r.status] || STATUS_COLORS.active}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-400">{r.source}</td>
                    <td className="p-3 text-xs text-gray-400">{formatDate(r.activated_at)}</td>
                    <td className="p-3 text-xs text-gray-400">{formatDate(r.expires_at)}</td>
                    <td className="p-3 text-xs text-gray-400">{formatDate(r.updated_at)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleEdit(r)}
                        className="px-2 py-1 bg-white/5 text-gray-300 rounded text-xs hover:bg-white/10 transition-colors"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchRecords(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded text-xs disabled:opacity-30 hover:bg-white/10"
                >
                  ← Trước
                </button>
                <button
                  onClick={() => fetchRecords(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded text-xs disabled:opacity-30 hover:bg-white/10"
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-white mb-4">Chỉnh sửa Course Access</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">User</label>
                  <p className="text-sm text-white">{editing.user_email}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Khóa học</label>
                  <p className="text-sm text-white">{editing.course_title}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Access Tier</label>
                  <select
                    value={editTier}
                    onChange={e => setEditTier(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    value={editExpires}
                    onChange={e => setEditExpires(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 px-4 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-teal text-white rounded-lg text-sm font-semibold hover:bg-teal/80 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
