/**
 * Profile service - wraps users table operations with proper types.
 * Provides a cleaner API for profile management.
 */
import { getSupabaseAdmin } from './client';
import type { Profile } from '@/lib/types';

/**
 * Get profile by user ID
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Get profile by email
 */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`[Supabase] getProfileByEmail failed: ${error.message}`);
  }
  return data as Profile;
}

/**
 * Update profile fields
 */
export async function updateProfile(
  userId: string,
  data: Partial<Pick<Profile, 'name' | 'phone' | 'avatar_url'>>
): Promise<Profile | null> {
  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from('users')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase Profiles] Update failed:', error.message);
    return null;
  }
  return updated as Profile;
}

/**
 * Get all profiles with a specific role (for admin)
 */
export async function getProfilesByRole(role: string): Promise<Profile[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Profile[];
}
