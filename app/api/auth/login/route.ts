import { NextResponse } from 'next/server';
import { getScriptUrl, getSheetCsvUrl } from '@/lib/config';

const SHEET_NAME = 'Users';
const FETCH_TIMEOUT_MS = 15_000; // 15 seconds (Google Apps Script can be slow on cold start)

// Demo credentials fallback when all Google services are unreachable
const DEMO_USERS = [
  {
    email: 'admin@wepower.vn',
    password: '123456',
    name: 'Admin WePower',
    role: 'admin',
    memberLevel: 'VIP',
    phone: '',
  },
];

function authenticateLocal(email: string, password: string) {
  const user = DEMO_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    memberLevel: user.memberLevel,
  };
}

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
    try {
      const gsScriptUrl = getScriptUrl();
      const params = new URLSearchParams({ action: 'login', email, password });
      const scriptUrl = `${gsScriptUrl}?${params.toString()}`;
      const res = await fetchWithTimeout(scriptUrl, {
        redirect: 'follow',
        cache: 'no-store',
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[Login] Apps Script returned non-JSON:', text.slice(0, 200));
        throw new Error('Invalid response from Apps Script');
      }

      if (data.success) {
        const user = data.user;
        if (user && user.role) {
          user.role = isAdminRole(user.role) ? 'admin' : 'user';
        }
        return NextResponse.json({ success: true, user });
      }

      // Only return 401 if Apps Script explicitly says credentials are wrong
      if (data.error) {
        return NextResponse.json(
          { success: false, error: data.error },
          { status: 401 }
        );
      }

      throw new Error('Apps Script returned unsuccessful without error');
    } catch (err) {
      console.error('[Login] Apps Script error:', err instanceof Error ? err.message : err);
    }

    // Method 2: Read CSV from Google Sheets
    try {
      const csvUrl = getSheetCsvUrl(SHEET_NAME);
      const csvRes = await fetchWithTimeout(csvUrl, { cache: 'no-store' });
      if (!csvRes.ok) {
        throw new Error(`CSV fetch failed with status ${csvRes.status}`);
      }
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
    }

    // Method 3: Local demo fallback when all Google services are unreachable
    console.log('[Login] All Google services failed, trying local demo fallback');
    const localUser = authenticateLocal(email, password);
    if (localUser) {
      return NextResponse.json({ success: true, user: localUser });
    }

    return NextResponse.json(
      { success: false, error: 'Email hoặc mật khẩu không đúng' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
