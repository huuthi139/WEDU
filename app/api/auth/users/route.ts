import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getAllUsers } from '@/lib/supabase/users';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

// Force Vercel to always run this route dynamically (no cache)
export const dynamic = 'force-dynamic';

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
    const { users: allUsers } = await getAllUsers({ limit: 500 });

    // Fetch all active course_access records and course titles separately
    // to avoid issues with the !inner join producing incorrect groupings
    const supabase = getSupabaseAdmin();
    const [accessRes, coursesRes] = await Promise.all([
      supabase
        .from('course_access')
        .select('user_id, course_id')
        .eq('status', 'active'),
      supabase
        .from('courses')
        .select('id, title'),
    ]);

    // Build course title lookup
    const courseTitles: Record<string, string> = {};
    for (const c of coursesRes.data || []) {
      courseTitles[c.id] = c.title || '';
    }

    // Group course access by user_id
    const coursesByUser: Record<string, { courseId: string; courseName: string }[]> = {};
    for (const row of accessRes.data || []) {
      const uid = row.user_id;
      if (!uid) continue;
      if (!coursesByUser[uid]) coursesByUser[uid] = [];
      coursesByUser[uid].push({
        courseId: row.course_id,
        courseName: courseTitles[row.course_id] || '',
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
