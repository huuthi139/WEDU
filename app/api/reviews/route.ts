import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getReviews&courseId=${encodeURIComponent(courseId)}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, reviews: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, rating, content } = await req.json();

  try {
    const params = new URLSearchParams({
      action: 'saveReview',
      userId: session.email,
      userEmail: session.email,
      userName: session.name,
      courseId,
      rating: String(rating),
      content: content || '',
    });
    const res = await fetch(`${SCRIPT_URL}?${params}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save review' }, { status: 500 });
  }
}
