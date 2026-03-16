import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getReviewsByCourse, saveReview } from '@/lib/supabase/reviews';
import { syncReviewToSheet } from '@/lib/sync/sheetSync';

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  const reviews = await getReviewsByCourse(courseId);

  return NextResponse.json({
    success: true,
    reviews: reviews.map(r => ({
      userId: r.user_email,
      userEmail: r.user_email,
      userName: r.user_name,
      courseId: r.course_id,
      rating: r.rating,
      content: r.content,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, rating, content } = await req.json();

  const review = await saveReview({
    courseId,
    userEmail: session.email,
    userName: session.name,
    rating: Number(rating) || 5,
    content: content || '',
  });

  if (!review) {
    return NextResponse.json({ success: false, error: 'Failed to save review' }, { status: 500 });
  }

  // Background sync to Google Sheet
  syncReviewToSheet({
    userEmail: session.email,
    userName: session.name,
    courseId,
    rating: Number(rating) || 5,
    content: content || '',
  });

  return NextResponse.json({ success: true });
}
