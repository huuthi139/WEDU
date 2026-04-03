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
  normalizeCourseVisibility,
  mergeAccessTier,
  parseDate,
  parseCSV,
  getCol,
  detectDuplicateRows,
  emptyStats,
  type ImportStats,
  type ImportError,
} from '@/lib/import/helpers';
import { writeAuditLog, writeAuditLogBatch, logImportRun, type AuditEntry } from '@/lib/telemetry/audit';
import { LOCKED_PASSWORD_SENTINEL } from '@/lib/auth/password';

// =============================================
// AUTH
// =============================================

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return { isAdmin: false };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return { isAdmin: false };
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    const userId = (payload as { userId?: string }).userId;
    return { isAdmin: hasAdminAccess(role), userId };
  } catch {
    return { isAdmin: false };
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
  actorUserId?: string,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();
  const auditEntries: AuditEntry[] = [];

  const rows = await fetchSheetTab(sheetId, 'courses');
  stats.total = rows.length;

  // Detect duplicate course_code rows
  const duplicates = detectDuplicateRows(rows, (row) =>
    getCol(row, 'course_code', 'courseCode', 'ID', 'id', 'code').trim().toLowerCase()
  );
  for (const [key, rowNums] of duplicates) {
    stats.errors.push({
      row: rowNums[0],
      field: 'duplicate',
      value: key,
      message: `Duplicate course_code "${key}" tai cac dong: ${rowNums.join(', ')}. Chi giu dong cuoi.`,
    });
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    // Column mapping: flexible names
    const courseCode = getCol(row, 'course_code', 'courseCode', 'ID', 'id', 'code').trim();
    const title = getCol(row, 'title', 'Title', 'Tên khóa học').trim();
    const slug = getCol(row, 'slug', 'Slug').trim();
    const statusRaw = getCol(row, 'status', 'Status', 'Trạng thái');
    const visibilityRaw = getCol(row, 'visibility', 'Visibility');

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
      .select('id, title, status, visibility')
      .eq('id', lookupId)
      .limit(1)
      .single();

    const courseStatus = normalizeCourseStatus(statusRaw);
    const courseData: Record<string, unknown> = {
      title,
      status: courseStatus,
      visibility: normalizeCourseVisibility(visibilityRaw),
      is_active: courseStatus === 'published',
      updated_at: new Date().toISOString(),
    };

    // Only set optional fields if non-empty (don't overwrite good data with empty)
    const desc = getCol(row, 'description', 'short_description', 'Description', 'Mô tả');
    if (desc) courseData.description = desc;
    const thumb = getCol(row, 'thumbnail', 'Thumbnail');
    if (thumb) courseData.thumbnail = thumb;
    const instructor = getCol(row, 'instructor', 'Instructor', 'Giảng viên');
    if (instructor) courseData.instructor = instructor;
    const category = getCol(row, 'category', 'Category', 'Danh mục');
    if (category) courseData.category = category;

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
        auditEntries.push({
          actorUserId,
          actionType: 'course_upsert',
          targetTable: 'courses',
          targetId: lookupId,
          entityKey: lookupId,
          oldValue: { title: existing.title, status: existing.status },
          newValue: courseData as Record<string, unknown>,
          status: 'success',
        });
      }
    } else {
      courseData.id = lookupId;
      courseData.created_at = new Date().toISOString();
      const { error } = await supabase.from('courses').insert(courseData);
      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: lookupId, message: error.message });
      } else {
        stats.inserted++;
        auditEntries.push({
          actorUserId,
          actionType: 'course_upsert',
          targetTable: 'courses',
          targetId: lookupId,
          entityKey: lookupId,
          newValue: courseData as Record<string, unknown>,
          status: 'success',
        });
      }
    }
  }

  // Write audit logs in batch (non-blocking)
  if (auditEntries.length > 0) {
    writeAuditLogBatch(auditEntries).catch(() => {});
  }

  return stats;
}

// =============================================
// PHASE B: IMPORT STUDENTS (PROFILES)
// =============================================

