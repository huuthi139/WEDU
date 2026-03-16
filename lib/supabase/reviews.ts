/**
 * Supabase review data operations
 * Handles course reviews in Supabase (reviews table)
 */
import { getSupabaseAdmin } from './client';

export interface SupabaseReview {
  id?: string;
  course_id: string;
  user_email: string;
  user_name: string;
  rating: number;
  content: string;
  created_at: string;
}

/**
 * Get reviews for a course
 */
export async function getReviewsByCourse(courseId: string): Promise<SupabaseReview[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase Reviews] Failed to fetch:', error.message);
    return [];
  }
  return (data || []) as SupabaseReview[];
}

/**
 * Save a review (upsert - one review per user per course)
 */
export async function saveReview(review: {
  courseId: string;
  userEmail: string;
  userName: string;
  rating: number;
  content: string;
}): Promise<SupabaseReview | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Check if user already reviewed this course
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('course_id', review.courseId)
    .eq('user_email', review.userEmail.toLowerCase())
    .limit(1)
    .single();

  if (existing) {
    // Update existing review
    const { data, error } = await supabase
      .from('reviews')
      .update({
        rating: review.rating,
        content: review.content,
        user_name: review.userName,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('[Supabase Reviews] Update failed:', error.message);
      return null;
    }
    return data as SupabaseReview;
  }

  // Insert new review
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      course_id: review.courseId,
      user_email: review.userEmail.toLowerCase(),
      user_name: review.userName,
      rating: review.rating,
      content: review.content,
      created_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase Reviews] Insert failed:', error.message);
    return null;
  }
  return data as SupabaseReview;
}
