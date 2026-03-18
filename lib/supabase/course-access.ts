/**
 * WEDU Platform - Course Access Service
 * Per-course access control using course_access table.
 * Replaces the old enrollment-based access model.
 */
import { getSupabaseAdmin } from './client';
import type { CourseAccessRow, AccessTier, AccessSource } from '@/lib/types';

/**
 * Get the course access record for a user on a specific course.
 * Returns null if user has no access record for this course.
 */
export async function getCourseAccess(
  userId: string,
  courseId: string
): Promise<CourseAccessRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('course_access')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as CourseAccessRow;
}

/**
 * Get all course access records for a user.
 */
export async function getCourseAccessByUser(
  userId: string
): Promise<CourseAccessRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('course_access')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[CourseAccess] Failed to fetch:', error.message);
    return [];
  }
  return (data || []) as CourseAccessRow[];
}

/**
 * Get the effective access tier for a user on a specific course.
 * Returns 'free' if no access record exists (everyone can access free content).
 */
export async function getEffectiveAccessTier(
  userId: string,
  courseId: string
): Promise<AccessTier> {
  const access = await getCourseAccess(userId, courseId);
  if (!access) return 'free';
  return access.access_tier as AccessTier;
}

/**
 * Grant or upgrade course access for a user.
 * If user already has access, upgrades to higher tier.
 */
export async function grantCourseAccess(params: {
  userId: string;
  courseId: string;
  accessTier: AccessTier;
  source: AccessSource;
  expiresAt?: string | null;
}): Promise<CourseAccessRow | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Check existing access
  const { data: existing } = await supabase
    .from('course_access')
    .select('*')
    .eq('user_id', params.userId)
    .eq('course_id', params.courseId)
    .limit(1)
    .single();

  const TIER_RANK: Record<string, number> = { free: 0, premium: 1, vip: 2 };

  if (existing) {
    // Only upgrade, never downgrade
    const currentRank = TIER_RANK[existing.access_tier] || 0;
    const newRank = TIER_RANK[params.accessTier] || 0;
    if (newRank <= currentRank && existing.status === 'active') {
      return existing as CourseAccessRow;
    }

    const { data, error } = await supabase
      .from('course_access')
      .update({
        access_tier: params.accessTier,
        source: params.source,
        status: 'active',
        activated_at: now,
        expires_at: params.expiresAt || null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('[CourseAccess] Upgrade failed:', error.message);
      return null;
    }
    return data as CourseAccessRow;
  }

  // Create new access record
  const { data, error } = await supabase
    .from('course_access')
    .insert({
      user_id: params.userId,
      course_id: params.courseId,
      access_tier: params.accessTier,
      source: params.source,
      status: 'active',
      activated_at: now,
      expires_at: params.expiresAt || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('[CourseAccess] Grant failed:', error.message);
    return null;
  }
  return data as CourseAccessRow;
}

/**
 * Revoke course access for a user.
 */
export async function revokeCourseAccess(
  userId: string,
  courseId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('course_access')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('course_id', courseId);

  if (error) {
    console.error('[CourseAccess] Revoke failed:', error.message);
    return false;
  }
  return true;
}
