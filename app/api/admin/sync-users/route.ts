import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getAllUsers } from '@/lib/supabase/users';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return false;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return false;
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    return hasAdminAccess(role);
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/sync-users
 * DEPRECATED - Phase 4.7: Use /api/admin/import-sheet instead.
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Endpoint deprecated since Phase 4.7. Use /api/admin/import-sheet for data migration.',
  }, { status: 410 });
}

/**
 * GET /api/admin/sync-users
 * Check current Supabase user count
 */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền truy cập' },
      { status: 403 }
    );
  }

  const { total } = await getAllUsers({ limit: 1 });

  return NextResponse.json({
    success: true,
    supabaseCount: total,
    message: 'Supabase là nguồn dữ liệu chính. Dùng /api/admin/import-sheet để import từ Google Sheets.',
  });
}
