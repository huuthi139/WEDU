import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhook/sheet-sync
 * Webhook for syncing data between systems.
 * Direction: Supabase is source of truth.
 * This endpoint can be called to trigger Supabase → Sheet sync,
 * or to import legacy Sheet data into Supabase (one-time migration).
 *
 * Auth: Uses SYNC_SECRET header
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function verifySyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  const expected = process.env.SYNC_SECRET;
  if (!expected || expected.length < 16) {
    console.error('[Webhook] SYNC_SECRET not configured or too short');
    return false;
  }
  return secret === expected;
}

export async function POST(request: NextRequest) {
  if (!verifySyncSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const action = body.action || 'exportUsers';

    switch (action) {
      case 'importUsersFromSheet':
        return await handleImportUsersFromSheet();

      case 'exportUsers':
        return await handleExportUsers();

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400, headers: CORS_HEADERS }
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Webhook] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * One-time migration: Import users from Google Sheet → Supabase
 */
async function handleImportUsersFromSheet() {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json(
      { success: false, error: 'GOOGLE_SCRIPT_URL not configured' },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${scriptUrl}?action=getUsersForSync`, {
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (!data?.success || !Array.isArray(data.users)) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users from Sheet' },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const { syncSheetUsersToSupabase } = await import('@/lib/supabase/users');
    const mapped = data.users.map((u: Record<string, string>) => ({
      email: u.Email || u.email || '',
      name: u['Tên'] || u.name || '',
      phone: u.Phone || u.phone || '',
      role: mapRole(u.Role || u.role || ''),
      memberLevel: u.Level || u.memberLevel || 'Free',
      passwordHash: u.Password || u.passwordHash || '',
    }));

    const stats = await syncSheetUsersToSupabase(mapped);

    return NextResponse.json({
      success: true,
      message: `Imported: ${stats.added} added, ${stats.updated} updated, ${stats.skipped} skipped`,
      stats,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Export Supabase users info (for Sheet sync or reporting)
 */
async function handleExportUsers() {
  const { getAllUsers } = await import('@/lib/supabase/users');
  const users = await getAllUsers();

  return NextResponse.json({
    success: true,
    count: users.length,
    users: users.map(u => ({
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      memberLevel: u.member_level,
      createdAt: u.created_at,
    })),
  }, { headers: CORS_HEADERS });
}

function mapRole(role: string): string {
  const r = role.toLowerCase().trim();
  if (r === 'admin' || r === 'administrator' || r.includes('quản trị') || r === 'qtv') return 'admin';
  if (r === 'sub_admin' || r === 'sub admin') return 'sub_admin';
  if (r === 'instructor' || r === 'giảng viên') return 'instructor';
  return 'user';
}
