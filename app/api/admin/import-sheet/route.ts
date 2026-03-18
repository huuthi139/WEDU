import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import {
  normalizeEmail,
  isValidEmail,
  normalizeAccessTier,
  normalizeAccessStatus,
  normalizeAccessSource,
  normalizeSystemRole,
  normalizeUserStatus,
  normalizeCourseStatus,
  mergeAccessTier,
  parseDate,
  parseCSV,
  getCol,
  emptyStats,
  type ImportStats,
  type ImportError,
} from '@/lib/import/helpers';

// =============================================
// AUTH
// =============================================

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

// =============================================
// GOOGLE SHEET CSV FETCHER
// =============================================

async function fetchSheetTab(sheetId: string, tabName: string): Promise<Record<string, string>[]> {
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

// =============================================
// PHASE A: IMPORT COURSES
// =============================================

async function importCourses(
  sheetId: string,
  dryRun: boolean,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();

  const rows = await fetchSheetTab(sheetId, 'courses');
  stats.total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    // Column mapping: flexible names
    const courseCode = getCol(row, 'course_code', 'courseCode', 'ID', 'id', 'code').trim();
    const title = getCol(row, 'title', 'Title', 'Tên khóa học').trim();
    const slug = getCol(row, 'slug', 'Slug').trim();
    const statusRaw = getCol(row, 'status', 'Status', 'Trạng thái');

    // Validation
    if (!courseCode && !slug) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'course_code', value: '', message: 'course_code hoặc slug không được rỗng' });
      continue;
    }

    if (!title) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'title', value: '', message: 'title không được rỗng' });
      continue;
    }

    stats.valid++;
    if (dryRun) continue;

    // Lookup existing course by id or slug
    const lookupId = courseCode || slug;
    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('id', lookupId)
      .limit(1)
      .single();

    const courseData: Record<string, unknown> = {
      title,
      description: getCol(row, 'description', 'Description', 'Mô tả'),
      thumbnail: getCol(row, 'thumbnail', 'Thumbnail'),
      instructor: getCol(row, 'instructor', 'Instructor', 'Giảng viên') || 'WEDU',
      category: getCol(row, 'category', 'Category', 'Danh mục'),
      status: normalizeCourseStatus(statusRaw),
      visibility: 'public',
      is_active: normalizeCourseStatus(statusRaw) === 'published',
      updated_at: new Date().toISOString(),
    };

    // Optional numeric fields
    const priceRaw = getCol(row, 'price', 'Price', 'Giá');
    if (priceRaw) courseData.price = parseFloat(priceRaw.replace(/[^0-9.-]/g, '')) || 0;

    const memberLevel = getCol(row, 'member_level', 'memberLevel', 'MemberLevel', 'Member Level');
    if (memberLevel) courseData.member_level = memberLevel;

    if (slug) courseData.slug = slug;

    if (existing) {
      const { error } = await supabase.from('courses').update(courseData).eq('id', lookupId);
      if (error) {
        stats.errors.push({ row: rowNum, field: 'upsert', value: lookupId, message: error.message });
      } else {
        stats.updated++;
      }
    } else {
      courseData.id = lookupId;
      courseData.created_at = new Date().toISOString();
      const { error } = await supabase.from('courses').insert(courseData);
      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: lookupId, message: error.message });
      } else {
        stats.inserted++;
      }
    }
  }

  return stats;
}

// =============================================
// PHASE B: IMPORT STUDENTS (PROFILES)
// =============================================

