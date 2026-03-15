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

  try {
    const { getUserByEmail, updateUserProfile } = await import('@/lib/supabase/users');

    // 1. Get user by email
    const userProfile = await getUserByEmail(session.email);
    if (!userProfile) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    // 2. Verify current password
    if (userProfile.password_hash) {
      const isValid = await verifyPassword(currentPassword, userProfile.password_hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
      }
    }

    // 3. Update password hash in Supabase
    const newHash = await hashPassword(newPassword);
    await updateUserProfile(session.email, { password_hash: newHash });

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('[ChangePassword] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
