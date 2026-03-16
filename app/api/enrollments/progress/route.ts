import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { updateProgress } from '@/lib/supabase/enrollments';
import { sendCourseCompletionEmail } from '@/lib/email/send';
import { syncProgressToSheet } from '@/lib/sync/sheetSync';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, lessonId, progress, courseName } = await req.json();

  const ok = await updateProgress(session.email, courseId, lessonId || '', progress ?? 0);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to update progress' }, { status: 500 });
  }

  // Send congratulation email when course is 100% completed
  if (progress >= 100 && courseName) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wedu.vn';
    const certificateLink = `${baseUrl}/certificates?courseId=${courseId}`;
    sendCourseCompletionEmail(
      session.email,
      session.name || 'bạn',
      courseName,
      certificateLink
    ).catch(() => {});
  }

  // Background sync to Google Sheet
  syncProgressToSheet(session.email, courseId, lessonId || '', progress ?? 0);

  return NextResponse.json({ success: true });
}
