import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { sendPasswordResetEmail } from '@/lib/email/send';
import { getSecret } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user in Supabase
    let userName = '';
    try {
      const { getUserByEmail } = await import('@/lib/supabase/users');
      const user = await getUserByEmail(normalizedEmail);
      if (!user) {
        // Return success even if user not found to prevent email enumeration
        return NextResponse.json({
          success: true,
          message: 'Nếu email tồn tại, bạn sẽ nhận được link khôi phục mật khẩu.',
        });
      }
      userName = user.name || '';
    } catch {
      // If Supabase is unavailable, still return generic message
      return NextResponse.json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được link khôi phục mật khẩu.',
      });
    }

    // Generate a reset token (JWT valid for 1 hour)
    const resetToken = await new SignJWT({ email: normalizedEmail, purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .setIssuedAt()
      .sign(getSecret());

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(normalizedEmail, userName || 'bạn', resetToken);
    if (!emailSent) {
      console.error('[ForgotPassword] Failed to send reset email to', normalizedEmail);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'Nếu email tồn tại, bạn sẽ nhận được link khôi phục mật khẩu.',
    });
  } catch (error) {
    console.error('[ForgotPassword] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
