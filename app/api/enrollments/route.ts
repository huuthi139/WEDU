import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(
      `${SCRIPT_URL}?action=getEnrollments&userId=${encodeURIComponent(session.email)}`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, enrollments: [], error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId } = await req.json();
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  try {
    const res = await fetch(
      `${SCRIPT_URL}?action=enrollCourse&userId=${encodeURIComponent(session.email)}&courseId=${encodeURIComponent(courseId)}`
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to enroll' }, { status: 500 });
  }
}
