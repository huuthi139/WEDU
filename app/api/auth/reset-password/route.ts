import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { hashPassword } from '@/lib/auth/password';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token không hợp lệ' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Verify reset token
    let email: string;
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.purpose !== 'password-reset' || typeof payload.email !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Token không hợp lệ' },
          { status: 400 }
        );
      }
      email = payload.email;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu link mới.' },
        { status: 400 }
      );
    }

    // Update password in Supabase
    try {
      const { getUserByEmail, updateUserProfile } = await import('@/lib/supabase/users');
      const user = await getUserByEmail(email);
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Tài khoản không tồn tại' },
          { status: 404 }
        );
      }

      const newHash = await hashPassword(newPassword);
      await updateUserProfile(email, { password_hash: newHash });

      return NextResponse.json({
        success: true,
        message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.',
      });
    } catch (err) {
      console.error('[ResetPassword] DB error:', err instanceof Error ? err.message : err);
      return NextResponse.json(
        { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[ResetPassword] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
