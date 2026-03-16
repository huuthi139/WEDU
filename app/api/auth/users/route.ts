import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';

const FETCH_TIMEOUT = 20000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Standard user shape returned to client */
interface UserRow {
  Email: string;
  Role: string;
  'Tên': string;
  Level: string;
  Phone: string;
}

function normalizeRole(role: string | undefined): string {
  if (!role) return 'user';
  const r = role.toLowerCase().trim();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'sub_admin' || r === 'sub-admin') return 'sub_admin';
  if (r === 'instructor') return 'instructor';
  return 'user';
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

/** Try fetching from Supabase */
async function fetchFromSupabase(): Promise<UserRow[] | null> {
  try {
    const { getAllUsers } = await import('@/lib/supabase/users');
    const allUsers = await getAllUsers();
    if (!allUsers || allUsers.length === 0) return null;
    return allUsers.map(u => ({
      Email: u.email || '',
      Role: u.role || 'user',
      'Tên': u.name || '',
      Level: u.member_level || 'Free',
      Phone: u.phone || '',
    }));
  } catch (err) {
    console.error('[Users] Supabase error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Try fetching from GAS */
async function fetchFromGAS(): Promise<UserRow[] | null> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return null;

  try {
    const res = await fetchWithTimeout(`${scriptUrl}?action=getUsers`, {
      redirect: 'follow',
      cache: 'no-store',
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (data?.success && Array.isArray(data.users) && data.users.length > 0) {
      return data.users.map((u: Record<string, string>) => ({
        Email: u.Email || '',
        Role: normalizeRole(u.Role),
        'Tên': u['Tên'] || '',
        Level: u.Level || 'Free',
        Phone: u.Phone || '',
      }));
    }
    return null;
  } catch (err) {
    console.error('[Users] GAS error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Try fetching from CSV */
async function fetchFromCSV(): Promise<UserRow[] | null> {
  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) return null;

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Users')}`;
    const res = await fetchWithTimeout(csvUrl, { cache: 'no-store' }, 15000);
    if (!res.ok) return null;

    const csv = await res.text();
    if (!csv || csv.length < 10) return null;

    const { csvToObjects } = await import('@/lib/utils/csv');
    const rows = csvToObjects(csv);
    if (!rows || rows.length === 0) return null;

    return rows.map((row: Record<string, string>) => ({
      Email: row.Email || row.email || '',
      Role: normalizeRole(row.Role || row.role),
      'Tên': row['Tên'] || row.name || '',
      Level: row.Level || row.level || 'Free',
      Phone: row.Phone || row.phone || '',
    }));
  } catch (err) {
    console.error('[Users] CSV error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Core handler */
async function handleFetchUsers(request: NextRequest): Promise<NextResponse> {
  // Auth check
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

  // Try sources in order
  const sources = [
    { name: 'supabase', fn: fetchFromSupabase },
    { name: 'gas', fn: fetchFromGAS },
    { name: 'csv', fn: fetchFromCSV },
  ];

  for (const { name, fn } of sources) {
    const users = await fn();
    if (users && users.length > 0) {
      console.log(`[Users] ${name} returned ${users.length} users`);
      return NextResponse.json({ success: true, users, source: name });
    }
  }

  // ALL server-side sources failed.
  // Return fallback URLs so the CLIENT can try fetching directly from browser.
  const gasUrl = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';
  const sheetId = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '';

  console.error('[Users] All server-side sources failed');
  return NextResponse.json(
    {
      success: false,
      error: 'Server không tải được dữ liệu',
      users: [],
      // Give client the URLs to try directly from browser
      fallback: { gasUrl, sheetId },
    },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  return handleFetchUsers(request);
}

export async function POST(request: NextRequest) {
  return handleFetchUsers(request);
}
