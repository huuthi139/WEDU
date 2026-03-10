import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' }, { status: 400 });
  }

  const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

  try {
    // 1. Get current password hash from Sheets
    const userRes = await fetch(`${SCRIPT_URL}?action=login&email=${encodeURIComponent(session.email)}`);
    const userData = await userRes.json();

    if (!userData.success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Verify current password
    const isValid = await verifyPassword(currentPassword, userData.user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    }

    // 3. Hash new password and update via Sheets
    const newHash = await hashPassword(newPassword);
    const updateRes = await fetch(
      `${SCRIPT_URL}?action=updatePassword&email=${encodeURIComponent(session.email)}&passwordHash=${encodeURIComponent(newHash)}`
    );
    const updateData = await updateRes.json();

    if (!updateData.success) {
      return NextResponse.json({ error: 'Không thể cập nhật mật khẩu' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
