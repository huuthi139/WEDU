import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, lessonId, progress } = await req.json();

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
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update progress' }, { status: 500 });
  }
}
