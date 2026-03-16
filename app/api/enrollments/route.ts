import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getEnrollmentsByUser, enrollUser } from '@/lib/supabase/enrollments';
import { syncEnrollmentToSheet } from '@/lib/sync/sheetSync';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enrollments = await getEnrollmentsByUser(session.email);

  return NextResponse.json({
    success: true,
    enrollments: enrollments.map(e => ({
      courseId: e.course_id,
      enrolledAt: e.enrolled_at,
      progress: e.progress,
      completedLessons: e.completed_lessons || [],
      lastAccessedAt: e.last_accessed_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId } = await req.json();
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const enrollment = await enrollUser(session.email, courseId);
  if (!enrollment) {
    return NextResponse.json({ success: false, error: 'Failed to enroll' }, { status: 500 });
  }

  // Background sync to Google Sheet
  syncEnrollmentToSheet(session.email, courseId);

  return NextResponse.json({ success: true });
}