async function importStudents(
  sheetId: string,
  dryRun: boolean,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();

  const rows = await fetchSheetTab(sheetId, 'students');
  // Fallback: try "Users" tab if "students" is empty
  const actualRows = rows.length > 0 ? rows : await fetchSheetTab(sheetId, 'Users');
  stats.total = actualRows.length;

  for (let i = 0; i < actualRows.length; i++) {
    const row = actualRows[i];
    const rowNum = i + 2;

    // Column mapping: flexible names
    const email = normalizeEmail(
      getCol(row, 'email', 'Email', 'E-mail', 'EmailAddress')
    );
    const fullName = getCol(row, 'full_name', 'fullName', 'name', 'Tên', 'Name', 'Họ tên', 'Ho ten').trim();
    const phone = getCol(row, 'phone', 'Phone', 'Số điện thoại', 'SĐT', 'So dien thoai').trim();
    const systemRoleRaw = getCol(row, 'system_role', 'systemRole', 'Role', 'role', 'Vai trò');
    const statusRaw = getCol(row, 'status', 'Status', 'Trạng thái');
    const passwordRaw = getCol(row, 'password', 'Password');

    // Validation
    if (!email) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'email', value: '', message: 'email không được rỗng' });
      continue;
    }

    if (!isValidEmail(email)) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'email', value: email, message: 'email không hợp lệ' });
      continue;
    }

    const systemRole = normalizeSystemRole(systemRoleRaw);
    const userStatus = normalizeUserStatus(statusRaw);

    stats.valid++;
    if (dryRun) continue;

    // Check existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id, email, name, phone, system_role, status')
      .eq('email', email)
      .limit(1)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update only non-empty fields, don't overwrite good data with empty
      const updates: Record<string, string> = { updated_at: now };
      if (fullName && fullName !== existing.name) updates.name = fullName;
      if (phone && phone !== existing.phone) updates.phone = phone;
      if (systemRoleRaw && systemRole !== existing.system_role) updates.system_role = systemRole;
      if (statusRaw && userStatus !== existing.status) updates.status = userStatus;

      // Also update legacy role field for backward compatibility
      if (systemRoleRaw) {
        const legacyRole = systemRole === 'admin' ? 'admin' : systemRole === 'instructor' ? 'instructor' : 'user';
        updates.role = legacyRole;
      }

      if (Object.keys(updates).length > 1) {
        const { error } = await supabase.from('users').update(updates).eq('email', email);
        if (error) {
          stats.errors.push({ row: rowNum, field: 'update', value: email, message: error.message });
        } else {
          stats.updated++;
        }
      } else {
        stats.skipped++;
      }
    } else {
      // Create new profile (placeholder - no password = first login sets password)
      const legacyRole = systemRole === 'admin' ? 'admin' : systemRole === 'instructor' ? 'instructor' : 'user';

      const insertData: Record<string, unknown> = {
        email,
        name: fullName || email.split('@')[0],
        phone: phone || '',
        role: legacyRole,
        system_role: systemRole,
        member_level: 'Free',
        status: userStatus,
        created_at: now,
        updated_at: now,
      };

      // Hash password if provided
      if (passwordRaw) {
        try {
          const { hashPassword } = await import('@/lib/auth/password');
          insertData.password_hash = await hashPassword(passwordRaw);
        } catch {
          insertData.password_hash = '';
        }
      } else {
        insertData.password_hash = '';
      }

      const { error } = await supabase.from('users').insert(insertData);
      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: email, message: error.message });
      } else {
        stats.inserted++;
      }
    }
  }

  return stats;
}

// =============================================
// PHASE C: IMPORT COURSE_ACCESS
// =============================================

