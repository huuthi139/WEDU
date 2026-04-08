import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAuth } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { quizAttemptRowToFrontend } from '@/lib/types';

/**
 * GET /api/quiz/[quizId]/result
 * Get user's quiz attempt results
 */
export async function GET(request: NextRequest, { params }: { params: { quizId: string } }) {
  const { authenticated, userId } = await verifyAuth(request);
  if (!authenticated || !userId) return ERR.UNAUTHORIZED();

  const supabase = getSupabaseAdmin();
  const { quizId } = params;

  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('user_id', userId)
    .order('attempt_number', { ascending: false });

  return apiSuccess({
    attempts: (attempts || []).map(quizAttemptRowToFrontend),
  });
}
