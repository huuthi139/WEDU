/**
 * POST /api/admin/bootstrap
 * Bootstrap endpoint: seed admin + sync Google Sheet → Supabase
 *
 * This endpoint does NOT require authentication.
 * It only works when the users table is empty (safety measure).
 * Once data exists, it returns early without modifying anything.
 */
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { getSupabaseAdmin } from '@/lib/supabase/client';

const DEFAULT_ADMIN_EMAIL = 'admin@wedu.vn';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';
const DEFAULT_ADMIN_NAME = 'Admin WEDU';

// Admin emails from Google Sheet that should get admin role + default password
const SHEET_ADMIN_EMAILS = ['admin@wepower.vn', 'admin2@wepower.vn'];

export async function POST() {
  try {
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
    const results = { admin_seeded: false, sheet_synced: 0, errors: [] as string[] };

    // Step 1: Seed default admin account
    const { error: adminError } = await supabase.from('users').insert({
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      phone: '',
      password_hash: adminPasswordHash,
      role: 'admin',
      member_level: 'VIP',
      created_at: now,
      updated_at: now,
    });

    if (adminError) {
      results.errors.push(`Seed admin: ${adminError.message}`);
    } else {
      results.admin_seeded = true;
    }

    // Step 2: Sync users from Google Sheet
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (scriptUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const res = await fetch(`${scriptUrl}?action=getUsers`, {
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await res.json();
        if (data?.success && Array.isArray(data.users)) {
          const usersToInsert = [];

          for (const u of data.users) {
            const email = (u.Email || u.email || '').toLowerCase().trim();
            if (!email || email === DEFAULT_ADMIN_EMAIL) continue;

            // Map role from Sheet
            const sheetRole = (u.Role || '').toLowerCase().trim();
            let role = 'user';
            if (sheetRole === 'admin' || SHEET_ADMIN_EMAILS.includes(email)) {
              role = 'admin';
            } else if (sheetRole === 'instructor') {
              role = 'instructor';
            } else if (sheetRole === 'sub_admin') {
              role = 'sub_admin';
            }

            // Map level
            const sheetLevel = u.Level || 'Free';
            const member_level = ['Free', 'Premium', 'VIP'].includes(sheetLevel) ? sheetLevel : 'Free';

            // Admin accounts from Sheet get default password
            const isSheetAdmin = SHEET_ADMIN_EMAILS.includes(email);
            const password_hash = isSheetAdmin ? adminPasswordHash : '';

            usersToInsert.push({
              email,
              name: u['Tên'] || u.name || '',
              phone: u.Phone || u.phone || '',
              password_hash,
              role,
              member_level,
              created_at: now,
              updated_at: now,
            });
          }

          // Batch insert (skip duplicates)
          if (usersToInsert.length > 0) {
            // Insert in batches of 50 to avoid payload limits
            for (let i = 0; i < usersToInsert.length; i += 50) {
              const batch = usersToInsert.slice(i, i + 50);
              const { error: insertError, data: inserted } = await supabase
                .from('users')
                .upsert(batch, { onConflict: 'email', ignoreDuplicates: true })
                .select('id');

              if (insertError) {
                results.errors.push(`Batch ${i}: ${insertError.message}`);
              } else {
                results.sheet_synced += inserted?.length || 0;
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Google Sheet fetch: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bootstrap hoàn tất! Admin: ${results.admin_seeded ? 'OK' : 'FAILED'}, Sheet users: ${results.sheet_synced}`,
      results,
      admin_credentials: results.admin_seeded ? {
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        note: 'Vui lòng đổi mật khẩu sau khi đăng nhập.',
      } : undefined,
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
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('id').limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        empty: true,
        error: error.message,
        action: 'POST /api/admin/bootstrap để khởi tạo dữ liệu',
      });
    }

    const isEmpty = !data || data.length === 0;
    return NextResponse.json({
      success: true,
      empty: isEmpty,
      message: isEmpty
        ? 'Bảng users trống. Gọi POST /api/admin/bootstrap để sync dữ liệu từ Google Sheet.'
        : 'Bảng users đã có dữ liệu.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
