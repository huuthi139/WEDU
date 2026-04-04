import { NextRequest, NextResponse } from 'next/server';
import { hasAdminAccess } from '@/lib/utils/auth';
import { emailExists, createUserProfile } from '@/lib/supabase/users';
import { hashPassword } from '@/lib/auth/password';
import { writeAuditLog } from '@/lib/telemetry/audit';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    const token = request.cookies.get('wedu-token')?.value;
    if (!token) return { isAdmin: false };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return { isAdmin: false };
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = (payload as { role?: string }).role || '';
    const userId = (payload as { userId?: string }).userId;
    return { isAdmin: hasAdminAccess(role), userId };
  } catch {
    return { isAdmin: false };
  }
}

/**
 * POST /api/admin/users
 * Create a new student account (admin only)
 */
export async function POST(request: NextRequest) {
  const { isAdmin, userId: adminId } = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 15) : '';
    const memberLevel = ['Free', 'Premium', 'VIP'].includes(body.memberLevel) ? body.memberLevel : 'Free';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    // Validate
    if (!name || name.length < 2) {
      return NextResponse.json({ success: false, error: 'Ten phai co it nhat 2 ky tu' }, { status: 400 });
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Email khong hop le' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Mat khau phai co it nhat 6 ky tu' }, { status: 400 });
    }

    // Check duplicate email
    if (await emailExists(email)) {
      return NextResponse.json({ success: false, error: 'Email da duoc su dung' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await createUserProfile({
      email,
      name,
      phone,
      passwordHash,
      role: 'user',
      memberLevel,
    });

    // Audit log
    writeAuditLog({
      actorUserId: adminId || 'unknown',
      actionType: 'admin.create_user',
      targetTable: 'users',
      targetId: user.id,
      newValue: { email, name, memberLevel },
      status: 'success',
    });

    return NextResponse.json({ success: true, user: { id: user.id, email, name } });
  } catch (err) {
    console.error('[POST /api/admin/users] Error:', err);
    return NextResponse.json({ success: false, error: 'Khong the tao tai khoan' }, { status: 500 });
  }
}