async function importStudents(
  sheetId: string,
  dryRun: boolean,
  actorUserId?: string,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();
  const auditEntries: AuditEntry[] = [];

  const rows = await fetchSheetTab(sheetId, 'students');
  // Fallback: try "Users" tab if "students" is empty
  const actualRows = rows.length > 0 ? rows : await fetchSheetTab(sheetId, 'Users');
  stats.total = actualRows.length;

  // Detect duplicate emails
  const duplicates = detectDuplicateRows(actualRows, (row) =>
    normalizeEmail(getCol(row, 'email', 'Email', 'E-mail', 'EmailAddress'))
  );
  for (const [key, rowNums] of duplicates) {
    stats.errors.push({
      row: rowNums[0],
      field: 'duplicate',
      value: key,
      message: `Duplicate email "${key}" tai cac dong: ${rowNums.join(', ')}. Chi giu dong cuoi.`,
    });
  }

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
      .select('id, email, name, phone, system_role, status, password_hash')
      .eq('email', email)
      .limit(1)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update only non-empty fields, don't overwrite good data with empty
      const updates: Record<string, unknown> = { updated_at: now };
      if (fullName && fullName !== existing.name) updates.name = fullName;
      if (phone && phone !== existing.phone) updates.phone = phone;
      if (systemRoleRaw && systemRole !== existing.system_role) updates.system_role = systemRole;
      if (statusRaw && userStatus !== existing.status) updates.status = userStatus;

      // Also update legacy role field for backward compatibility
      if (systemRoleRaw) {
        const legacyRole = systemRole === 'admin' ? 'admin' : systemRole === 'instructor' ? 'instructor' : 'user';
        updates.role = legacyRole;
      }

      // SAFETY: Never overwrite an active password_hash with empty/locked sentinel
      // Only set password if existing user has NO password (is locked)
      const isLocked = !existing.password_hash || existing.password_hash === LOCKED_PASSWORD_SENTINEL;
      if (passwordRaw && isLocked) {
        try {
          const { hashPassword } = await import('@/lib/auth/password');
          updates.password_hash = await hashPassword(passwordRaw);
          stats.errors.push({ row: rowNum, field: 'info', value: email, message: 'Đã set password cho user chưa có mật khẩu' });
        } catch { /* ignore hash failure */ }
      }

      if (Object.keys(updates).length > 1) {
        const { error } = await supabase.from('users').update(updates).eq('email', email);
        if (error) {
          stats.errors.push({ row: rowNum, field: 'update', value: email, message: error.message });
        } else {
          stats.updated++;
          auditEntries.push({
            actorUserId,
            actionType: 'user_upsert',
            targetTable: 'users',
            targetId: existing.id,
            entityKey: email,
            oldValue: { name: existing.name, system_role: existing.system_role, status: existing.status },
            newValue: updates as Record<string, unknown>,
            status: 'success',
          });
        }
      } else {
        stats.skipped++;
      }
    } else {
      // Create new profile
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

      // Hash password if provided, otherwise lock account until activation via forgot-password flow
      if (passwordRaw) {
        try {
          const { hashPassword } = await import('@/lib/auth/password');
          insertData.password_hash = await hashPassword(passwordRaw);
        } catch {
          insertData.password_hash = LOCKED_PASSWORD_SENTINEL;
          stats.errors.push({ row: rowNum, field: 'warning', value: email, message: 'Hash password thất bại, user cần dùng "Quên mật khẩu" để kích hoạt' });
        }
      } else {
        insertData.password_hash = LOCKED_PASSWORD_SENTINEL;
      }

      const { error } = await supabase.from('users').insert(insertData);
      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: email, message: error.message });
      } else {
        stats.inserted++;
        if (!passwordRaw) {
          stats.errors.push({ row: rowNum, field: 'info', value: email, message: 'Tạo user không có mật khẩu → cần dùng "Quên mật khẩu" để kích hoạt tài khoản' });
        }
        auditEntries.push({
          actorUserId,
          actionType: 'user_upsert',
          targetTable: 'users',
          entityKey: email,
          newValue: { email, name: insertData.name, system_role: systemRole, status: userStatus, hasPassword: !!passwordRaw },
          status: 'success',
        });
      }
    }
  }

  if (auditEntries.length > 0) {
    writeAuditLogBatch(auditEntries).catch(() => {});
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
  actorUserId?: string,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();
  const auditEntries: AuditEntry[] = [];

  const rows = await fetchSheetTab(sheetId, 'course_access');
  // Fallback: try "Enrollments" tab
  const actualRows = rows.length > 0 ? rows : await fetchSheetTab(sheetId, 'Enrollments');
  stats.total = actualRows.length;

  // Pre-fetch user email -> id lookup
  const userCache = new Map<string, string>();
  // Pre-fetch course code -> id lookup
  const courseCache = new Map<string, string>();

  // Collect unique duplicates: email+courseCode -> best row (highest tier)
  const seenPairs = new Map<string, { tier: string; rowNum: number; rowIdx: number }>();

  // First pass: deduplicate by email+courseCode, keeping highest tier
  for (let i = 0; i < actualRows.length; i++) {
    const row = actualRows[i];
    const rowNum = i + 2;

    const email = normalizeEmail(
      getCol(row, 'email', 'Email', 'user_email', 'userId', 'student_email')
    );
    const courseCode = getCol(row, 'course_code', 'courseCode', 'course_id', 'courseId', 'Mã khóa học').trim();
    const tierRaw = getCol(row, 'access_tier', 'accessTier', 'tier', 'Tier', 'Level', 'level');

    if (!email || !courseCode) continue;

    const tier = normalizeAccessTier(tierRaw || 'premium') || 'premium';
    const pairKey = `${email}::${courseCode}`;
    const existing = seenPairs.get(pairKey);

    if (existing) {
      const merged = mergeAccessTier(
        (existing.tier as 'free' | 'premium' | 'vip'),
        tier as 'free' | 'premium' | 'vip',
        true
      );
      seenPairs.set(pairKey, { tier: merged, rowNum, rowIdx: merged !== existing.tier ? i : existing.rowIdx });
      stats.errors.push({
        row: rowNum,
        field: 'duplicate',
        value: pairKey,
        message: `Duplicate email+course_code, giữ tier cao nhất: ${merged}`,
      });
    } else {
      seenPairs.set(pairKey, { tier, rowNum, rowIdx: i });
    }
  }

  // Second pass: process unique pairs
  const processedPairs = new Set<string>();

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

    // Skip if this pair was already processed (duplicate rows - we use the best tier from first pass)
    const pairKey = `${email}::${courseCode}`;
    const bestPair = seenPairs.get(pairKey);
    if (processedPairs.has(pairKey)) {
      stats.skipped++;
      continue;
    }
    processedPairs.add(pairKey);

    // Use the best (highest) tier from duplicate resolution
    const tier = bestPair ? (bestPair.tier as 'free' | 'premium' | 'vip') : (normalizeAccessTier(tierRaw || 'premium') || 'premium') as 'free' | 'premium' | 'vip';

    if (!normalizeAccessTier(tier)) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'access_tier', value: tierRaw, message: `access_tier không hợp lệ: "${tierRaw}". Chỉ chấp nhận: free, premium, vip` });
      continue;
    }

    const accessStatus = normalizeAccessStatus(statusRaw);
    const source = normalizeAccessSource(sourceRaw || 'import');
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
        // Auto-create placeholder profile (locked – must activate via forgot-password)
        const now = new Date().toISOString();
        const { data: newUser, error: createErr } = await supabase
          .from('users')
          .insert({
            email,
            name: email.split('@')[0],
            phone: '',
            password_hash: LOCKED_PASSWORD_SENTINEL,
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
        stats.errors.push({ row: rowNum, field: 'info', value: email, message: 'Đã tạo profile placeholder (bị khóa - cần "Quên mật khẩu" để kích hoạt)' });
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
          const actionType = mergedTier !== currentTier ? 'course_access_upgrade' : 'course_access_upsert';
          auditEntries.push({
            actorUserId,
            actionType,
            targetTable: 'course_access',
            targetId: existingAccess.id,
            entityKey: `${email}::${courseCode}`,
            oldValue: { access_tier: currentTier, status: existingAccess.status },
            newValue: updates as Record<string, unknown>,
            status: 'success',
          });
        }
      } else {
        stats.skipped++;
      }
    } else {
      // Insert new course_access
      const insertData = {
        user_id: userId,
        course_id: courseId,
        access_tier: tier,
        source,
        status: accessStatus,
        activated_at: activatedAt,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('course_access').insert(insertData);

      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: `${email}:${courseCode}`, message: error.message });
      } else {
        stats.inserted++;
        auditEntries.push({
          actorUserId,
          actionType: 'course_access_upsert',
          targetTable: 'course_access',
          entityKey: `${email}::${courseCode}`,
          newValue: insertData as unknown as Record<string, unknown>,
          status: 'success',
        });
      }
    }
  }

  if (auditEntries.length > 0) {
    writeAuditLogBatch(auditEntries).catch(() => {});
  }

  return stats;
}

