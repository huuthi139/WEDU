/**
 * POST /api/admin/bootstrap
 * Bootstrap endpoint: seed admin account.
 *
 * Phase 4.7: Google Sheets sync removed. Only seeds default admin.
 * Use /api/admin/import-sheet for data migration from Google Sheets.
 *
 * Requires admin authentication.
 * It only works when the users table is empty (safety measure).
 */
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { requireAdmin } from '@/lib/auth/guards';

const DEFAULT_ADMIN_EMAIL = 'admin@wedu.vn';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';
const DEFAULT_ADMIN_NAME = 'Admin WEDU';

export async function POST() {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdmin();

    // Safety: only run when users table is empty
    const { data: existingUsers, error: countError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (countError) {
      return NextResponse.json({
        success: false,
        error: `Lỗi kiểm tra bảng users: ${countError.message}`,
        hint: 'Bảng users có thể chưa tồn tại. Chạy migration SQL trước.',
      }, { status: 500 });
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Bảng users đã có dữ liệu. Không cần bootstrap.',
        skipped: true,
      });
    }

    const now = new Date().toISOString();
    const adminPasswordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

    // Seed default admin account
    const { error: adminError } = await supabase.from('users').insert({
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      phone: '',
      password_hash: adminPasswordHash,
      role: 'admin',
      system_role: 'admin',
      member_level: 'VIP',
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    if (adminError) {
      return NextResponse.json({
        success: false,
        error: `Seed admin thất bại: ${adminError.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bootstrap hoàn tất! Admin account đã được tạo.',
      admin_credentials: {
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        note: 'Vui lòng đổi mật khẩu sau khi đăng nhập. Dùng /api/admin/import-sheet để import dữ liệu từ Google Sheets.',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[bootstrap] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('id').limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        empty: true,
        error: error.message,
        action: 'POST /api/admin/bootstrap để khởi tạo admin account',
      });
    }

    const isEmpty = !data || data.length === 0;
    return NextResponse.json({
      success: true,
      empty: isEmpty,
      message: isEmpty
        ? 'Bảng users trống. Gọi POST /api/admin/bootstrap để tạo admin, sau đó dùng /api/admin/import-sheet để import dữ liệu.'
        : 'Bảng users đã có dữ liệu.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
