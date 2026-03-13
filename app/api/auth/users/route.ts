import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function GET(_request: NextRequest) {
  // Note: Admin check is handled by middleware (verifies JWT role=admin)
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('users').get();

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        Email: data.email || '',
        Role: data.role || 'user',
        'Tên': data.name || '',
        Level: data.memberLevel || 'Free',
        Phone: data.phone || '',
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
