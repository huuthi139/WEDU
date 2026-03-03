import { NextResponse } from 'next/server';
import { getScriptUrl, getSheetCsvUrl, getSheetId } from '@/lib/config';

const SHEET_NAME = 'Users';
const FETCH_TIMEOUT_MS = 10_000;

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 15) : '';

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Tên phải có ít nhất 2 ký tự' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    // Method 1: Google Apps Script via GET
    const scriptUrl = getScriptUrl();
    try {
      const params = new URLSearchParams({
        action: 'register',
        name,
        email,
        password,
        phone: phone || '',
      });
      const fullUrl = `${scriptUrl}?${params.toString()}`;
      const res = await fetchWithTimeout(fullUrl, { redirect: 'follow' });
      const data = await res.json();

      if (data.success) {
        return NextResponse.json({ success: true, user: data.user });
      }

      return NextResponse.json(
        { success: false, error: data.error || 'Đăng ký thất bại' },
        { status: data.error?.includes('đã được sử dụng') ? 409 : 400 }
      );
    } catch (err) {
      console.error('Apps Script register error:', err instanceof Error ? err.message : err);
    }

    // Method 2: Check email via CSV + write via Sheets API
    try {
      const csvRes = await fetchWithTimeout(getSheetCsvUrl(SHEET_NAME), { cache: 'no-store' });
      const csv = await csvRes.text();
      const users = parseCSV(csv);

      const existingUser = users.find(
        u => (u['Email'] || '').toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Email đã được sử dụng. Vui lòng dùng email khác.' },
          { status: 409 }
        );
      }
    } catch {
      // Can't check, continue
    }

    // Row data thứ tự khớp headers thực tế: Email | Password | Role | Tên | Level | Enrolled | Completed | Phone
    const rowData = [email, password, 'Student', name, 'Free', '', '', phone || ''];

    let written = false;
    if (process.env.GOOGLE_SHEETS_API_KEY) {
      try {
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${getSheetId()}/values/${encodeURIComponent(SHEET_NAME)}!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${process.env.GOOGLE_SHEETS_API_KEY}`;
        const res = await fetchWithTimeout(appendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [rowData] }),
        });
        if (res.ok) written = true;
      } catch (err) {
        console.error('Sheets API write error:', err instanceof Error ? err.message : err);
      }
    }

    if (!written) {
      return NextResponse.json(
        { success: false, error: 'Không thể kết nối đến hệ thống. Vui lòng thử lại sau.', useClientFallback: true },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      user: { name, email, phone: phone || '', role: 'user', memberLevel: 'Free' },
    });
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
