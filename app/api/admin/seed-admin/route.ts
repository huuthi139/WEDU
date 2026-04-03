/**
 * POST /api/admin/seed-admin - Create or reset default admin account
 * This endpoint creates an admin user with default credentials,
 * or resets the password if admin already exists.
 */
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { getUserByEmail, createUserProfile, updateUserProfile } from '@/lib/supabase/users';
import { requireAdmin } from '@/lib/auth/guards';

const DEFAULT_ADMIN_EMAIL = 'admin@wedu.vn';
const DEFAULT_ADMIN_PASSWORD = 'Admin139@';
const DEFAULT_ADMIN_NAME = 'Admin WEDU';

export async function POST() {
  try {
    await requireAdmin();
    // Check if admin already exists
    const existing = await getUserByEmail(DEFAULT_ADMIN_EMAIL);
    if (existing) {
      // Reset password to default
      const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
      await updateUserProfile(DEFAULT_ADMIN_EMAIL, { password_hash: passwordHash });
      return NextResponse.json({
        success: true,
        message: 'Đã reset mật khẩu admin',
        email: DEFAULT_ADMIN_EMAIL,
        alreadyExists: true,
      });
    }

    // Create admin account
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    await createUserProfile({
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      passwordHash,
      role: 'admin',
      memberLevel: 'VIP',
    });

    return NextResponse.json({
      success: true,
      message: 'Tạo tài khoản admin thành công!',
      email: DEFAULT_ADMIN_EMAIL,
      note: 'Đăng nhập với: admin / Admin139@',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[seed-admin] Error:', msg);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        hint: 'Kiểm tra bảng users đã tồn tại chưa. Gọi GET /api/admin/setup-db để kiểm tra.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try { await requireAdmin(); } catch { return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }); }
  return NextResponse.json({
    message: 'Gọi POST /api/admin/seed-admin để tạo/reset tài khoản admin mặc định.',
    credentials: {
      username: 'admin',
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
    },
  });
}
