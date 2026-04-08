import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { quizRowToFrontend, quizQuestionRowToFrontend } from '@/lib/types';

/**
 * GET /api/admin/quiz?lessonId=xxx or ?courseId=xxx
 * List quizzes for a lesson or course
 */
export async function GET(request: NextRequest) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) return ERR.FORBIDDEN();

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lessonId');
  const courseId = searchParams.get('courseId');

  let query = supabase.from('quizzes').select('*').order('created_at', { ascending: false });
  if (lessonId) query = query.eq('lesson_id', lessonId);
  if (courseId) query = query.eq('course_id', courseId);

  const { data: quizzes } = await query;

  // For each quiz, get questions
  const result = [];
  for (const quiz of quizzes || []) {
    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('sort_order', { ascending: true });

    result.push({
      ...quizRowToFrontend(quiz),
      questions: (questions || []).map(quizQuestionRowToFrontend),
    });
  }

  return apiSuccess(result);
}

/**
 * POST /api/admin/quiz
 * Create a new quiz
 */
export async function POST(request: NextRequest) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) return ERR.FORBIDDEN();

  const supabase = getSupabaseAdmin();
  const body = await request.json();

  const { lessonId, courseId, title, description, timeLimitMinutes, passScore, maxAttempts, isRequired, questions } = body;

  if (!title) return ERR.VALIDATION('Tiêu đề quiz không được để trống');

  // Create quiz
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      lesson_id: lessonId || null,
      course_id: courseId || null,
      title,
      description: description || '',
      time_limit_minutes: timeLimitMinutes || 0,
      pass_score: passScore || 70,
      max_attempts: maxAttempts || 3,
      is_required: isRequired || false,
    })
    .select()
    .single();

  if (error || !quiz) return ERR.INTERNAL('Không thể tạo quiz');

  // If questions provided, insert them
  if (Array.isArray(questions) && questions.length > 0) {
    const questionRows = questions.map((q: { question: string; type?: string; options?: unknown[]; explanation?: string; points?: number }, idx: number) => ({
      quiz_id: quiz.id,
      question: q.question,
      type: q.type || 'single',
      options: q.options || [],
      explanation: q.explanation || '',
      sort_order: idx,
      points: q.points || 1,
    }));

    await supabase.from('quiz_questions').insert(questionRows);
  }

  // Fetch back with questions
  const { data: createdQuestions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quiz.id)
    .order('sort_order', { ascending: true });

  return apiSuccess({
    ...quizRowToFrontend(quiz),
    questions: (createdQuestions || []).map(quizQuestionRowToFrontend),
  }, 201);
}
