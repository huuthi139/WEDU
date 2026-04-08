import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { quizQuestionRowToFrontend } from '@/lib/types';

/**
 * POST /api/admin/quiz/[id]/questions
 * Replace all questions for a quiz (delete existing + insert new)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) return ERR.FORBIDDEN();

  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { questions } = body;

  if (!Array.isArray(questions)) return ERR.VALIDATION('questions phải là mảng');

  // Delete existing questions
  await supabase.from('quiz_questions').delete().eq('quiz_id', params.id);

  // Insert new questions
  if (questions.length > 0) {
    const rows = questions.map((q: { question: string; type?: string; options?: unknown[]; explanation?: string; points?: number }, idx: number) => ({
      quiz_id: params.id,
      question: q.question,
      type: q.type || 'single',
      options: q.options || [],
      explanation: q.explanation || '',
      sort_order: idx,
      points: q.points || 1,
    }));

    const { error } = await supabase.from('quiz_questions').insert(rows);
    if (error) return ERR.INTERNAL('Không thể lưu câu hỏi');
  }

  // Return updated questions
  const { data: savedQuestions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', params.id)
    .order('sort_order', { ascending: true });

  return apiSuccess({
    questions: (savedQuestions || []).map(quizQuestionRowToFrontend),
  });
}
