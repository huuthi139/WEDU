import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getSupabaseAdmin } from '@/lib/supabase/client';

/**
 * Phase 4.7: POST is deprecated. Use /api/admin/import-sheet for data migration.
 * GET still works for checking Supabase data counts.
 */

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
 * POST /api/admin/sync-data
 * DEPRECATED - Phase 4.7: Use /api/admin/import-sheet instead.
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Endpoint deprecated since Phase 4.7. Use /api/admin/import-sheet for data migration.',
  }, { status: 410 });
}

/**
 * GET /api/admin/sync-data
 * Check current data counts in Supabase
 */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const [courses, orders, enrollments, reviews, chapters] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }),
    supabase.from('reviews').select('id', { count: 'exact', head: true }),
    supabase.from('chapters').select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    success: true,
    counts: {
      courses: courses.count || 0,
      orders: orders.count || 0,
      enrollments: enrollments.count || 0,
      reviews: reviews.count || 0,
      chapters: chapters.count || 0,
    },
  });
}
