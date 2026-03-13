import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { getUserByUid } from '@/lib/firebase/users';
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
    try {
      const auth = getAdminAuth();

      // Get user by email from Firebase Auth
      const firebaseUser = await auth.getUserByEmail(email);

      // Verify password by generating a sign-in token
      // Firebase Admin SDK doesn't directly verify passwords,
      // so we use a custom token + client SDK approach.
      // Instead, we store a password hash in Firestore and verify locally.
      const userProfile = await getUserByUid(firebaseUser.uid);

      if (!userProfile) {
        return NextResponse.json(
          { success: false, error: 'Email hoặc mật khẩu không đúng' },
          { status: 401 }
        );
      }

      // For Firebase Auth, we rely on the fact that the user exists in Firebase Auth
      // Password verification happens client-side via Firebase Auth signInWithEmailAndPassword
      // Here on server, we create a session after client confirms auth
      // BUT for API-based login (current architecture), we verify via Firestore stored hash

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
        // This supports the existing email/password form submission
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

      // Set JWT session (keeping existing session mechanism)
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
      // Firebase Auth user not found - try demo fallback
      if (errorCode === 'auth/user-not-found') {
        console.log('[Login] User not found in Firebase Auth, trying demo fallback');
      } else {
        console.error('[Login] Firebase Auth error:', err instanceof Error ? err.message : err);
      }
    }

    // Method 2: Local demo fallback when Firebase is unreachable or user not found
    console.log('[Login] Trying local demo fallback');
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
