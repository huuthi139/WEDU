import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth/guards';
import { logger } from '@/lib/telemetry/logger';

function authErrorResponse(error: unknown, fallbackMsg = 'Unauthorized') {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { success: false, error: fallbackMsg },
    { status: 401 },
  );
}

/** GET - List all staff members */
export async function GET() {
  try {
    await requirePermission('admin.staff.manage');
  } catch (error) {
    return authErrorResponse(error, 'Chỉ admin mới có quyền quản lý nhân sự');
  }

  try {
    const { getAllUsers } = await import('@/lib/supabase/users');
    const allUsers = await getAllUsers();

    const staff = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      memberLevel: u.member_level,
      createdAt: u.created_at,
    }));

    return NextResponse.json({ success: true, data: { staff } });
  } catch (err) {
    logger.error('admin.staff.get', 'Failed to list staff', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Không thể tải danh sách nhân sự' }, { status: 500 });
  }
}

/** POST - Update user role */
export async function POST(request: NextRequest) {
  let adminUser;
  try {
    adminUser = await requirePermission('admin.staff.manage');
  } catch (error) {
    return authErrorResponse(error, 'Chỉ admin mới có quyền quản lý nhân sự');
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const newRole = typeof body.role === 'string' ? body.role.trim() : '';

    if (!email) {
      return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 422 });
    }

    const validRoles = ['user', 'sub_admin', 'instructor'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ success: false, error: `Role không hợp lệ. Chỉ chấp nhận: ${validRoles.join(', ')}` }, { status: 422 });
    }

    // Cannot change own role
    if (adminUser.email.toLowerCase() === email) {
      return NextResponse.json({ success: false, error: 'Không thể thay đổi quyền của chính mình' }, { status: 422 });
    }

    const { getUserByEmail, updateUserProfile } = await import('@/lib/supabase/users');
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy người dùng' }, { status: 404 });
    }

    if (targetUser.role === 'admin') {
      return NextResponse.json({ success: false, error: 'Không thể thay đổi quyền của admin chính' }, { status: 403 });
    }

    await updateUserProfile(email, { role: newRole as 'user' | 'sub_admin' | 'instructor' });

    logger.info('admin.staff.update', 'Role updated', {
      actor: adminUser.email,
      target: email,
      oldRole: targetUser.role,
      newRole,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật quyền của ${targetUser.name} thành ${newRole}`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    logger.error('admin.staff.update', 'Failed to update role', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

/** PUT - Add new staff member by email with role */
export async function PUT(request: NextRequest) {
  try {
    await requirePermission('admin.staff.manage');
  } catch (error) {
    return authErrorResponse(error, 'Chỉ admin mới có quyền quản lý nhân sự');
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';

    if (!email) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập email' }, { status: 422 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Email không hợp lệ' }, { status: 422 });
    }

    const validRoles = ['user', 'sub_admin', 'instructor'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ success: false, error: `Quyền không hợp lệ. Chỉ chấp nhận: ${validRoles.join(', ')}` }, { status: 422 });
    }

    const { getUserByEmail, updateUserProfile, createUserProfile } = await import('@/lib/supabase/users');
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      if (existingUser.role === 'admin') {
        return NextResponse.json({ success: false, error: 'Không thể thay đổi quyền của admin chính' }, { status: 403 });
      }

      // Update role of existing user
      await updateUserProfile(email, { role: role as 'user' | 'sub_admin' | 'instructor' });

      logger.info('admin.staff.add', 'Existing user role updated', { target: email, role });

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật quyền của ${existingUser.name || email} thành ${role === 'sub_admin' ? 'Admin phụ' : role === 'instructor' ? 'Giảng viên' : 'Học viên'}`,
        isNew: false,
      });
    } else {
      // Create new user with this email and role
      const name = body.name || email.split('@')[0];
      await createUserProfile({
        email,
        name,
        passwordHash: '',
        role,
        memberLevel: 'Free',
      });

      logger.info('admin.staff.add', 'New staff member created', { target: email, role });

      return NextResponse.json({
        success: true,
        message: `Đã thêm nhân sự mới ${name} (${email}) với quyền ${role === 'sub_admin' ? 'Admin phụ' : role === 'instructor' ? 'Giảng viên' : 'Học viên'}`,
        isNew: true,
      }, { status: 201 });
    }
  } catch (err) {
    logger.error('admin.staff.add', 'Failed to add staff', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Không thể thêm nhân sự' }, { status: 500 });
  }
}
