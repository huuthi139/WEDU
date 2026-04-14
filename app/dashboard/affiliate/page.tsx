'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'commission' | 'withdrawal';
  amount: number;
  order_id: string | null;
  description: string;
  paid: boolean;
  created_at: string;
}

interface AffiliateData {
  wallet: { balance: number; totalEarned: number };
  transactions: Transaction[];
  referralCount: number;
  refCode: string;
}

export default function AffiliatePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/affiliate');
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) fetchData();
  }, [user, authLoading, router, fetchData]);

  const refLink = data ? `${typeof window !== 'undefined' ? window.location.origin : ''}/courses?ref=${data.refCode}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount, 10);
    if (!amount || amount <= 0) { setWithdrawError('Số tiền không hợp lệ'); return; }
    if (data && amount > data.wallet.balance) { setWithdrawError('Số dư không đủ'); return; }

    setWithdrawing(true);
    setWithdrawError('');
    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!json.success) { setWithdrawError(json.error || 'Lỗi'); return; }
      setWithdrawOpen(false);
      setWithdrawAmount('');
      fetchData();
    } catch {
      setWithdrawError('Lỗi kết nối');
    } finally {
      setWithdrawing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <svg className="w-10 h-10 animate-spin text-teal" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!user || !data) return null;

  return (
    <div className="min-h-screen bg-dark">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white">Affiliate</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">Chương trình Affiliate</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Số dư hiện tại</p>
            <p className="text-2xl font-bold text-teal">{formatPrice(data.wallet.balance)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tổng hoa hồng</p>
            <p className="text-2xl font-bold text-gold">{formatPrice(data.wallet.totalEarned)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Người giới thiệu</p>
            <p className="text-2xl font-bold text-white">{data.referralCount}</p>
          </div>
        </div>

        {/* Ref Link + Withdraw */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Link giới thiệu của bạn</h2>
          <div className="flex items-center gap-3">
            <input
              readOnly
              value={refLink}
              className="flex-1 px-4 py-2.5 bg-dark border border-white/10 rounded-lg text-sm text-gray-300 font-mono"
            />
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? 'Đã copy!' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Chia sẻ link này. Khi người dùng đăng ký và mua khóa học, bạn nhận 10% hoa hồng.
          </p>

          {data.wallet.balance > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <Button variant="primary" size="sm" onClick={() => setWithdrawOpen(true)}>
                Rút tiền
              </Button>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-white/[0.06]">
            <h2 className="text-lg font-bold text-white">Lịch sử giao dịch</h2>
          </div>
          {data.transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Chưa có giao dịch nào</p>
              <p className="text-gray-500 text-sm mt-1">Hoa hồng sẽ xuất hiện khi người được giới thiệu mua khóa học</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Loại</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Số tiền</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Mô tả</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Trạng thái</th>
                    <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-white/[0.06]/50 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tx.type === 'commission' ? 'bg-green-500/10 text-green-400' : 'bg-gold/10 text-gold'
                        }`}>
                          {tx.type === 'commission' ? 'Hoa hồng' : 'Rút tiền'}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-semibold">
                        <span className={tx.type === 'commission' ? 'text-green-400' : 'text-gold'}>
                          {tx.type === 'commission' ? '+' : '-'}{formatPrice(tx.amount)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-300">{tx.description}</td>
                      <td className="p-4">
                        {tx.type === 'withdrawal' ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            tx.paid ? 'bg-green-500/10 text-green-400' : 'bg-gold/10 text-gold'
                          }`}>
                            {tx.paid ? 'Đã thanh toán' : 'Chờ xử lý'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* Withdraw Modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setWithdrawOpen(false)}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Rút tiền</h3>
            <p className="text-sm text-gray-400 mb-4">Số dư: <span className="text-teal font-semibold">{formatPrice(data.wallet.balance)}</span></p>
            {withdrawError && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">{withdrawError}</div>
            )}
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Nhập số tiền"
              className="w-full px-4 py-2.5 bg-dark border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal mb-4"
            />
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={() => setWithdrawOpen(false)} className="flex-1">Hủy</Button>
              <Button variant="primary" size="sm" onClick={handleWithdraw} disabled={withdrawing} className="flex-1">
                {withdrawing ? 'Đang xử lý...' : 'Xác nhận'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
