import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAuth } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  const { authenticated, userId } = await verifyAuth(request);
  if (!authenticated || !userId) return ERR.UNAUTHORIZED();

  const supabase = getSupabaseAdmin();
  const { quizId, answers, timeSpentSeconds } = await request.json();
  if (!quizId || !answers) return ERR.VALIDATION('quizId và answers required');

  // Check attempt count
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
  if (!quiz) return ERR.NOT_FOUND('Quiz không tồn tại');

  const { count } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .eq('user_id', userId);

  if ((count || 0) >= quiz.max_attempts) return ERR.FORBIDDEN('Đã hết lượt làm bài');

  // Score the quiz
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId);

  let earned = 0;
  let total = 0;
  for (const q of questions || []) {
    total += q.points || 1;
    const userAnswer = answers[q.id];
    const correctIds = (q.options || [])
      .filter((o: { isCorrect: boolean }) => o.isCorrect)
      .map((o: { id: string }) => o.id);
    const correct = Array.isArray(userAnswer)
      ? correctIds.length === userAnswer.length && correctIds.every((id: string) => userAnswer.includes(id))
      : correctIds.includes(userAnswer);
    if (correct) earned += q.points || 1;
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const passed = score >= (quiz.pass_score || 70);

  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .insert({ quiz_id: quizId, user_id: userId, answers, score, passed, time_spent_seconds: timeSpentSeconds || 0 })
    .select()
    .single();

  return apiSuccess({ score, passed, attempt });
}
