import { NextRequest, NextResponse } from 'next/server';
import { getScriptUrl, getSheetCsvUrl } from '@/lib/config';
import { csvToObjects } from '@/lib/utils/csv';

// Verify admin role from cookie
function getAdminFromCookie(request: NextRequest): boolean {
  try {
    const cookie = request.cookies.get('wepower-user');
    if (!cookie?.value) return false;
    const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8');
    const user = JSON.parse(decoded);
    return user?.role === 'Admin' || user?.Role === 'Admin';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Authentication: Only admins can list all users
  if (!getAdminFromCookie(request)) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền truy cập. Yêu cầu quyền Admin.' },
      { status: 403 }
    );
  }

  try {
    // Method 1: Google Apps Script
    try {
      const scriptUrl = getScriptUrl();
      const params = new URLSearchParams({ action: 'getUsers' });
      const res = await fetch(`${scriptUrl}?${params.toString()}`, {
          redirect: 'follow',
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.success && data.users) {
          return NextResponse.json({ success: true, users: data.users });
        }
      } catch (err) {
        console.error('Apps Script getUsers error:', err);
      }

    // Method 2: CSV fallback
    try {
      const csvRes = await fetch(getSheetCsvUrl('Users'), { cache: 'no-store' });
      const csv = await csvRes.text();
      const rows = csvToObjects(csv);

      const users = rows.map(row => ({
        Email: row['Email'] || '',
        Role: row['Role'] || 'Student',
        'Tên': row['Tên'] || '',
        Level: row['Level'] || 'Free',
        Phone: row['Phone'] || '',
      }));

      return NextResponse.json({ success: true, users });
    } catch (err) {
      console.error('CSV getUsers error:', err);
    }

    return NextResponse.json({ success: true, users: [] });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
