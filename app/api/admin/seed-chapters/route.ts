import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { saveChapters } from '@/lib/supabase/chapters';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { FALLBACK_CHAPTERS, getFallbackChapterStats } from '@/lib/fallback-chapters';

export const dynamic = 'force-dynamic';

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
 * POST /api/admin/seed-chapters
 * Seed correct chapter data for courses 1 and 6 into Supabase
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const results: Record<string, { success: boolean; lessonsCount: number; chaptersCount: number }> = {};
  const supabase = getSupabaseAdmin();

  for (const [courseId, chapters] of Object.entries(FALLBACK_CHAPTERS)) {
    const stats = getFallbackChapterStats(courseId);
    if (!stats) continue;

    const ok = await saveChapters(courseId, chapters, stats.lessonsCount, stats.duration);

    if (ok) {
      // Also update courses table
      await supabase
        .from('courses')
        .update({
          lessons_count: stats.lessonsCount,
          duration: stats.duration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId);
    }

    results[courseId] = {
      success: ok,
      lessonsCount: stats.lessonsCount,
      chaptersCount: stats.chaptersCount,
    };
  }

  return NextResponse.json({
    success: true,
    message: 'Đã seed dữ liệu chapter cho các khoá học',
    results,
  });
}
