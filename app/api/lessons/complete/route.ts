import { NextRequest } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/guards';
import { getUserByEmail } from '@/lib/supabase/users';
import { markLessonComplete } from '@/lib/progress/service';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

/**
 * POST /api/lessons/complete
 * Mark a lesson as completed
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const dbUser = await getUserByEmail(authUser.email);
    if (!dbUser?.id) return ERR.UNAUTHORIZED('Tài khoản không hợp lệ');

    const { courseId, lessonId } = await req.json();

    if (!courseId || !lessonId) {
      return ERR.VALIDATION('courseId và lessonId là bắt buộc');
    }

    const success = await markLessonComplete(dbUser.id, courseId, lessonId);

    if (!success) {
      return ERR.INTERNAL('Không thể đánh dấu hoàn thành');
    }

    logger.info('lessons.complete', 'Lesson completed', {
      userId: dbUser.id,
      courseId,
      lessonId,
    });

    return apiSuccess({ completed: true });
  } catch (error) {
    if (error instanceof AuthError) return ERR.UNAUTHORIZED();
    logger.error('lessons.complete', 'Error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
