import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { quizRowToFrontend, quizQuestionRowToFrontend } from '@/lib/types';

/**
 * PATCH /api/admin/quiz/[id]
 * Update a quiz
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) return ERR.FORBIDDEN();

  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const { title, description, timeLimitMinutes, passScore, maxAttempts, isRequired } = body;

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (timeLimitMinutes !== undefined) updateData.time_limit_minutes = timeLimitMinutes;
  if (passScore !== undefined) updateData.pass_score = passScore;
  if (maxAttempts !== undefined) updateData.max_attempts = maxAttempts;
  if (isRequired !== undefined) updateData.is_required = isRequired;

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error || !quiz) return ERR.NOT_FOUND('Quiz không tồn tại');

  return apiSuccess(quizRowToFrontend(quiz));
}

/**
 * DELETE /api/admin/quiz/[id]
 * Delete a quiz and all its questions
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) return ERR.FORBIDDEN();

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', params.id);

  if (error) return ERR.INTERNAL('Không thể xoá quiz');

  return apiSuccess({ deleted: true });
}

/**
 * GET /api/admin/quiz/[id]
 * Get single quiz with questions and attempt stats
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) return ERR.FORBIDDEN();

  const supabase = getSupabaseAdmin();

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!quiz) return ERR.NOT_FOUND('Quiz không tồn tại');

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', params.id)
    .order('sort_order', { ascending: true });

  // Get attempt stats
  const { count: totalAttempts } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', params.id);

  const { count: passedAttempts } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', params.id)
    .eq('passed', true);

  return apiSuccess({
    ...quizRowToFrontend(quiz),
    questions: (questions || []).map(quizQuestionRowToFrontend),
    stats: {
      totalAttempts: totalAttempts || 0,
      passedAttempts: passedAttempts || 0,
      passRate: totalAttempts ? Math.round(((passedAttempts || 0) / totalAttempts) * 100) : 0,
    },
  });
}