async function importCourseAccess(
  sheetId: string,
  dryRun: boolean,
  upgradeOnly: boolean,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();

  const rows = await fetchSheetTab(sheetId, 'course_access');
  // Fallback: try "Enrollments" tab
  const actualRows = rows.length > 0 ? rows : await fetchSheetTab(sheetId, 'Enrollments');
  stats.total = actualRows.length;

  // Pre-fetch user email -> id lookup
  const userCache = new Map<string, string>();
  // Pre-fetch course code -> id lookup
  const courseCache = new Map<string, string>();

  // Collect unique duplicates: email+courseCode -> best row
  const seenPairs = new Map<string, { tier: string; rowNum: number }>();

  for (let i = 0; i < actualRows.length; i++) {
    const row = actualRows[i];
    const rowNum = i + 2;

    // Column mapping: flexible names
    const email = normalizeEmail(
      getCol(row, 'email', 'Email', 'user_email', 'userId', 'student_email')
    );
    const courseCode = getCol(row, 'course_code', 'courseCode', 'course_id', 'courseId', 'Mã khóa học').trim();
    const tierRaw = getCol(row, 'access_tier', 'accessTier', 'tier', 'Tier', 'Level', 'level');
    const statusRaw = getCol(row, 'status', 'Status', 'Trạng thái');
    const activatedAtRaw = getCol(row, 'activated_at', 'activatedAt', 'enrolled_at', 'enrolledAt');
    const expiresAtRaw = getCol(row, 'expires_at', 'expiresAt');
    const sourceRaw = getCol(row, 'source', 'Source', 'Nguồn');

    // Validation
    if (!email) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'email', value: '', message: 'email không được rỗng' });
      continue;
    }

    if (!isValidEmail(email)) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'email', value: email, message: 'email không hợp lệ' });
      continue;
    }

    if (!courseCode) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'course_code', value: '', message: 'course_code không được rỗng' });
      continue;
    }

    const tier = normalizeAccessTier(tierRaw || 'premium');
    if (!tier) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'access_tier', value: tierRaw, message: `access_tier không hợp lệ: "${tierRaw}". Chỉ chấp nhận: free, premium, vip` });
      continue;
    }

    // Handle duplicates: keep highest tier
    const pairKey = `${email}::${courseCode}`;
    const existing = seenPairs.get(pairKey);
    if (existing) {
      const existingTier = normalizeAccessTier(existing.tier);
      const merged = mergeAccessTier(existingTier || 'free', tier, true);
      seenPairs.set(pairKey, { tier: merged, rowNum });
      stats.skipped++;
      stats.errors.push({ row: rowNum, field: 'duplicate', value: pairKey, message: `Duplicate email+course_code, giữ tier cao nhất: ${merged}` });
      continue;
    }

    seenPairs.set(pairKey, { tier, rowNum });

    const accessStatus = normalizeAccessStatus(statusRaw);
    const source = normalizeAccessSource(sourceRaw || 'manual');
    const activatedAt = parseDate(activatedAtRaw) || new Date().toISOString();
    const expiresAt = parseDate(expiresAtRaw);

    stats.valid++;
    if (dryRun) continue;

    // Resolve user_id
    let userId = userCache.get(email);
    if (!userId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1)
        .single();

      if (user?.id) {
        userId = user.id as string;
        userCache.set(email, userId);
      } else {
        // Auto-create placeholder profile
        const now = new Date().toISOString();
        const { data: newUser, error: createErr } = await supabase
          .from('users')
          .insert({
            email,
            name: email.split('@')[0],
            phone: '',
            password_hash: '',
            role: 'user',
            system_role: 'student',
            member_level: 'Free',
            status: 'active',
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single();

        if (createErr || !newUser) {
          stats.errors.push({ row: rowNum, field: 'user_id', value: email, message: `Không thể tạo profile placeholder: ${createErr?.message || 'unknown'}` });
          continue;
        }

        userId = newUser.id as string;
        userCache.set(email, userId);
        stats.errors.push({ row: rowNum, field: 'info', value: email, message: 'Đã tạo profile placeholder (chưa có mật khẩu)' });
      }
    }

    // Resolve course_id
    let courseId = courseCache.get(courseCode);
    if (!courseId) {
      // Try by id first, then by slug
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseCode)
        .limit(1)
        .single();

      if (course) {
        courseId = course.id;
      } else {
        // Try slug lookup
        const { data: courseBySlug } = await supabase
          .from('courses')
          .select('id')
          .eq('slug', courseCode)
          .limit(1)
          .single();

        if (courseBySlug) {
          courseId = courseBySlug.id;
        }
      }

      if (!courseId) {
        stats.errors.push({ row: rowNum, field: 'course_code', value: courseCode, message: `Không tìm thấy khóa học với id hoặc slug: "${courseCode}"` });
        continue;
      }

      courseCache.set(courseCode, courseId);
    }

    // Check existing course_access
    const { data: existingAccess } = await supabase
      .from('course_access')
      .select('id, access_tier, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .limit(1)
      .single();

    if (existingAccess) {
      // Merge access tier (upgrade only by default)
      const currentTier = (existingAccess.access_tier || 'free') as 'free' | 'premium' | 'vip';
      const mergedTier = mergeAccessTier(currentTier, tier, upgradeOnly);

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (mergedTier !== currentTier) {
        updates.access_tier = mergedTier;
      }

      // Reactivate if currently expired/cancelled
      if (accessStatus === 'active' && existingAccess.status !== 'active') {
        updates.status = 'active';
        updates.activated_at = activatedAt;
      }

      if (expiresAt) updates.expires_at = expiresAt;

      if (Object.keys(updates).length > 1) {
        const { error } = await supabase
          .from('course_access')
          .update(updates)
          .eq('id', existingAccess.id);

        if (error) {
          stats.errors.push({ row: rowNum, field: 'update', value: `${email}:${courseCode}`, message: error.message });
        } else {
          stats.updated++;
        }
      } else {
        stats.skipped++;
      }
    } else {
      // Insert new course_access
      const { error } = await supabase.from('course_access').insert({
        user_id: userId,
        course_id: courseId,
        access_tier: tier,
        source,
        status: accessStatus,
        activated_at: activatedAt,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: `${email}:${courseCode}`, message: error.message });
      } else {
        stats.inserted++;
      }
    }
  }

  return stats;
}

