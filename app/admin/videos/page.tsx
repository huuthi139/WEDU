'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface Video {
  id: string;
  title: string;
  source: 'bunny' | 'youtube';
  video_id: string;
  library_id: string | null;
  url: string | null;
  duration: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface VideoFormData {
  title: string;
  source: 'bunny' | 'youtube';
  video_id: string;
  library_id: string;
  duration: string;
  thumbnail_url: string;
}

const emptyForm: VideoFormData = {
  title: '',
  source: 'bunny',
  video_id: '',
  library_id: '',
  duration: '',
  thumbnail_url: '',
};

function generatePreviewUrl(form: VideoFormData): string {
  if (form.source === 'bunny' && form.library_id && form.video_id) {
    return `https://iframe.mediadelivery.net/embed/${form.library_id}/${form.video_id}`;
  }
  if (form.source === 'youtube' && form.video_id) {
    return `https://www.youtube.com/watch?v=${form.video_id}`;
  }
  return '';
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [form, setForm] = useState<VideoFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/videos?${params}`);
      const data = await res.json();
      if (data.success) {
        setVideos(data.videos);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const openAdd = () => {
    setEditingVideo(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (video: Video) => {
    setEditingVideo(video);
    setForm({
      title: video.title,
      source: video.source,
      video_id: video.video_id,
      library_id: video.library_id || '',
      duration: video.duration || '',
      thumbnail_url: video.thumbnail_url || '',
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.video_id.trim() || !form.source) {
      setError('Vui lòng điền đầy đủ: Title, Source, Video ID');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingVideo) {
        // PATCH
        const res = await fetch(`/api/admin/videos/${editingVideo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            source: form.source,
            video_id: form.video_id,
            library_id: form.source === 'bunny' ? form.library_id : null,
            duration: form.duration || null,
            thumbnail_url: form.thumbnail_url || null,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Lỗi cập nhật');
      } else {
        // POST
        const res = await fetch('/api/admin/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            source: form.source,
            video_id: form.video_id,
            library_id: form.source === 'bunny' ? form.library_id : null,
            duration: form.duration || null,
            thumbnail_url: form.thumbnail_url || null,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Lỗi tạo video');
      }
      setModalOpen(false);
      fetchVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/videos/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDeleteTarget(null);
      fetchVideos();
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const previewUrl = generatePreviewUrl(form);

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-10 h-10 bg-teal rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Kho Video</h1>
              <p className="text-sm text-gray-400">{total} video</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-teal hover:bg-teal/80 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm video
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Tìm theo tiêu đề..."
            className="flex-1 max-w-md h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
          />
          <button
            onClick={handleSearch}
            className="h-11 px-4 bg-white/5 hover:bg-white/10 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Title</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Source</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Video ID</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Library ID</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Duration</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">Đang tải...</td>
                  </tr>
                ) : videos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">Chưa có video nào</td>
                  </tr>
                ) : (
                  videos.map((video) => (
                    <tr key={video.id} className="border-b border-white/[0.06]/50 hover:bg-white/[0.02]">
                      <td className="p-4 text-sm text-white font-medium max-w-[300px] truncate">{video.title}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          video.source === 'bunny'
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {video.source}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-400 font-mono max-w-[200px] truncate">{video.video_id}</td>
                      <td className="p-4 text-sm text-gray-400 font-mono">{video.library_id || '—'}</td>
                      <td className="p-4 text-sm text-gray-400">{video.duration || '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(video)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title="Chỉnh sửa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(video)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                            title="Xoá"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/[0.06]">
              <p className="text-sm text-gray-400">
                Trang {page}/{totalPages} ({total} video)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Trước
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {editingVideo ? 'Chỉnh sửa video' : 'Thêm video mới'}
              </h3>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Nhập tiêu đề video"
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                    autoFocus
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Source *</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value as 'bunny' | 'youtube' })}
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal transition-colors"
                  >
                    <option value="bunny">Bunny</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>

                {/* Video ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Video ID *</label>
                  <input
                    type="text"
                    value={form.video_id}
                    onChange={(e) => setForm({ ...form, video_id: e.target.value })}
                    placeholder={form.source === 'bunny' ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : 'dQw4w9WgXcQ'}
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors font-mono text-sm"
                  />
                </div>

                {/* Library ID (bunny only) */}
                {form.source === 'bunny' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Library ID</label>
                    <input
                      type="text"
                      value={form.library_id}
                      onChange={(e) => setForm({ ...form, library_id: e.target.value })}
                      placeholder="123456"
                      className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors font-mono text-sm"
                    />
                  </div>
                )}

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Duration</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="12:34"
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                  />
                </div>

                {/* Preview URL */}
                {previewUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Preview URL</label>
                    <div className="p-3 bg-white/5 border border-gray-700 rounded-lg text-xs text-teal font-mono break-all">
                      {previewUrl}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm font-semibold"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 px-5 rounded-lg bg-teal hover:bg-teal/80 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : editingVideo ? 'Cập nhật' : 'Thêm video'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2">Xoá video?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Bạn có chắc muốn xoá <span className="text-white font-medium">{deleteTarget.title}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm font-semibold"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-10 px-5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Đang xoá...' : 'Xoá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
