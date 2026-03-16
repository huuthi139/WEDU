import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/utils/auth';

/** Verify full admin access (not sub_admin) via JWT session cookie */
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
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

function forbidden() {
  return NextResponse.json(
    { success: false, error: 'Chỉ admin mới có quyền quản lý nhân sự' },
    { status: 403 }
  );
}

/** GET - List all staff members (users with role != 'user') */
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !isAdminRole(clientRole)) return forbidden();
  }

  try {
    const { getAllUsers } = await import('@/lib/supabase/users');
    const allUsers = await getAllUsers();

    // Return all users with their roles - admin can see who is staff
    const staff = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      memberLevel: u.member_level,
      createdAt: u.created_at,
    }));

    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error('[Staff API] GET error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách nhân sự' }, { status: 500 });
  }
}

/** POST - Update user role (promote/demote staff) */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    const clientRole = request.headers.get('x-user-role');
    if (!clientRole || !isAdminRole(clientRole)) return forbidden();
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const newRole = typeof body.role === 'string' ? body.role.trim() : '';

    if (!email) {
      return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 400 });
    }

    // Validate allowed roles
    const validRoles = ['user', 'sub_admin', 'instructor'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { success: false, error: `Role không hợp lệ. Chỉ chấp nhận: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Cannot change own role
    try {
      const token = request.cookies.get('wedu-token')?.value;
      if (token) {
        const { jwtVerify } = await import('jose');
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
          if ((payload as { email?: string }).email?.toLowerCase() === email) {
            return NextResponse.json(
              { success: false, error: 'Không thể thay đổi quyền của chính mình' },
              { status: 400 }
            );
          }
        }
      }
    } catch { /* continue */ }

    // Cannot change role of main admin
    const { getUserByEmail, updateUserProfile } = await import('@/lib/supabase/users');
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy người dùng' }, { status: 404 });
    }

    if (targetUser.role === 'admin') {
      return NextResponse.json(
        { success: false, error: 'Không thể thay đổi quyền của admin chính' },
        { status: 400 }
      );
    }

    await updateUserProfile(email, { role: newRole as any });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật quyền của ${targetUser.name} thành ${newRole}`,
    });
  } catch (err) {
    console.error('[Staff API] POST error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
