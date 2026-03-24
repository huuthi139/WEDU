import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getAllUsers } from '@/lib/supabase/users';
import { NextResponse } from 'next/server';

async function handleFetchUsers() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const allUsers = await getAllUsers();

    const users = allUsers.map(u => ({
      Email: u.email || '',
      Role: u.role || 'user',
      'Tên': u.name || '',
      Level: u.member_level || 'Free',
      Phone: u.phone || '',
    }));

    return NextResponse.json({ success: true, users, source: 'supabase' });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Database unavailable',
      users: [],
    });
  }
}

export async function GET() {
  return handleFetchUsers();
}

export async function POST() {
  return handleFetchUsers();
}
