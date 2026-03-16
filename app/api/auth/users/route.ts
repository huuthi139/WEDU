import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { getAllUsers } from '@/lib/supabase/users';

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

  const allUsers = await getAllUsers();

  const users = allUsers.map(u => ({
    Email: u.email || '',
    Role: u.role || 'user',
    'Tên': u.name || '',
    Level: u.member_level || 'Free',
    Phone: u.phone || '',
  }));

  return NextResponse.json({ success: true, users, source: 'supabase' });
}

export async function GET(request: NextRequest) {
  return handleFetchUsers(request);
}

export async function POST(request: NextRequest) {
  return handleFetchUsers(request);
}
