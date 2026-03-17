import { NextRequest } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/guards';
import { getUserByEmail } from '@/lib/supabase/users';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

/**
 * GET /api/lessons/notes?courseId=xxx&lessonId=yyy
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const dbUser = await getUserByEmail(authUser.email);
    if (!dbUser?.id) return ERR.UNAUTHORIZED();

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');

    if (!courseId || !lessonId) return ERR.VALIDATION('courseId và lessonId là bắt buộc');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lesson_notes')
      .select('*')
      .eq('user_id', dbUser.id)
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('lessons.notes.get', 'Failed', { error: error.message });
      return ERR.INTERNAL();
    }

    return apiSuccess({ notes: data || [] });
  } catch (error) {
    if (error instanceof AuthError) return ERR.UNAUTHORIZED();
    return ERR.INTERNAL();
  }
}

/**
 * POST /api/lessons/notes
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const dbUser = await getUserByEmail(authUser.email);
    if (!dbUser?.id) return ERR.UNAUTHORIZED();

    const { courseId, lessonId, noteText, noteTimeSeconds } = await req.json();

    if (!courseId || !lessonId || !noteText) {
      return ERR.VALIDATION('courseId, lessonId và noteText là bắt buộc');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lesson_notes')
      .insert({
        user_id: dbUser.id,
        course_id: courseId,
        lesson_id: lessonId,
        note_text: noteText.slice(0, 5000),
        note_time_seconds: typeof noteTimeSeconds === 'number' ? noteTimeSeconds : null,
      })
      .select()
      .single();

    if (error) {
      logger.error('lessons.notes.create', 'Failed', { error: error.message });
      return ERR.INTERNAL();
    }

    return apiSuccess({ note: data }, 201);
  } catch (error) {
    if (error instanceof AuthError) return ERR.UNAUTHORIZED();
    return ERR.INTERNAL();
  }
}
