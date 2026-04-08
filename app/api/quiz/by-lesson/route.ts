import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { verifyAuth } from '@/lib/api/verify-admin';
import { apiSuccess, ERR } from '@/lib/api/response';
import { quizRowToFrontend } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { authenticated } = await verifyAuth(request);
  if (!authenticated) return ERR.UNAUTHORIZED();

  const supabase = getSupabaseAdmin();
  const lessonId = new URL(request.url).searchParams.get('lessonId');
  if (!lessonId) return ERR.VALIDATION('lessonId required');

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) return ERR.INTERNAL();
  return apiSuccess((data || []).map(quizRowToFrontend));
}
