'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface ImportStats {
  total: number;
  valid: number;
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: ImportError[];
}

interface ImportResult {
  success: boolean;
  dryRun: boolean;
  upgradeOnly: boolean;
  results: Record<string, ImportStats>;
  summary: string;
  error?: string;
}

export default function ImportPage() {
  // Config
  const [tables, setTables] = useState<string[]>(['courses', 'students', 'course_access', 'orders']);
  const [dryRun, setDryRun] = useState(true);
  const [upgradeOnly, setUpgradeOnly] = useState(true);
  const [sheetId, setSheetId] = useState('');

  // State
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleTable = (table: string) => {
    setTables(prev =>
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const handleImport = useCallback(async () => {
    if (tables.length === 0) {
      setError('Chọn ít nhất 1 bảng để import');
      return;
    }
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, unknown> = { tables, dryRun, upgradeOnly };
      if (sheetId.trim()) body.sheetId = sheetId.trim();

      const res = await fetch('/api/admin/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data: ImportResult = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Import thất bại');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setRunning(false);
    }
  }, [tables, dryRun, upgradeOnly, sheetId]);

  const totalStats = result ? Object.values(result.results).reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      valid: acc.valid + s.valid,
      inserted: acc.inserted + s.inserted,
      updated: acc.updated + s.updated,
      skipped: acc.skipped + s.skipped,
      invalid: acc.invalid + s.invalid,
      errorCount: acc.errorCount + s.errors.length,
    }),
    { total: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, invalid: 0, errorCount: 0 }
  ) : null;

  return (
    <div className="min-h-screen bg-dark">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Import từ Google Sheets</h1>
            <p className="text-sm text-gray-400 mt-1">Import dữ liệu từ Google Sheets vào Supabase</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors">
              ← Admin
            </Link>
            <Link href="/admin/course-access" className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors">
              Course Access
            </Link>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-2">Hướng dẫn</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p>Google Sheet cần có các tab: <code className="text-teal">students</code>, <code className="text-teal">courses</code>, <code className="text-teal">course_access</code>, <code className="text-teal">orders</code> (tùy chọn)</p>
            <p><strong>students</strong>: email (bắt buộc), full_name, phone, system_role, status, password</p>
            <p><strong>courses</strong>: course_code (bắt buộc), title (bắt buộc), slug, status, visibility, short_description</p>
            <p><strong>course_access</strong>: email (bắt buộc), course_code (bắt buộc), access_tier, status, activated_at, expires_at, source</p>
            <p><strong>orders</strong>: Email (bắt buộc), Mã khoá học (bắt buộc), Tên, SĐT, Khoá học, Hạng, Ngày đăng ký, Trạng thái, Ghi chú</p>
            <p className="mt-2 text-amber-400">Luôn chạy Dry Run trước để kiểm tra, sau đó tắt Dry Run để import thật.</p>
          </div>
        </div>

        {/* Config */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6 space-y-4">
          {/* Sheet ID override */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sheet ID (tùy chọn - mặc định dùng env var)</label>
            <input
              type="text"
              value={sheetId}
              onChange={e => setSheetId(e.target.value)}
              placeholder="Để trống để dùng GOOGLE_SHEET_ID từ env"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal/50"
            />
          </div>

          {/* Table selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Chọn bảng import</label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'courses', label: 'courses' },
                { key: 'students', label: 'students' },
                { key: 'course_access', label: 'course_access' },
                { key: 'orders', label: 'orders (Đơn hàng)' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleTable(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                    tables.includes(key)
                      ? 'bg-teal/20 text-teal border-teal/30'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={e => setDryRun(e.target.checked)}
                className="w-4 h-4 rounded bg-white/5 border-white/20 text-teal focus:ring-teal"
              />
              <span className="text-sm text-white">Dry Run</span>
              <span className="text-xs text-gray-400">(chỉ validate, không ghi DB)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={upgradeOnly}
                onChange={e => setUpgradeOnly(e.target.checked)}
                className="w-4 h-4 rounded bg-white/5 border-white/20 text-teal focus:ring-teal"
              />
              <span className="text-sm text-white">Upgrade Only</span>
              <span className="text-xs text-gray-400">(không downgrade tier)</span>
            </label>
          </div>

          {/* Run button */}
          <button
            onClick={handleImport}
            disabled={running || tables.length === 0}
            className={`w-full py-3 rounded-lg text-sm font-bold transition-all ${
              dryRun
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-teal text-white hover:bg-teal/80'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Đang import...
              </span>
            ) : dryRun ? (
              'Chạy Dry Run (Validate Only)'
            ) : (
              'Chạy Import Thật'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary banner */}
            <div className={`rounded-xl p-4 border ${
              result.dryRun
                ? 'bg-amber-500/10 border-amber-500/20'
                : totalStats && totalStats.errorCount === 0
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  result.dryRun ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                }`}>
                  {result.dryRun ? 'DRY RUN' : 'ACTUAL RUN'}
                </span>
                <span className="text-xs text-gray-400">{result.summary}</span>
              </div>
              {totalStats && (
                <div className="grid grid-cols-7 gap-2 text-center">
                  {Object.entries({
                    Total: totalStats.total,
                    Valid: totalStats.valid,
                    Inserted: totalStats.inserted,
                    Updated: totalStats.updated,
                    Skipped: totalStats.skipped,
                    Invalid: totalStats.invalid,
                    Errors: totalStats.errorCount,
                  }).map(([label, count]) => (
                    <div key={label}>
                      <div className="text-lg font-bold text-white">{count}</div>
                      <div className="text-xs text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-table results */}
            {Object.entries(result.results).map(([table, stats]) => (
              <div key={table} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{table}</h3>
                  <span className="text-xs text-gray-400">
                    {stats.total} rows | {stats.valid} valid | {stats.inserted} inserted | {stats.updated} updated | {stats.skipped} skipped | {stats.invalid} invalid
                  </span>
                </div>

                {stats.errors.length > 0 && (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-[#1a1a2e]">
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left p-2 text-xs font-semibold text-gray-400 w-16">Row</th>
                          <th className="text-left p-2 text-xs font-semibold text-gray-400 w-24">Field</th>
                          <th className="text-left p-2 text-xs font-semibold text-gray-400 w-40">Value</th>
                          <th className="text-left p-2 text-xs font-semibold text-gray-400">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.errors.map((err, idx) => (
                          <tr key={idx} className={`border-b border-white/[0.04] ${
                            err.field === 'info' ? 'text-blue-300' :
                            err.field === 'warning' ? 'text-amber-300' :
                            err.field === 'duplicate' ? 'text-amber-300' :
                            'text-red-300'
                          }`}>
                            <td className="p-2 text-xs font-mono">{err.row}</td>
                            <td className="p-2 text-xs">{err.field}</td>
                            <td className="p-2 text-xs font-mono truncate max-w-[160px]">{err.value}</td>
                            <td className="p-2 text-xs">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Next step hint */}
            {result.dryRun && totalStats && totalStats.invalid === 0 && (
              <div className="bg-teal/10 border border-teal/20 rounded-xl p-4 text-sm text-teal">
                Dry run thành công! Tắt &quot;Dry Run&quot; và chạy lại để import thật.
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
