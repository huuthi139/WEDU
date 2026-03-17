import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { AuthError } from '@/lib/auth/guards';
import { getUserByEmail, updateUserProfile } from '@/lib/supabase/users';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

/**
 * GET /api/profile - Get current user's profile
 */
export async function GET() {
  try {
    const authUser = await requireAuth();
    const dbUser = await getUserByEmail(authUser.email);

    if (!dbUser) {
      return ERR.NOT_FOUND('Không tìm thấy hồ sơ');
    }

    return apiSuccess({
      profile: {
        id: dbUser.id || '',
        email: dbUser.email,
        name: dbUser.name,
        phone: dbUser.phone || '',
        role: authUser.role,
        memberLevel: dbUser.member_level || 'Free',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return ERR.UNAUTHORIZED(error.message);
    }
    logger.error('profile.get', 'Failed to get profile', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}

/**
 * PUT /api/profile - Update current user's profile
 */
export async function PUT(req: NextRequest) {
  try {
    const authUser = await requireAuth();
    const body = await req.json();

    const updates: Record<string, string> = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim().slice(0, 100);
    }
    if (typeof body.phone === 'string') {
      updates.phone = body.phone.trim().slice(0, 20);
    }

    if (Object.keys(updates).length === 0) {
      return ERR.VALIDATION('Không có dữ liệu cần cập nhật');
    }

    await updateUserProfile(authUser.email, updates);

    // Re-fetch to return canonical saved data
    const dbUser = await getUserByEmail(authUser.email);

    logger.info('profile.update', 'Profile updated', { email: authUser.email, fields: Object.keys(updates) });

    return apiSuccess({
      profile: {
        id: dbUser?.id || '',
        email: authUser.email,
        name: dbUser?.name || updates.name || '',
        phone: dbUser?.phone || updates.phone || '',
        role: authUser.role,
        memberLevel: dbUser?.member_level || 'Free',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return ERR.UNAUTHORIZED(error.message);
    }
    logger.error('profile.update', 'Failed to update profile', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
