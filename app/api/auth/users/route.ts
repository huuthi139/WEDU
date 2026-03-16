import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';

const GAS_TIMEOUT = 15000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = GAS_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJsonParse(res: Response): Promise<any | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json') && !ct.includes('javascript')) return null;
  try { return await res.json(); } catch { return null; }
}

/** Standard user shape returned to client */
interface UserRow {
  Email: string;
  Role: string;
  'Tên': string;
  Level: string;
  Phone: string;
}

/** One-way sync: Google Sheets → Supabase (background, non-blocking, never deletes) */
async function syncSheetUsersBackground(sheetUsers: Array<Record<string, string>>) {
  try {
    const { syncSheetUsersToSupabase } = await import('@/lib/supabase/users');
    const mapped = sheetUsers.map((u) => ({
      email: u.Email || u.email || '',
      name: u['Tên'] || u.name || '',
      phone: u.Phone || u.phone || '',
      role: u.Role || u.role || 'user',
      memberLevel: u.Level || u.memberLevel || 'Free',
      passwordHash: u.Password || u.password_hash || '',
    }));
    await syncSheetUsersToSupabase(mapped);
  } catch (err) {
    console.warn('[Users] Background sync to Supabase failed:', err instanceof Error ? err.message : err);
  }
}

/** Try fetching users from Supabase */
async function fetchFromSupabase(): Promise<UserRow[] | null> {
  try {
    const { getAllUsers } = await import('@/lib/supabase/users');
    const allUsers = await getAllUsers();

    if (!allUsers || allUsers.length === 0) {
      console.log('[Users] Supabase returned 0 users, will try other sources');
      return null; // Return null to trigger fallback
    }

    const users: UserRow[] = allUsers.map(u => ({
      Email: u.email || '',
      Role: u.role || 'user',
      'Tên': u.name || '',
      Level: u.member_level || 'Free',
      Phone: u.phone || '',
    }));

    console.log(`[Users] Supabase returned ${users.length} users`);
    return users;
  } catch (err) {
    console.warn('[Users] Supabase unavailable:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Try fetching users from Google Apps Script (JSON API) */
async function fetchFromGoogleAppsScript(): Promise<UserRow[] | null> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    console.warn('[Users] GOOGLE_SCRIPT_URL not set');
    return null;
  }

  try {
    const res = await fetchWithTimeout(
      `${scriptUrl}?action=getUsers`,
      { redirect: 'follow', cache: 'no-store' }
    );
    const data = await safeJsonParse(res);

    if (data?.success && Array.isArray(data.users) && data.users.length > 0) {
      // Normalize role: 'Student' → 'user' for consistency
      const users: UserRow[] = data.users.map((u: Record<string, string>) => ({
        Email: u.Email || '',
        Role: normalizeRole(u.Role),
        'Tên': u['Tên'] || '',
        Level: u.Level || 'Free',
        Phone: u.Phone || '',
      }));

      // Sync to Supabase in background (non-blocking)
      syncSheetUsersBackground(data.users).catch(() => {});

      console.log(`[Users] Google Apps Script returned ${users.length} users`);
      return users;
    }

    console.warn('[Users] Google Apps Script returned empty or invalid data:', data?.error || 'no data');
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Users] Google Apps Script error:', msg);
    return null;
  }
}

/** Try fetching users from Google Sheets CSV export (direct, no GAS needed) */
async function fetchFromGoogleSheetsCsv(): Promise<UserRow[] | null> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    console.warn('[Users] GOOGLE_SHEET_ID not set');
    return null;
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Users')}`;
    const res = await fetchWithTimeout(csvUrl, { cache: 'no-store' }, 10000);

    if (!res.ok) {
      console.warn('[Users] Google Sheets CSV returned status', res.status);
      return null;
    }

    const csv = await res.text();
    if (!csv || csv.length < 10) return null;

    // Parse CSV manually (simple parser for this use case)
    const { csvToObjects } = await import('@/lib/utils/csv');
    const rows = csvToObjects(csv);

    if (!rows || rows.length === 0) return null;

    const users: UserRow[] = rows.map((row: Record<string, string>) => ({
      Email: row.Email || row.email || '',
      Role: normalizeRole(row.Role || row.role),
      'Tên': row['Tên'] || row.name || '',
      Level: row.Level || row.level || 'Free',
      Phone: row.Phone || row.phone || '',
    }));

    // Sync to Supabase in background
    syncSheetUsersBackground(rows as Array<Record<string, string>>).catch(() => {});

    console.log(`[Users] Google Sheets CSV returned ${users.length} users`);
    return users;
  } catch (err) {
    console.error('[Users] Google Sheets CSV error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Normalize role strings from different sources (e.g. 'Student' → 'user') */
function normalizeRole(role: string | undefined): string {
  if (!role) return 'user';
  const r = role.toLowerCase().trim();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'sub_admin' || r === 'sub-admin') return 'sub_admin';
  if (r === 'instructor') return 'instructor';
  return 'user'; // 'Student', 'student', 'user', or anything else → 'user'
}

/** Verify admin or sub_admin access via JWT session cookie */
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

/** Core handler for fetching users — shared by GET and POST */
async function handleFetchUsers(request: NextRequest): Promise<NextResponse> {
  const isAdmin = await verifyAdmin(request);

  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !hasAdminAccess(clientRole)) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền truy cập', users: [] },
        { status: 403 }
      );
    }
  }

  // Try sources in order: Supabase → Google Apps Script → Google Sheets CSV
  const errors: string[] = [];

  // Method 1: Supabase (primary)
  try {
    const supabaseUsers = await fetchFromSupabase();
    if (supabaseUsers && supabaseUsers.length > 0) {
      return NextResponse.json({ success: true, users: supabaseUsers, source: 'supabase' });
    }
    errors.push('Supabase: 0 users');
  } catch (err) {
    errors.push(`Supabase: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Method 2: Google Apps Script (secondary)
  try {
    const gasUsers = await fetchFromGoogleAppsScript();
    if (gasUsers && gasUsers.length > 0) {
      return NextResponse.json({ success: true, users: gasUsers, source: 'google-apps-script' });
    }
    errors.push('GAS: 0 users');
  } catch (err) {
    errors.push(`GAS: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Method 3: Google Sheets CSV export (tertiary)
  try {
    const csvUsers = await fetchFromGoogleSheetsCsv();
    if (csvUsers && csvUsers.length > 0) {
      return NextResponse.json({ success: true, users: csvUsers, source: 'google-sheets-csv' });
    }
    errors.push('CSV: 0 users');
  } catch (err) {
    errors.push(`CSV: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.error('[Users] All data sources failed:', errors.join(' | '));
  return NextResponse.json(
    { success: false, error: `Không thể tải danh sách học viên (${errors.join('; ')})`, users: [] },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  return handleFetchUsers(request);
}

/** POST handler — same as GET, for environments where GET headers may be stripped */
export async function POST(request: NextRequest) {
  return handleFetchUsers(request);
}
