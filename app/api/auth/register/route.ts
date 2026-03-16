import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { emailExists, createUserProfile } from '@/lib/supabase/users';
import { syncUserToSheet } from '@/lib/sync/sheetSync';
import { sendWelcomeEmail } from '@/lib/email/send';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 15) : '';

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Tên phải có ít nhất 2 ký tự' },
        { status: 400 }
      );
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Check if email already exists in Supabase
    if (await emailExists(email)) {
      return NextResponse.json(
        { success: false, error: 'Email đã được sử dụng. Vui lòng dùng email khác.' },
        { status: 409 }
      );
    }

    // Create user in Supabase (source of truth)
    const userProfile = await createUserProfile({
      email, name, phone, passwordHash: hashedPassword, role: 'user', memberLevel: 'Free',
    });

    // Create session
    try {
      await createSession({ email, role: 'user', name, level: 'Free' });
    } catch (sessionErr) {
      console.error('[Register] Session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
    }

    // Background sync to Google Sheet (non-blocking, fire-and-forget)
    syncUserToSheet({ name, email, passwordHash: hashedPassword, phone });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(() => {});

    return NextResponse.json({
      success: true,
      user: {
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        role: userProfile.role,
        memberLevel: userProfile.member_level,
      },
    });
  } catch (error) {
    console.error('[Register] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
