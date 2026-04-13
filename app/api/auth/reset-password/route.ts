import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { jwtVerify } from 'jose';
import { hashPassword } from '@/lib/auth/password';
import { getSecret } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token không hợp lệ' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu mới phải có ít nhất 8 ký tự' },
        { status: 400 }
      );
    }

    // Verify reset token
    let email: string;
    let tokenExp: number | undefined;
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (payload.purpose !== 'password-reset' || typeof payload.email !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Token không hợp lệ' },
          { status: 400 }
        );
      }
      email = payload.email;
      tokenExp = payload.exp;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu link mới.' },
        { status: 400 }
      );
    }

    // Check if token has already been used
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const supabase = getSupabaseAdmin();

    const { data: usedToken } = await supabase
      .from('used_reset_tokens')
      .select('token_hash')
      .eq('token_hash', tokenHash)
      .single();

    if (usedToken) {
      return NextResponse.json(
        { success: false, error: 'Token đã được sử dụng. Vui lòng yêu cầu link mới.' },
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

      // Mark token as used
      const expiresAt = tokenExp
        ? new Date(tokenExp * 1000).toISOString()
        : new Date(Date.now() + 3600_000).toISOString();

      await supabase
        .from('used_reset_tokens')
        .insert({ token_hash: tokenHash, expires_at: expiresAt });

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
