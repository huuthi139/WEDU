import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { isAdminRole, DEMO_USERS } from '@/lib/utils/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

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

    // Method 1: Firebase Auth - verify credentials via Admin SDK
    let firebaseAvailable = false;
    try {
      const { getAdminAuth } = await import('@/lib/firebase/admin');
      const auth = getAdminAuth();

      // Get user by email from Firebase Auth
      const firebaseUser = await auth.getUserByEmail(email);
      firebaseAvailable = true;

      const { getUserByUid } = await import('@/lib/firebase/users');
      const userProfile = await getUserByUid(firebaseUser.uid);

      if (!userProfile) {
        return NextResponse.json(
          { success: false, error: 'Email hoặc mật khẩu không đúng' },
          { status: 401 }
        );
      }

      // Check if this is a Firebase-verified request (has idToken from client)
      if (body.idToken) {
        // Verify the Firebase ID token
        const decodedToken = await auth.verifyIdToken(body.idToken);
        if (decodedToken.email?.toLowerCase() !== email.toLowerCase()) {
          return NextResponse.json(
            { success: false, error: 'Token không hợp lệ' },
            { status: 401 }
          );
        }
      } else {
        // Legacy flow: verify password hash stored in Firestore
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
        const userData = userDoc.data();

        if (userData?.passwordHash) {
          const isValid = await verifyPassword(password, userData.passwordHash);
          if (!isValid) {
            return NextResponse.json(
              { success: false, error: 'Email hoặc mật khẩu không đúng' },
              { status: 401 }
            );
          }
        }
        // If no passwordHash in Firestore, the user was created via Firebase Auth
        // and should use idToken flow
      }

      const role = isAdminRole(userProfile.role) ? 'admin' : 'user';
      const memberLevel = userProfile.memberLevel || 'Free';

      // Set JWT session
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
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === 'auth/user-not-found') {
        console.log('[Login] User not found in Firebase Auth, trying demo fallback');
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Check if it's a network/connection error
        if (errMsg.includes('EAI_AGAIN') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT') || errMsg.includes('fetch')) {
          console.warn('[Login] Firebase unreachable (network error), using demo fallback');
        } else if (errMsg.includes('Missing required env vars')) {
          console.warn('[Login] Firebase not configured, using demo fallback');
        } else {
          console.error('[Login] Firebase Auth error:', errMsg);
        }
      }
    }

    // Method 2: Local demo fallback when Firebase is unreachable or user not found
    try {
      const demoUser = DEMO_USERS.find(
        u => u.email.toLowerCase() === email.toLowerCase()
      );
      if (demoUser) {
        const demoHash = await hashPassword(demoUser.plainPassword);
        const isValid = await verifyPassword(password, demoHash);
        if (isValid) {
          await createSession({ email: demoUser.email, role: demoUser.role, name: demoUser.name, level: demoUser.memberLevel });
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
      }
    } catch (demoErr) {
      console.error('[Login] Demo fallback error:', demoErr instanceof Error ? demoErr.message : demoErr);
    }

    // If Firebase was not available and user is not a demo user, give a helpful message
    if (!firebaseAvailable) {
      // Check if this email looks like it could be a registered user (not demo)
      const isDemoEmail = DEMO_USERS.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (!isDemoEmail) {
        return NextResponse.json(
          { success: false, error: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Email hoặc mật khẩu không đúng' },
      { status: 401 }
    );
  } catch (error) {
    console.error('[Login] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
