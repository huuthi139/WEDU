import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAuth } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { quizRowToFrontend, quizQuestionRowToFrontend } from '@/lib/types';

/**
 * GET /api/quiz/[quizId]
 * Get quiz + questions (hide isCorrect for students)
 */
export async function GET(request: NextRequest, { params }: { params: { quizId: string } }) {
  const { authenticated, userId, role } = await verifyAuth(request);
  if (!authenticated || !userId) return ERR.UNAUTHORIZED();

  const supabase = getSupabaseAdmin();
  const { quizId } = params;

  // Get quiz
  const { data: quizRow, error: quizErr } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();

  if (quizErr || !quizRow) return ERR.NOT_FOUND('Quiz không tồn tại');

  // Get questions ordered by sort_order
  const { data: questionRows } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: true });

  const quiz = quizRowToFrontend(quizRow);
  const isAdmin = role === 'admin' || role === 'sub_admin';

  // Strip isCorrect from options for non-admin users
  const questions = (questionRows || []).map(row => {
    const q = quizQuestionRowToFrontend(row);
    if (!isAdmin) {
      return {
        ...q,
        options: q.options.map(({ id, text }) => ({ id, text, isCorrect: false })),
        explanation: '',
      };
    }
    return q;
  });

  // Get user's attempt count
  const { count } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .eq('user_id', userId);

  return apiSuccess({
    quiz,
    questions,
    attemptCount: count || 0,
    canAttempt: (count || 0) < quiz.maxAttempts,
  });
}
