'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const router = useRouter();
  const { showToast } = useToast();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [errors, setErrors] = useState<{email?: string; password?: string; general?: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    // Signal to fallback script that React has hydrated
    (window as unknown as Record<string, boolean>).__reactHydrated = true;
  }, []);

  const validate = () => {
    const newErrors: {email?: string; password?: string} = {};

    if (!formData.email) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    const result = await login(formData.email, formData.password);

    setIsLoading(false);

    if (result.success) {
      showToast('Đăng nhập thành công!', 'success');
      router.push('/dashboard');
    } else {
      setErrors({ general: result.error });
    }
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      {/* Hydration fallback handled by Next.js loading state */}

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-8">
          <span className="text-4xl font-bold text-teal tracking-wider">WEDU</span>
        </Link>

        {/* Login Card */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Đăng nhập</h1>
          <p className="text-gray-400 text-center mb-8">
            Chào mừng trở lại! Vui lòng đăng nhập vào tài khoản của bạn.
          </p>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Error display for both React and fallback */}
            <div
              id="login-error"
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center"
              style={{ display: errors.general ? 'block' : 'none' }}
            >
              {errors.general || ''}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-3 bg-dark border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  errors.email ? 'border-red-500/50' : 'border-white/[0.06] focus:border-teal'
                }`}
                placeholder="example@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-3 bg-dark border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  errors.password ? 'border-red-500/50' : 'border-white/[0.06] focus:border-teal'
                }`}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.remember}
                  onChange={(e) => setFormData({ ...formData, remember: e.target.checked })}
                  className="w-4 h-4 rounded border-white/[0.06] bg-dark text-teal focus:ring-teal focus:ring-offset-0"
                />
                <span className="text-sm text-gray-400">Ghi nhớ đăng nhập</span>
              </label>
              <Link
                href="/reset-password"
                className="text-sm text-teal hover:text-teal/80 transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              id="login-submit"
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : 'Đăng nhập'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/[0.03] text-gray-400">Hoặc đăng nhập với</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => showToast('Đăng nhập Google đang được phát triển', 'info')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm font-semibold text-gray-700">Google</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Đăng nhập Facebook đang được phát triển', 'info')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="text-sm font-semibold">Facebook</span>
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-400 text-sm">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-teal hover:text-teal/80 font-semibold transition-colors">
              Đăng ký ngay
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Quay lại trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
