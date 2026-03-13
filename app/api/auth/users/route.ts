import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  // Note: Admin check is handled by middleware (verifies JWT role=admin)

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
      const res = await fetch(`${scriptUrl}?action=getUsers`, { redirect: 'follow' });
      const data = await res.json();

      if (data.success && Array.isArray(data.users)) {
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
      console.error('[Users] Google Script error:', scriptErr instanceof Error ? scriptErr.message : scriptErr);
    }
  }

  return NextResponse.json(
    { success: false, error: 'Không thể tải danh sách học viên', users: [] },
    { status: 503 }
  );
}
