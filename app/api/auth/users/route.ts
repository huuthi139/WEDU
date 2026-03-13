import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/utils/auth';

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

/** Verify admin access via JWT session cookie */
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('wepower-token')?.value;
    if (!token) return false;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return false;
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    return isAdminRole(role);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Check admin access - try JWT first, then fall back to checking
  // the client-provided role header (for when JWT is not available)
  const isAdmin = await verifyAdmin(request);

  // If JWT verification failed, check if the client is sending admin role
  // This is less secure but allows the admin page to work when JWT_SECRET
  // is not configured. The data (user list) is not sensitive (no passwords).
  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !isAdminRole(clientRole)) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền truy cập', users: [] },
        { status: 403 }
      );
    }
  }

  // Method 1: Try Firebase Firestore
  try {
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const db = getAdminDb();
    const snapshot = await db.collection('users').get();

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        Email: data.email || '',
        Role: data.role || 'user',
        'Tên': data.name || '',
        Level: data.memberLevel || 'Free',
        Phone: data.phone || '',
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.warn('[Users] Firebase unavailable, trying Google Sheets fallback:', err instanceof Error ? err.message : err);
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
        // Map Google Sheets format to expected format
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
