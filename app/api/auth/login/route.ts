import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { isAdminRole, isSubAdminRole, DEMO_USERS } from '@/lib/utils/auth';
import { verifyPassword } from '@/lib/auth/password';
import { getUserByEmail } from '@/lib/supabase/users';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email và mật khẩu không được để trống' },
        { status: 400 }
      );
    }

    // Primary: Supabase
    const userProfile = await getUserByEmail(email);

    if (userProfile) {
      // Verify password
      if (userProfile.password_hash) {
        const isValid = await verifyPassword(password, userProfile.password_hash);
        if (!isValid) {
          return NextResponse.json(
            { success: false, error: 'Email hoặc mật khẩu không đúng' },
            { status: 401 }
          );
        }
      }

      const role = isAdminRole(userProfile.role) ? 'admin'
        : isSubAdminRole(userProfile.role) ? 'sub_admin'
        : userProfile.role === 'instructor' ? 'instructor'
        : userProfile.role || 'user';
      const memberLevel = userProfile.member_level || 'Free';

      await createSession({ email: userProfile.email, role, name: userProfile.name, level: memberLevel });

      return NextResponse.json({
        success: true,
        user: {
          name: userProfile.name,
          email: userProfile.email,
          phone: userProfile.phone || '',
          role,
          memberLevel,
        },
      });
    }

    // Fallback: Demo users (for development/testing only)
    const demoUser = DEMO_USERS.find(
      u => u.email.toLowerCase() === email
    );
    if (demoUser && demoUser.plainPassword === password) {
      try {
        await createSession({ email: demoUser.email, role: demoUser.role, name: demoUser.name, level: demoUser.memberLevel });
      } catch (sessionErr) {
        console.error('[Login] Demo session creation failed:', sessionErr instanceof Error ? sessionErr.message : sessionErr);
      }

      return NextResponse.json({
        success: true,
        user: {
          name: demoUser.name,
          email: demoUser.email,
          phone: demoUser.phone,
          role: demoUser.role,
          memberLevel: demoUser.memberLevel,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Email hoặc mật khẩu không đúng' },
      { status: 401 }
    );
  } catch (error) {
    console.error('[Login] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
