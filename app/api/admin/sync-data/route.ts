import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getSupabaseAdmin } from '@/lib/supabase/client';

/**
 * POST /api/admin/sync-data
 * Import data from Google Sheets → Supabase for: orders, enrollments, reviews, chapters
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

function getScriptUrl(): string | null {
  return process.env.GOOGLE_SCRIPT_URL || null;
}

async function callGAS(scriptUrl: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params);
  const url = `${scriptUrl}?${qs.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/** Parse CSV from Google Sheets */
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    return row;
  });
}

async function fetchSheetCSV(sheetId: string, tabName: string): Promise<Record<string, string>[]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(csvUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const csv = await res.text();
    return parseCSV(csv);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function syncOrders(sheetId: string): Promise<{ added: number; skipped: number; errors: number }> {
  const supabase = getSupabaseAdmin();
  const stats = { added: 0, skipped: 0, errors: 0 };

  // Google Sheet Orders columns:
  // Thời gian | Mã đơn hàng | Tên khách hàng | Email | Số điện thoại | Khóa học | Mã khóa học | Tổng tiền | Phương thức thanh toán | Trạng thái | Mã giao dịch
  const rows = await fetchSheetCSV(sheetId, 'Orders');
  if (rows.length === 0) return stats;

  for (const row of rows) {
    const orderId = row['Mã đơn hàng'] || row['Ma don hang'] || '';
    const email = (row['Email'] || row['email'] || '').toLowerCase().trim();
    if (!orderId || !email) { stats.skipped++; continue; }

    // Check if already exists
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('order_id', orderId)
      .limit(1)
      .single();

    if (existing) { stats.skipped++; continue; }

    const total = parseFloat((row['Tổng tiền'] || row['Tong tien'] || '0').replace(/[^0-9.-]/g, '')) || 0;
    const createdAt = row['Thời gian'] || row['Thoi gian'] || new Date().toISOString();

    const { error } = await supabase.from('orders').insert({
      order_id: orderId,
      user_email: email,
      user_name: row['Tên khách hàng'] || row['Ten khach hang'] || '',
      user_phone: row['Số điện thoại'] || row['So dien thoai'] || row['SĐT'] || '',
      course_names: row['Khóa học'] || row['Khoa hoc'] || '',
      course_ids: row['Mã khóa học'] || row['Ma khoa hoc'] || '',
      total,
      payment_method: row['Phương thức thanh toán'] || row['Phuong thuc thanh toan'] || row['PTTT'] || '',
      status: row['Trạng thái'] || row['Trang thai'] || 'Đang chờ xử lý',
      note: row['Mã giao dịch'] || row['Ma giao dich'] || '',
      created_at: parseDate(createdAt),
    });

    if (error) { stats.errors++; console.error('[SyncOrders] Insert error:', error.message); }
    else { stats.added++; }
  }

  return stats;
}

async function syncEnrollments(sheetId: string): Promise<{ added: number; skipped: number; errors: number }> {
  const supabase = getSupabaseAdmin();
  const stats = { added: 0, skipped: 0, errors: 0 };

  // Enrollments columns: enrollmentId | userId | courseId | enrolledAt | progress | completedLessons | lastAccessedAt | status
  const rows = await fetchSheetCSV(sheetId, 'Enrollments');
  if (rows.length === 0) return stats;

  for (const row of rows) {
    const email = (row['userId'] || row['user_email'] || '').toLowerCase().trim();
    const courseId = (row['courseId'] || row['course_id'] || '').trim();
    if (!email || !courseId) { stats.skipped++; continue; }

    // Check if already exists
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_email', email)
      .eq('course_id', courseId)
      .limit(1)
      .single();

    if (existing) { stats.skipped++; continue; }

    let completedLessons: string[] = [];
    try {
      const raw = row['completedLessons'] || row['completed_lessons'] || '[]';
      completedLessons = JSON.parse(raw);
    } catch { completedLessons = []; }

    const enrolledAt = row['enrolledAt'] || row['enrolled_at'] || new Date().toISOString();
    const progress = parseFloat(row['progress'] || '0') || 0;
    const lastAccessedAt = row['lastAccessedAt'] || row['last_accessed_at'] || enrolledAt;

    const { error } = await supabase.from('enrollments').insert({
      user_email: email,
      course_id: courseId,
      enrolled_at: parseDate(enrolledAt),
      progress: Math.min(100, Math.max(0, progress)),
      completed_lessons: completedLessons,
      last_accessed_at: parseDate(lastAccessedAt),
    });

    if (error) { stats.errors++; console.error('[SyncEnrollments] Insert error:', error.message); }
    else { stats.added++; }
  }

  return stats;
}

async function syncReviews(sheetId: string): Promise<{ added: number; skipped: number; errors: number }> {
  const supabase = getSupabaseAdmin();
  const stats = { added: 0, skipped: 0, errors: 0 };

  // Reviews columns: reviewId | userId | userEmail | userName | courseId | rating | content | createdAt
  const rows = await fetchSheetCSV(sheetId, 'Reviews');
  if (rows.length === 0) return stats;

  for (const row of rows) {
    const email = (row['userEmail'] || row['user_email'] || row['userId'] || '').toLowerCase().trim();
    const courseId = (row['courseId'] || row['course_id'] || '').trim();
    if (!email || !courseId) { stats.skipped++; continue; }

    // Check if already exists
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_email', email)
      .eq('course_id', courseId)
      .limit(1)
      .single();

    if (existing) { stats.skipped++; continue; }

    const rating = parseFloat(row['rating'] || '5') || 5;
    const createdAt = row['createdAt'] || row['created_at'] || new Date().toISOString();

    const { error } = await supabase.from('reviews').insert({
      course_id: courseId,
      user_email: email,
      user_name: row['userName'] || row['user_name'] || '',
      rating: Math.min(5, Math.max(1, rating)),
      content: row['content'] || '',
      created_at: parseDate(createdAt),
    });

    if (error) { stats.errors++; console.error('[SyncReviews] Insert error:', error.message); }
    else { stats.added++; }
  }

  return stats;
}

async function syncCourses(): Promise<{ added: number; skipped: number; errors: number }> {
  const supabase = getSupabaseAdmin();
  const stats = { added: 0, skipped: 0, errors: 0 };

  // Import fallback courses as seed data
  const { FALLBACK_COURSES } = await import('@/lib/fallback-data');

  for (const course of FALLBACK_COURSES) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('id', course.id)
      .limit(1)
      .single();

    if (existing) { stats.skipped++; continue; }

    const { error } = await supabase.from('courses').insert({
      id: course.id,
      title: course.title,
      description: course.description || '',
      thumbnail: course.thumbnail || '',
      instructor: course.instructor || 'WEDU',
      category: course.category || '',
      price: course.price ?? 0,
      original_price: course.originalPrice ?? null,
      rating: course.rating ?? 0,
      reviews_count: course.reviewsCount ?? 0,
      enrollments_count: course.enrollmentsCount ?? 0,
      duration: course.duration ?? 0,
      lessons_count: course.lessonsCount ?? 0,
      badge: course.badge || null,
      member_level: course.memberLevel || 'Free',
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (error) { stats.errors++; console.error('[SyncCourses] Insert error:', error.message); }
    else { stats.added++; }
  }

  return stats;
}

async function syncChapters(scriptUrl: string): Promise<{ added: number; skipped: number; errors: number }> {
  const supabase = getSupabaseAdmin();
  const stats = { added: 0, skipped: 0, errors: 0 };

  try {
    const data = await callGAS(scriptUrl, { action: 'getAllChapters' });
    if (!data?.success || !data.data) return stats;

    for (const [courseId, chaptersRaw] of Object.entries(data.data)) {
      if (!courseId || courseId.includes('_stats') || courseId.includes('__')) continue;

      // Check if already in Supabase
      const { data: existing } = await supabase
        .from('chapters')
        .select('id')
        .eq('course_id', courseId)
        .limit(1)
        .single();

      if (existing) { stats.skipped++; continue; }

      let chapters: any[] = [];
      if (Array.isArray(chaptersRaw)) {
        chapters = chaptersRaw;
      } else if (chaptersRaw && typeof chaptersRaw === 'object') {
        // Handle _n format - skip, let the chapters API handle this complex format
        stats.skipped++;
        continue;
      }

      if (chapters.length === 0) { stats.skipped++; continue; }

      // Calculate stats
      let totalLessons = 0;
      let totalDuration = 0;
      for (const ch of chapters) {
        const lessons = ch.lessons || [];
        totalLessons += lessons.length;
        for (const ls of lessons) {
          const dur = ls.duration || '';
          const parts = dur.split(':');
          if (parts.length === 2) {
            totalDuration += (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
          }
        }
      }

      const { error } = await supabase.from('chapters').upsert({
        course_id: courseId,
        chapters_json: chapters,
        lessons_count: totalLessons,
        duration: totalDuration,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'course_id' });

      if (error) { stats.errors++; console.error('[SyncChapters] Upsert error:', error.message); }
      else { stats.added++; }
    }
  } catch (err) {
    console.error('[SyncChapters] Error:', err);
  }

  return stats;
}

/** Parse various date formats to ISO string */
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Already ISO format
  if (dateStr.includes('T') && dateStr.includes('-')) {
    try { return new Date(dateStr).toISOString(); } catch { /* fall through */ }
  }

  // Vietnamese format: "HH:MM:SS DD/MM/YYYY"
  const vnMatch = dateStr.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnMatch) {
    const [, h, m, s, d, mo, y] = vnMatch;
    try {
      return new Date(+y, +mo - 1, +d, +h, +m, +s).toISOString();
    } catch { /* fall through */ }
  }

  // DD/MM/YYYY format
  const dmyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, d, mo, y] = dmyMatch;
    try { return new Date(+y, +mo - 1, +d).toISOString(); } catch { /* fall through */ }
  }

  // Fallback: try native parse
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* fall through */ }

  return new Date().toISOString();
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  const scriptUrl = getScriptUrl();

  if (!sheetId && !scriptUrl) {
    return NextResponse.json({
      success: false,
      error: 'Chưa cấu hình GOOGLE_SHEET_ID hoặc GOOGLE_SCRIPT_URL',
    }, { status: 400 });
  }

  const results: Record<string, { added: number; skipped: number; errors: number }> = {};

  try {
    const body = await request.json().catch(() => ({}));
    const tables = body.tables || ['courses', 'orders', 'enrollments', 'reviews', 'chapters'];

    // Sync courses from fallback data (seed)
    if (tables.includes('courses')) {
      results.courses = await syncCourses();
    }

    // Sync orders from CSV
    if (sheetId && tables.includes('orders')) {
      results.orders = await syncOrders(sheetId);
    }

    // Sync enrollments from CSV
    if (sheetId && tables.includes('enrollments')) {
      results.enrollments = await syncEnrollments(sheetId);
    }

    // Sync reviews from CSV
    if (sheetId && tables.includes('reviews')) {
      results.reviews = await syncReviews(sheetId);
    }

    // Sync chapters from GAS
    if (scriptUrl && tables.includes('chapters')) {
      results.chapters = await syncChapters(scriptUrl);
    }

    const totalAdded = Object.values(results).reduce((sum, r) => sum + r.added, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

    return NextResponse.json({
      success: true,
      message: `Sync hoàn tất: ${totalAdded} bản ghi mới${totalErrors > 0 ? `, ${totalErrors} lỗi` : ''}`,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Lỗi sync: ${msg}` }, { status: 500 });
  }
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
