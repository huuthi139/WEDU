import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole, hasAdminAccess } from '@/lib/utils/auth';

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

export async function GET(request: NextRequest) {
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

  // Method 1: Try Supabase
  try {
    const { getAllUsers } = await import('@/lib/supabase/users');
    const allUsers = await getAllUsers();

    const users = allUsers.map(u => ({
      Email: u.email || '',
      Role: u.role || 'user',
      'Tên': u.name || '',
      Level: u.member_level || 'Free',
      Phone: u.phone || '',
    }));

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.warn('[Users] Supabase unavailable, trying Google Sheets fallback:', err instanceof Error ? err.message : err);
  }

  // Method 2: Google Apps Script fallback (reads from Google Sheets Users tab)
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (scriptUrl) {
    try {
      const res = await fetchWithTimeout(
        `${scriptUrl}?action=getUsers`,
        { redirect: 'follow' }
      );
      const data = await safeJsonParse(res);

      if (data?.success && Array.isArray(data.users)) {
        const users = data.users.map((u: Record<string, string>) => ({
          Email: u.Email || '',
          Role: u.Role || 'user',
          'Tên': u['Tên'] || '',
          Level: u.Level || 'Free',
          Phone: u.Phone || '',
        }));

        return NextResponse.json({ success: true, users });
      }
    } catch (scriptErr) {
      const msg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
      console.error('[Users] Google Script error:', msg);
    }
  }

  return NextResponse.json(
    { success: false, error: 'Không thể tải danh sách học viên', users: [] },
    { status: 503 }
  );
}
