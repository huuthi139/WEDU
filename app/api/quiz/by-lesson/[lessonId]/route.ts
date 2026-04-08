import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAuth } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';

/**
 * GET /api/quiz/by-lesson/[lessonId]
 * Check if a lesson has a quiz, return quiz metadata (no questions)
 */
export async function GET(request: NextRequest, { params }: { params: { lessonId: string } }) {
  const { authenticated, userId } = await verifyAuth(request);
  if (!authenticated || !userId) return ERR.UNAUTHORIZED();

  const supabase = getSupabaseAdmin();

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, title, description, time_limit_minutes, pass_score, max_attempts, is_required')
    .eq('lesson_id', params.lessonId)
    .single();

  if (!quiz) return apiSuccess({ hasQuiz: false, quiz: null });

  // Get user's best attempt
  const { data: bestAttempt } = await supabase
    .from('quiz_attempts')
    .select('score, passed, attempt_number')
    .eq('quiz_id', quiz.id)
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(1)
    .single();

  const { count: attemptCount } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quiz.id)
    .eq('user_id', userId);

  return apiSuccess({
    hasQuiz: true,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimitMinutes: quiz.time_limit_minutes,
      passScore: quiz.pass_score,
      maxAttempts: quiz.max_attempts,
      isRequired: quiz.is_required,
    },
    bestScore: bestAttempt?.score || null,
    passed: bestAttempt?.passed || false,
    attemptCount: attemptCount || 0,
    canAttempt: (attemptCount || 0) < quiz.max_attempts,
  });
}
