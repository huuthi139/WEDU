import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getAllUsers } from '@/lib/supabase/users';
import { getSupabaseAdmin } from '@/lib/supabase/client';
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

    // Fetch all active course_access records with course titles
    const supabase = getSupabaseAdmin();
    const { data: courseAccessRows } = await supabase
      .from('course_access')
      .select('user_id, course_id, courses!inner(id, title)')
      .eq('status', 'active');

    // Group course access by user_id
    const coursesByUser: Record<string, { courseId: string; courseName: string }[]> = {};
    for (const row of courseAccessRows || []) {
      if (!coursesByUser[row.user_id]) coursesByUser[row.user_id] = [];
      coursesByUser[row.user_id].push({
        courseId: row.course_id,
        courseName: (row.courses as any)?.title || '',
      });
    }

    const users = allUsers.map(u => ({
      id: u.id || '',
      Email: u.email || '',
      Role: u.role || 'user',
      'Tên': u.name || '',
      Level: u.member_level || 'Free',
      Phone: u.phone || '',
      enrolledCourses: coursesByUser[u.id || ''] || [],
      joinDate: u.created_at || '',
      status: u.status || 'active',
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
