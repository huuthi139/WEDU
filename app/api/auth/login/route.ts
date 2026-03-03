import { NextResponse } from 'next/server';
import { getScriptUrl, getSheetCsvUrl } from '@/lib/config';

const SHEET_NAME = 'Users';
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
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
    return values;
  };

  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function getCol(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

function isAdminRole(roleValue: string): boolean {
  const normalized = roleValue.toLowerCase().trim();
  const adminValues = ['admin', 'administrator', 'quản trị', 'quản trị viên', 'qtv'];
  return adminValues.some(v => normalized.includes(v));
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
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email và mật khẩu không được để trống' },
        { status: 400 }
      );
    }

    // Method 1: Google Apps Script via GET
    const gsScriptUrl = getScriptUrl();
    try {
      const params = new URLSearchParams({ action: 'login', email, password });
      const scriptUrl = `${gsScriptUrl}?${params.toString()}`;
      const res = await fetchWithTimeout(scriptUrl, { redirect: 'follow' });
      const data = await res.json();

      if (data.success) {
        const user = data.user;
        if (user && user.role) {
          user.role = isAdminRole(user.role) ? 'admin' : 'user';
        }
        return NextResponse.json({ success: true, user });
      }

      return NextResponse.json(
        { success: false, error: data.error || 'Đăng nhập thất bại' },
        { status: 401 }
      );
    } catch (err) {
      console.error('Apps Script login error:', err instanceof Error ? err.message : err);
    }

    // Method 2: Đọc CSV từ Google Sheets
    try {
      const csvRes = await fetchWithTimeout(getSheetCsvUrl(SHEET_NAME), { cache: 'no-store' });
      const csv = await csvRes.text();
      const users = parseCSV(csv);

      const user = users.find(
        u => getCol(u, 'Email', 'email').toLowerCase() === email.toLowerCase()
      );

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Email hoặc mật khẩu không đúng' },
          { status: 401 }
        );
      }

      const userPassword = getCol(user, 'Password', 'Mật khẩu');
      if (userPassword !== password) {
        return NextResponse.json(
          { success: false, error: 'Email hoặc mật khẩu không đúng' },
          { status: 401 }
        );
      }

      const roleValue = getCol(user, 'Role', 'Vai trò');
      const memberLevel = getCol(user, 'Level', 'Hạng thành viên', 'MemberLevel');

      return NextResponse.json({
        success: true,
        user: {
          name: getCol(user, 'Tên', 'Họ và tên', 'Họ tên', 'Name'),
          email: getCol(user, 'Email'),
          phone: getCol(user, 'Phone', 'Số điện thoại', 'SĐT'),
          role: isAdminRole(roleValue) ? 'admin' : 'user',
          memberLevel: (['Free', 'Premium', 'VIP'].includes(memberLevel) ? memberLevel : 'Free'),
        },
      });
    } catch (csvError) {
      console.error('[Login] CSV failed:', csvError instanceof Error ? csvError.message : csvError);
      return NextResponse.json(
        { success: false, error: 'Không thể kết nối đến hệ thống. Vui lòng thử lại sau.', useClientFallback: true },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