// =============================================
// POST /api/admin/import-sheet
// =============================================

/**
 * POST /api/admin/import-sheet
 *
 * Body:
 * {
 *   tables?: string[]    // ["students", "courses", "course_access"] or subset
 *   dryRun?: boolean     // true = validate only, don't write
 *   upgradeOnly?: boolean // true = don't downgrade access_tier (default: true)
 *   sheetId?: string     // override GOOGLE_SHEET_ID env
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   dryRun: boolean,
 *   results: { students?: ImportStats, courses?: ImportStats, course_access?: ImportStats },
 *   summary: string
 * }
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch { /* empty body is ok */ }

  const configSheetId = (body.sheetId as string) || process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!configSheetId) {
    return NextResponse.json({
      success: false,
      error: 'Chưa cấu hình GOOGLE_SHEET_ID. Truyền sheetId trong body hoặc set env var.',
    }, { status: 400 });
  }

  const tables = (body.tables as string[]) || ['courses', 'students', 'course_access'];
  const dryRun = body.dryRun !== false && body.dryRun !== undefined ? Boolean(body.dryRun) : false;
  const upgradeOnly = body.upgradeOnly !== false;

  const results: Record<string, ImportStats> = {};

  try {
    // Phase A: Import courses first (needed for course_access resolution)
    if (tables.includes('courses')) {
      results.courses = await importCourses(configSheetId, dryRun);
    }

    // Phase B: Import students (needed for course_access resolution)
    if (tables.includes('students')) {
      results.students = await importStudents(configSheetId, dryRun);
    }

    // Phase C: Import course_access (depends on A and B)
    if (tables.includes('course_access')) {
      results.course_access = await importCourseAccess(configSheetId, dryRun, upgradeOnly);
    }

    // Build summary
    const parts: string[] = [];
    for (const [table, stats] of Object.entries(results)) {
      const s = stats;
      parts.push(
        `${table}: ${s.total} rows (${s.valid} valid, ${s.inserted} inserted, ${s.updated} updated, ${s.skipped} skipped, ${s.invalid} invalid)`
      );
    }

    const totalErrors = Object.values(results).reduce((sum, s) => sum + s.errors.length, 0);

    return NextResponse.json({
      success: true,
      dryRun,
      upgradeOnly,
      results,
      summary: parts.join(' | ') + (totalErrors > 0 ? ` | ${totalErrors} chi tiết lỗi` : ''),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Import lỗi: ${msg}` }, { status: 500 });
  }
}

// =============================================
// GET /api/admin/import-sheet
// =============================================

/**
 * GET /api/admin/import-sheet
 * Preview: fetch headers from each sheet tab to verify structure
 */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json({
      success: false,
      error: 'Chưa cấu hình GOOGLE_SHEET_ID',
    }, { status: 400 });
  }

  // Fetch first few rows from each tab to preview
  const tabs = ['students', 'courses', 'course_access'];
  const preview: Record<string, { found: boolean; rowCount: number; columns: string[]; sample?: Record<string, string> }> = {};

  for (const tab of tabs) {
    const rows = await fetchSheetTab(sheetId, tab);
    if (rows.length > 0) {
      preview[tab] = {
        found: true,
        rowCount: rows.length,
        columns: Object.keys(rows[0]),
        sample: rows[0],
      };
    } else {
      preview[tab] = { found: false, rowCount: 0, columns: [] };
    }
  }

  // Also check legacy tab names
  const legacyTabs = ['Users', 'Courses', 'Enrollments'];
  for (const tab of legacyTabs) {
    const rows = await fetchSheetTab(sheetId, tab);
    if (rows.length > 0) {
      preview[`legacy:${tab}`] = {
        found: true,
        rowCount: rows.length,
        columns: Object.keys(rows[0]),
        sample: rows[0],
      };
    }
  }

  return NextResponse.json({
    success: true,
    sheetId,
    preview,
    instructions: {
      tabs_required: ['students', 'courses', 'course_access'],
      students_columns: ['email (bắt buộc)', 'full_name', 'phone', 'system_role', 'status'],
      courses_columns: ['course_code (bắt buộc)', 'title (bắt buộc)', 'slug', 'status'],
      course_access_columns: ['email (bắt buộc)', 'course_code (bắt buộc)', 'access_tier', 'status', 'activated_at', 'expires_at', 'source'],
    },
  });
}
