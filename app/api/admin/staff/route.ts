import { NextRequest } from 'next/server';
import { requirePermission, requireAuth, AuthError } from '@/lib/auth/guards';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

/** GET - List all staff members */
export async function GET() {
  try {
    await requirePermission('admin.staff.manage');
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? ERR.UNAUTHORIZED() : ERR.FORBIDDEN('Chỉ admin mới có quyền quản lý nhân sự');
    }
    return ERR.UNAUTHORIZED();
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

    return apiSuccess({ staff });
  } catch (err) {
    logger.error('admin.staff.get', 'Failed to list staff', { error: err instanceof Error ? err.message : String(err) });
    return ERR.INTERNAL('Không thể tải danh sách nhân sự');
  }
}

/** POST - Update user role */
export async function POST(request: NextRequest) {
  let adminUser;
  try {
    adminUser = await requirePermission('admin.staff.manage');
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? ERR.UNAUTHORIZED() : ERR.FORBIDDEN('Chỉ admin mới có quyền quản lý nhân sự');
    }
    return ERR.UNAUTHORIZED();
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const newRole = typeof body.role === 'string' ? body.role.trim() : '';

    if (!email) {
      return ERR.VALIDATION('Thiếu email');
    }

    const validRoles = ['user', 'sub_admin', 'instructor'];
    if (!validRoles.includes(newRole)) {
      return ERR.VALIDATION(`Role không hợp lệ. Chỉ chấp nhận: ${validRoles.join(', ')}`);
    }

    // Cannot change own role
    if (adminUser.email.toLowerCase() === email) {
      return ERR.VALIDATION('Không thể thay đổi quyền của chính mình');
    }

    const { getUserByEmail, updateUserProfile } = await import('@/lib/supabase/users');
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      return ERR.NOT_FOUND('Không tìm thấy người dùng');
    }

    if (targetUser.role === 'admin') {
      return ERR.FORBIDDEN('Không thể thay đổi quyền của admin chính');
    }

    await updateUserProfile(email, { role: newRole as 'user' | 'sub_admin' | 'instructor' });

    logger.info('admin.staff.update', 'Role updated', {
      actor: adminUser.email,
      target: email,
      oldRole: targetUser.role,
      newRole,
    });

    return apiSuccess({
      message: `Đã cập nhật quyền của ${targetUser.name} thành ${newRole}`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 401 ? ERR.UNAUTHORIZED() : ERR.FORBIDDEN();
    }
    logger.error('admin.staff.update', 'Failed to update role', { error: err instanceof Error ? err.message : String(err) });
    return ERR.INTERNAL();
  }
}
