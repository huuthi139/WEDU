import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
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
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 1. Get Firebase user by email
    const firebaseUser = await auth.getUserByEmail(session.email);

    // 2. Verify current password via Firestore stored hash
    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    const userData = userDoc.data();

    if (userData?.passwordHash) {
      const isValid = await verifyPassword(currentPassword, userData.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
      }
    }

    // 3. Update password in Firebase Auth
    await auth.updateUser(firebaseUser.uid, { password: newPassword });

    // 4. Update password hash in Firestore
    const newHash = await hashPassword(newPassword);
    await db.collection('users').doc(firebaseUser.uid).update({
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('[ChangePassword] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
