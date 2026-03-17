import { NextRequest } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/guards';
import { getUserByEmail } from '@/lib/supabase/users';
import { getLessonProgress, upsertLessonProgress, getCourseLesonProgress } from '@/lib/progress/service';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

/**
 * GET /api/lessons/progress?courseId=xxx&lessonId=yyy
 * Get progress for a specific lesson or all lessons in a course
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const dbUser = await getUserByEmail(authUser.email);
    if (!dbUser?.id) return ERR.UNAUTHORIZED('Tài khoản không hợp lệ');

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');

    if (!courseId) return ERR.VALIDATION('courseId là bắt buộc');

    if (lessonId) {
      const progress = await getLessonProgress(dbUser.id, courseId, lessonId);
      return apiSuccess({ progress });
    }

    const allProgress = await getCourseLesonProgress(dbUser.id, courseId);
    return apiSuccess({ progress: allProgress });
  } catch (error) {
    if (error instanceof AuthError) return ERR.UNAUTHORIZED();
    logger.error('lessons.progress.get', 'Error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}

/**
 * POST /api/lessons/progress
 * Autosave lesson progress (called every 15-30s, on blur, on lesson change)
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const dbUser = await getUserByEmail(authUser.email);
    if (!dbUser?.id) return ERR.UNAUTHORIZED('Tài khoản không hợp lệ');

    const body = await req.json();
    const { courseId, lessonId, positionSeconds, durationSeconds, deviceId } = body;

    if (!courseId || !lessonId) return ERR.VALIDATION('courseId và lessonId là bắt buộc');

    const result = await upsertLessonProgress({
      userId: dbUser.id,
      courseId,
      lessonId,
      positionSeconds: Number(positionSeconds) || 0,
      durationSeconds: Number(durationSeconds) || 0,
      deviceId,
    });

    if (!result) return ERR.INTERNAL('Không thể lưu tiến độ');

    return apiSuccess({ progress: result });
  } catch (error) {
    if (error instanceof AuthError) return ERR.UNAUTHORIZED();
    logger.error('lessons.progress.save', 'Error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
