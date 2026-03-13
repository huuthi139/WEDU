/**
 * Firestore user data operations
 * Handles user profile data in Firestore (separate from Firebase Auth)
 */
import { getAdminDb } from './admin';

const USERS_COLLECTION = 'users';

export interface FirestoreUser {
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'user';
  memberLevel: 'Free' | 'Premium' | 'VIP';
  createdAt: string;
  updatedAt: string;
}

/**
 * Get user profile from Firestore by email
 */
export async function getUserByEmail(email: string): Promise<FirestoreUser | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as FirestoreUser;
}

/**
 * Get user profile from Firestore by Firebase Auth UID
 */
export async function getUserByUid(uid: string): Promise<FirestoreUser | null> {
  const db = getAdminDb();
  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as FirestoreUser;
}

/**
 * Create user profile in Firestore (called after Firebase Auth signup)
 */
export async function createUserProfile(
  uid: string,
  data: { email: string; name: string; phone?: string; role?: string; memberLevel?: string }
): Promise<FirestoreUser> {
  const db = getAdminDb();
  const now = new Date().toISOString();

  const userData: FirestoreUser = {
    email: data.email.toLowerCase(),
    name: data.name,
    phone: data.phone || '',
    role: data.role === 'admin' ? 'admin' : 'user',
    memberLevel: (['Free', 'Premium', 'VIP'].includes(data.memberLevel || '') ? data.memberLevel : 'Free') as FirestoreUser['memberLevel'],
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(USERS_COLLECTION).doc(uid).set(userData);
  return userData;
}

/**
 * Update user profile in Firestore
 */
export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<FirestoreUser, 'name' | 'phone' | 'role' | 'memberLevel'>>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(USERS_COLLECTION).doc(uid).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}