// =============================================
// PHASE D: IMPORT ORDERS (Đơn hàng / Học viên đã mua)
// =============================================

async function importOrders(
  sheetId: string,
  dryRun: boolean,
  upgradeOnly: boolean,
  actorUserId?: string,
): Promise<ImportStats> {
  const supabase = getSupabaseAdmin();
  const stats = emptyStats();
  const auditEntries: AuditEntry[] = [];

  const rows = await fetchSheetTab(sheetId, 'orders');
  stats.total = rows.length;

  if (rows.length === 0) {
    stats.errors.push({ row: 0, field: 'info', value: 'orders', message: 'Tab "orders" không tìm thấy hoặc trống' });
    return stats;
  }

  // Column mapping helpers
  const getEmail = (row: Record<string, string>) =>
    normalizeEmail(getCol(row, 'Email', 'email', 'E-mail'));
  const getName = (row: Record<string, string>) =>
    getCol(row, 'Tên', 'Ten', 'Name', 'Họ tên', 'Ho ten', 'name', 'full_name').trim();
  const getPhone = (row: Record<string, string>) =>
    getCol(row, 'SĐT', 'SDT', 'Phone', 'Số điện thoại', 'So dien thoai', 'phone').trim();
  const getCourseCode = (row: Record<string, string>) =>
    getCol(row, 'Mã khoá học', 'Ma khoa', 'Course ID', 'course_code', 'Mã khóa học', 'courseCode', 'ID khóa').trim();
  const getTier = (row: Record<string, string>) =>
    getCol(row, 'Hạng', 'Level', 'access_tier', 'Tier', 'level', 'tier', 'Hang');
  const getActivatedAt = (row: Record<string, string>) =>
    getCol(row, 'Ngày đăng ký', 'activated_at', 'Ngày mua', 'Ngay dang ky', 'Ngay mua');
  const getStatus = (row: Record<string, string>) =>
    getCol(row, 'Trạng thái', 'Status', 'status', 'Trang thai');
  const getNote = (row: Record<string, string>) =>
    getCol(row, 'Ghi chú', 'Note', 'note', 'Ghi chu');

  // Detect duplicate email+courseCode pairs in file
  const duplicates = detectDuplicateRows(rows, (row) => {
    const email = getEmail(row);
    const code = getCourseCode(row);
    return email && code ? `${email}::${code}` : '';
  });
  for (const [key, rowNums] of duplicates) {
    stats.errors.push({
      row: rowNums[0],
      field: 'duplicate',
      value: key,
      message: `Duplicate email+mã khoá "${key}" tại các dòng: ${rowNums.join(', ')}. Chỉ giữ dòng cuối.`,
    });
  }

  // Caches
  const userCache = new Map<string, string>();
  const courseCache = new Map<string, string>();
  const processedPairs = new Set<string>();

  // Track extra stats for orders
  let usersCreated = 0;
  let usersExisted = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    const email = getEmail(row);
    const name = getName(row);
    const phone = getPhone(row);
    const courseCode = getCourseCode(row);
    const tierRaw = getTier(row);
    const activatedAtRaw = getActivatedAt(row);
    const statusRaw = getStatus(row);
    const note = getNote(row);

    // --- Validation ---
    if (!email) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'email', value: '', message: 'Email không được rỗng' });
      continue;
    }

    if (!isValidEmail(email)) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'email', value: email, message: 'Email không hợp lệ' });
      continue;
    }

    if (!courseCode) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'course_code', value: '', message: 'Mã khoá học không được rỗng' });
      continue;
    }

    const tier = normalizeAccessTier(tierRaw || 'premium');
    if (!tier) {
      stats.invalid++;
      stats.errors.push({ row: rowNum, field: 'access_tier', value: tierRaw, message: `Hạng không hợp lệ: "${tierRaw}". Chỉ chấp nhận: free, premium, vip` });
      continue;
    }

    // Skip duplicate email+course in same file (keep last)
    const pairKey = `${email}::${courseCode}`;
    if (processedPairs.has(pairKey)) {
      stats.skipped++;
      continue;
    }
    // Check if there's a later row with same pair → skip this one
    const dupInfo = duplicates.get(pairKey);
    if (dupInfo && rowNum < dupInfo[dupInfo.length - 1]) {
      stats.skipped++;
      continue;
    }
    processedPairs.add(pairKey);

    const accessStatus = normalizeAccessStatus(statusRaw);
    const activatedAt = parseDate(activatedAtRaw) || new Date().toISOString();

    stats.valid++;
    if (dryRun) continue;

    // --- Step A: Resolve or create user ---
    let userId = userCache.get(email);
    if (!userId) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, member_level')
        .eq('email', email)
        .limit(1)
        .single();

      if (existingUser) {
        userId = existingUser.id as string;
        userCache.set(email, userId);
        usersExisted++;
      } else {
        // Create new user
        const now = new Date().toISOString();
        const memberLevel = tier === 'vip' ? 'VIP' : tier === 'premium' ? 'Premium' : 'Free';
        const { data: newUser, error: createErr } = await supabase
          .from('users')
          .insert({
            email,
            name: name || email.split('@')[0],
            phone: phone || '',
            password_hash: LOCKED_PASSWORD_SENTINEL,
            role: 'user',
            system_role: 'student',
            member_level: memberLevel,
            status: 'active',
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single();

        if (createErr || !newUser) {
          stats.errors.push({ row: rowNum, field: 'user', value: email, message: `Không thể tạo user: ${createErr?.message || 'unknown'}` });
          continue;
        }

        userId = newUser.id as string;
        userCache.set(email, userId);
        usersCreated++;
        stats.errors.push({ row: rowNum, field: 'info', value: email, message: `Tạo user mới (${name || email.split('@')[0]}) - cần "Quên mật khẩu" để kích hoạt` });

        auditEntries.push({
          actorUserId,
          actionType: 'user_upsert',
          targetTable: 'users',
          targetId: userId,
          entityKey: email,
          newValue: { email, name: name || email.split('@')[0], member_level: memberLevel },
          status: 'success',
        });
      }
    } else {
      usersExisted++;
    }

    // --- Step B: Resolve course ---
    let courseId = courseCache.get(courseCode);
    if (!courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseCode)
        .limit(1)
        .single();

      if (course) {
        courseId = course.id;
      } else {
        // Try slug fallback
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
        stats.errors.push({ row: rowNum, field: 'course_code', value: courseCode, message: `Không tìm thấy khoá học với ID/slug: "${courseCode}"` });
        continue;
      }

      courseCache.set(courseCode, courseId);
    }

    // --- Step C: Upsert course_access ---
    const { data: existingAccess } = await supabase
      .from('course_access')
      .select('id, access_tier, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .limit(1)
      .single();

    if (existingAccess) {
      const currentTier = (existingAccess.access_tier || 'free') as 'free' | 'premium' | 'vip';
      const mergedTier = mergeAccessTier(currentTier, tier as 'free' | 'premium' | 'vip', upgradeOnly);

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (mergedTier !== currentTier) updates.access_tier = mergedTier;
      if (accessStatus === 'active' && existingAccess.status !== 'active') {
        updates.status = 'active';
        updates.activated_at = activatedAt;
      }

      if (Object.keys(updates).length > 1) {
        const { error } = await supabase
          .from('course_access')
          .update(updates)
          .eq('id', existingAccess.id);

        if (error) {
          stats.errors.push({ row: rowNum, field: 'update', value: `${email}:${courseCode}`, message: error.message });
        } else {
          stats.updated++;
          auditEntries.push({
            actorUserId,
            actionType: 'course_access_upsert',
            targetTable: 'course_access',
            targetId: existingAccess.id,
            entityKey: `${email}::${courseCode}`,
            oldValue: { access_tier: currentTier, status: existingAccess.status },
            newValue: updates as Record<string, unknown>,
            status: 'success',
          });
        }
      } else {
        stats.skipped++;
      }
    } else {
      // Insert new course_access
      const insertData: Record<string, unknown> = {
        user_id: userId,
        course_id: courseId,
        access_tier: tier,
        source: 'import',
        status: accessStatus,
        activated_at: activatedAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (note) insertData.notes = note;

      const { error } = await supabase.from('course_access').insert(insertData);

      if (error) {
        stats.errors.push({ row: rowNum, field: 'insert', value: `${email}:${courseCode}`, message: error.message });
      } else {
        stats.inserted++;
        auditEntries.push({
          actorUserId,
          actionType: 'course_access_upsert',
          targetTable: 'course_access',
          entityKey: `${email}::${courseCode}`,
          newValue: insertData as Record<string, unknown>,
          status: 'success',
        });
      }
    }

    // --- Step D: Upgrade user member_level if needed ---
    const { data: userRow } = await supabase
      .from('users')
      .select('member_level')
      .eq('id', userId)
      .limit(1)
      .single();

    if (userRow) {
      const currentLevel = (userRow.member_level || 'Free').toLowerCase();
      const newLevel = tier === 'vip' ? 'vip' : tier === 'premium' ? 'premium' : 'free';
      const levelRank: Record<string, number> = { free: 0, premium: 1, vip: 2 };

      if ((levelRank[newLevel] || 0) > (levelRank[currentLevel] || 0)) {
        const displayLevel = newLevel === 'vip' ? 'VIP' : newLevel === 'premium' ? 'Premium' : 'Free';
        const { error } = await supabase
          .from('users')
          .update({ member_level: displayLevel, updated_at: new Date().toISOString() })
          .eq('id', userId);

        if (!error) {
          stats.errors.push({
            row: rowNum,
            field: 'info',
            value: email,
            message: `Upgrade member_level: ${userRow.member_level} → ${displayLevel}`,
          });
        }
      }
    }
  }

  // Add summary info
  stats.errors.push({
    row: 0,
    field: 'info',
    value: 'summary',
    message: `Users mới tạo: ${usersCreated} | Users đã tồn tại: ${usersExisted}`,
  });

  if (auditEntries.length > 0) {
    writeAuditLogBatch(auditEntries).catch(() => {});
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
  const { isAdmin, userId: actorUserId } = await verifyAdmin(request);
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
  const dryRun = body.dryRun === true;
  const upgradeOnly = body.upgradeOnly !== false;

  const results: Record<string, ImportStats> = {};

  try {
    // Phase A: Import courses first (needed for course_access resolution)
    if (tables.includes('courses')) {
      results.courses = await importCourses(configSheetId, dryRun, actorUserId);
    }

    // Phase B: Import students (needed for course_access resolution)
    if (tables.includes('students')) {
      results.students = await importStudents(configSheetId, dryRun, actorUserId);
    }

    // Phase C: Import course_access (depends on A and B)
    if (tables.includes('course_access')) {
      results.course_access = await importCourseAccess(configSheetId, dryRun, upgradeOnly, actorUserId);
    }

    // Phase D: Import orders (đơn hàng / học viên đã mua)
    if (tables.includes('orders')) {
      results.orders = await importOrders(configSheetId, dryRun, upgradeOnly, actorUserId);
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
    const totalRows = Object.values(results).reduce((sum, s) => sum + s.total, 0);

    // Log import run to audit (non-blocking)
    logImportRun({
      actorUserId,
      dryRun,
      tables,
      results: Object.fromEntries(
        Object.entries(results).map(([k, v]) => [k, {
          total: v.total, valid: v.valid, inserted: v.inserted,
          updated: v.updated, skipped: v.skipped, invalid: v.invalid,
          errorCount: v.errors.length,
        }])
      ),
      totalRows,
      totalErrors,
    }).catch(() => {});

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
  const { isAdmin } = await verifyAdmin(request);
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
  const tabs = ['students', 'courses', 'course_access', 'orders'];
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
      tabs_required: ['students', 'courses', 'course_access', 'orders (tùy chọn)'],
      students_columns: ['email (bắt buộc)', 'full_name', 'phone', 'system_role', 'status', 'password (tùy chọn - nếu trống, user cần dùng "Quên mật khẩu" để kích hoạt)'],
      courses_columns: ['course_code (bắt buộc)', 'title (bắt buộc)', 'slug', 'status', 'visibility', 'short_description'],
      course_access_columns: ['email (bắt buộc)', 'course_code (bắt buộc)', 'access_tier', 'status', 'activated_at', 'expires_at', 'source'],
      orders_columns: ['Email (bắt buộc)', 'Mã khoá học (bắt buộc)', 'Tên', 'SĐT', 'Khoá học', 'Hạng', 'Ngày đăng ký', 'Trạng thái', 'Ghi chú'],
    },
  });
}
