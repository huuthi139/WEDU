import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { sendCourseCompletionEmail } from '@/lib/email/send';

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, lessonId, progress, courseName } = await req.json();

  try {
    const params = new URLSearchParams({
      action: 'updateProgress',
      userId: session.email,
      courseId,
      lessonId: lessonId || '',
      progress: String(progress ?? 0),
    });
    const res = await fetch(`${SCRIPT_URL}?${params}`);
    const data = await res.json();

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

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update progress' }, { status: 500 });
  }
}
