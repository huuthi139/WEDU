'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/providers/ToastProvider';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (token) {
    return <ResetForm token={token} />;
  }
  return <ForgotForm />;
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ForgotForm() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        showToast('Đã gửi email khôi phục mật khẩu!', 'success');
      } else {
        showToast(data.error || 'Có lỗi xảy ra', 'error');
      }
    } catch {
      showToast('Lỗi kết nối. Vui lòng thử lại.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-4xl font-bold text-teal tracking-wider">WEDU</span>
        </Link>

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Quên mật khẩu</h1>
          <p className="text-gray-400 text-center mb-8">
            Nhập email của bạn để nhận link khôi phục mật khẩu.
          </p>

          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <p className="text-white mb-2 font-semibold">Đã gửi email!</p>
              <p className="text-gray-400 text-sm mb-6">
                Vui lòng kiểm tra hộp thư của bạn (bao gồm cả thư mục spam) để tìm link khôi phục mật khẩu.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-teal hover:text-teal/80 text-sm transition-colors"
              >
                Gửi lại email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-dark border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                  placeholder="example@email.com"
                  required
                />
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang gửi...
                  </span>
                ) : 'Gửi link khôi phục'}
              </Button>
            </form>
          )}

          <p className="text-center text-gray-400 text-sm mt-6">
            <Link href="/login" className="text-teal hover:text-teal/80 font-semibold transition-colors">
              ← Quay lại đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ResetForm({ token }: { token: string }) {
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      showToast('Mật khẩu phải có ít nhất 6 ký tự', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        showToast('Đặt lại mật khẩu thành công!', 'success');
      } else {
        showToast(data.error || 'Có lỗi xảy ra', 'error');
      }
    } catch {
      showToast('Lỗi kết nối. Vui lòng thử lại.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Thành công!</h2>
            <p className="text-gray-400 mb-6">Mật khẩu đã được đặt lại. Bạn có thể đăng nhập với mật khẩu mới.</p>
            <Link href="/login">
              <Button variant="primary" size="lg" className="w-full">
                Đăng nhập ngay
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-4xl font-bold text-teal tracking-wider">WEDU</span>
        </Link>

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Đặt lại mật khẩu</h1>
          <p className="text-gray-400 text-center mb-8">Nhập mật khẩu mới cho tài khoản của bạn.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Mật khẩu mới
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-white mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark border border-white/[0.06] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang xử lý...
                </span>
              ) : 'Đặt lại mật khẩu'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
