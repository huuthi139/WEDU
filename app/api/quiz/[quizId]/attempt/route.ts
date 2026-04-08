import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAuth } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { createNotification } from '@/lib/supabase/notifications';
import type { QuizQuestionOption } from '@/lib/types';

/**
 * POST /api/quiz/[quizId]/attempt
 * Submit quiz answers, auto-grade, return results
 */
export async function POST(request: NextRequest, { params }: { params: { quizId: string } }) {
  const { authenticated, userId } = await verifyAuth(request);
  if (!authenticated || !userId) return ERR.UNAUTHORIZED();

  const supabase = getSupabaseAdmin();
  const { quizId } = params;

  // Get quiz
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();

  if (!quiz) return ERR.NOT_FOUND('Quiz không tồn tại');

  // Check attempt limit
  const { count: attemptCount } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)
    .eq('user_id', userId);

  if ((attemptCount || 0) >= quiz.max_attempts) {
    return ERR.VALIDATION('Bạn đã hết số lần làm bài cho phép');
  }

  // Get questions with correct answers
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: true });

  if (!questions || questions.length === 0) {
    return ERR.VALIDATION('Quiz chưa có câu hỏi');
  }

  // Parse submitted answers
  const body = await request.json();
  const userAnswers: Record<string, string[] | string> = body.answers || {};

  // Grade the quiz
  let score = 0;
  let maxScore = 0;
  const results: Array<{
    questionId: string;
    correct: boolean;
    correctAnswers: string[];
    userAnswer: string[] | string;
    explanation: string;
    points: number;
  }> = [];

  for (const q of questions) {
    const points = q.points || 1;
    maxScore += points;
    const options: QuizQuestionOption[] = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
    const userAnswer = userAnswers[q.id];

    if (q.type === 'text') {
      // Text questions are always marked for manual review (score 0 auto)
      results.push({
        questionId: q.id,
        correct: false,
        correctAnswers: [],
        userAnswer: userAnswer || '',
        explanation: q.explanation || '',
        points: 0,
      });
      continue;
    }

    const correctIds = options.filter(o => o.isCorrect).map(o => o.id);
    const answered = Array.isArray(userAnswer) ? userAnswer : (userAnswer ? [userAnswer] : []);

    let isCorrect = false;
    if (q.type === 'single') {
      isCorrect = answered.length === 1 && correctIds.includes(answered[0]);
    } else if (q.type === 'multiple') {
      isCorrect = answered.length === correctIds.length &&
        answered.every(a => correctIds.includes(a)) &&
        correctIds.every(c => answered.includes(c));
    }

    if (isCorrect) score += points;

    results.push({
      questionId: q.id,
      correct: isCorrect,
      correctAnswers: correctIds,
      userAnswer: answered,
      explanation: q.explanation || '',
      points: isCorrect ? points : 0,
    });
  }

  const percentScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percentScore >= quiz.pass_score;

  // Save attempt
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: quizId,
      user_id: userId,
      answers: userAnswers,
      score: percentScore,
      max_score: maxScore,
      passed,
      completed_at: new Date().toISOString(),
      attempt_number: (attemptCount || 0) + 1,
    })
    .select()
    .single();

  // Send notification
  try {
    await createNotification({
      userId,
      type: passed ? 'quiz_passed' : 'quiz_failed',
      title: passed ? 'Chúc mừng! Bạn đã vượt qua bài kiểm tra' : 'Bài kiểm tra chưa đạt',
      message: passed
        ? `Bạn đạt ${percentScore}% trong "${quiz.title}". Tiếp tục phát huy!`
        : `B���n đạt ${percentScore}% trong "${quiz.title}" (cần ${quiz.pass_score}%). Hãy thử lại!`,
      link: quiz.lesson_id ? `/learn/${quiz.course_id}` : '',
      metadata: { quizId, score: percentScore, passed },
    });
  } catch {
    // Don't fail the request if notification fails
  }

  return apiSuccess({
    attemptId: attempt?.id,
    score: percentScore,
    maxScore,
    passed,
    passScore: quiz.pass_score,
    results,
    attemptNumber: (attemptCount || 0) + 1,
    remainingAttempts: quiz.max_attempts - ((attemptCount || 0) + 1),
  });
}
