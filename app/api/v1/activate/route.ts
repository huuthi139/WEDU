import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { grantCourseAccess } from '@/lib/supabase/course-access';
import { createUserProfile, getUserByEmail } from '@/lib/supabase/users';
import { hashPassword, LOCKED_PASSWORD_SENTINEL } from '@/lib/auth/password';

/**
 * POST /api/v1/activate
 * All-in-one student activation: find or create user, grant course access, upgrade member_level.
 *
 * Body:
 * {
 *   email: string          // required
 *   name?: string          // for new user creation
 *   phone?: string         // for new user creation
 *   password?: string      // for new user creation (optional, locked if omitted)
 *   course_ids: string[]   // courses to grant access to
 *   access_tier?: "free" | "premium" | "vip" (default: "premium")
 *   expires_at?: string    // ISO date (optional)
 * }
 */
export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
  }

  const courseIds = Array.isArray(body.course_ids) ? body.course_ids.filter((id): id is string => typeof id === 'string' && id.trim() !== '') : [];
  if (courseIds.length === 0) {
    return NextResponse.json({ success: false, error: 'course_ids must be a non-empty array of strings' }, { status: 400 });
  }

  const accessTier = typeof body.access_tier === 'string' && ['free', 'premium', 'vip'].includes(body.access_tier)
    ? (body.access_tier as 'free' | 'premium' | 'vip')
    : 'premium';
  const expiresAt = typeof body.expires_at === 'string' ? body.expires_at : null;

  try {
    // 1. Find or create user
    let user = await getUserByEmail(email);
    let userCreated = false;

    if (!user) {
      const name = typeof body.name === 'string' ? body.name.trim() : email.split('@')[0];
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const password = typeof body.password === 'string' && body.password.length >= 6
        ? body.password
        : '';

      const passwordHash = password ? await hashPassword(password) : LOCKED_PASSWORD_SENTINEL;

      user = await createUserProfile({
        email,
        name,
        phone,
        passwordHash,
        role: 'user',
        memberLevel: accessTier === 'vip' ? 'VIP' : 'Premium',
      });
      userCreated = true;
    }

    const userId = user.id!;

    // 2. Grant course access for each course
    const results: { course_id: string; status: string }[] = [];
    for (const courseId of courseIds) {
      const record = await grantCourseAccess({
        userId,
        courseId,
        accessTier,
        source: 'api',
        expiresAt,
      });
      results.push({
        course_id: courseId,
        status: record ? 'granted' : 'failed',
      });
    }

    // 3. Upgrade member_level if needed
    const supabase = getSupabaseAdmin();
    const TIER_RANK: Record<string, number> = { Free: 0, Premium: 1, VIP: 2 };
    const TARGET_LEVEL = accessTier === 'vip' ? 'VIP' : 'Premium';
    const currentRank = TIER_RANK[user.member_level] ?? 0;
    const targetRank = TIER_RANK[TARGET_LEVEL] ?? 1;

    if (targetRank > currentRank) {
      await supabase
        .from('users')
        .update({ member_level: TARGET_LEVEL, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: userId,
        email,
        user_created: userCreated,
        member_level: targetRank > currentRank ? TARGET_LEVEL : user.member_level,
        courses: results,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
