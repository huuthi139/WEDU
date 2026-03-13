import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

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

    // Try Firebase Auth registration
    let firebaseUser;
    try {
      const { getAdminAuth } = await import('@/lib/firebase/admin');
      const auth = getAdminAuth();

      firebaseUser = await auth.createUser({
        email,
        password,
        displayName: name,
      });
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === 'auth/email-already-exists') {
        return NextResponse.json(
          { success: false, error: 'Email đã được sử dụng. Vui lòng dùng email khác.' },
          { status: 409 }
        );
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      // Check if it's a network/connection error or missing config
      if (errMsg.includes('EAI_AGAIN') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT') || errMsg.includes('fetch') || errMsg.includes('Missing required env vars')) {
        console.warn('[Register] Firebase unreachable, cannot register:', errMsg);
        return NextResponse.json(
          { success: false, error: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.' },
          { status: 503 }
        );
      }

      console.error('[Register] Firebase Auth error:', errMsg);
      return NextResponse.json(
        { success: false, error: 'Không thể tạo tài khoản. Vui lòng thử lại.' },
        { status: 500 }
      );
    }

    // Hash password for server-side verification in login
    const hashedPassword = await hashPassword(password);

    // Create user profile in Firestore
    try {
      const { createUserProfile } = await import('@/lib/firebase/users');
      const { getAdminDb } = await import('@/lib/firebase/admin');

      const userProfile = await createUserProfile(firebaseUser.uid, {
        email,
        name,
        phone,
        role: 'user',
        memberLevel: 'Free',
      });

      // Store password hash in Firestore for server-side login verification
      const db = getAdminDb();
      await db.collection('users').doc(firebaseUser.uid).update({
        passwordHash: hashedPassword,
      });

      // Create session
      await createSession({ email, role: 'user', name, level: 'Free' });

      return NextResponse.json({
        success: true,
        user: {
          name: userProfile.name,
          email: userProfile.email,
          phone: userProfile.phone,
          role: userProfile.role,
          memberLevel: userProfile.memberLevel,
        },
      });
    } catch (firestoreErr) {
      console.error('[Register] Firestore error:', firestoreErr instanceof Error ? firestoreErr.message : firestoreErr);

      // User was created in Firebase Auth but Firestore failed
      // Still create session so user can log in
      await createSession({ email, role: 'user', name, level: 'Free' });

      return NextResponse.json({
        success: true,
        user: {
          name,
          email,
          phone,
          role: 'user',
          memberLevel: 'Free',
        },
      });
    }
  } catch (error) {
    console.error('[Register] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
