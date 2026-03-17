import { cookies } from 'next/headers';
import { apiSuccess } from '@/lib/api/response';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { logger } from '@/lib/telemetry/logger';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    logger.info('auth.logout', 'User logged out');
  } catch (error) {
    logger.error('auth.logout', 'Error clearing session', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return apiSuccess({ loggedOut: true });
}
