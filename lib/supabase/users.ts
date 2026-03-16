/**
 * Supabase user data operations
 * Handles user profile data in Supabase (users table)
 */
import { getSupabaseAdmin } from './client';

export interface SupabaseUser {
  id?: string;
  email: string;
  name: string;
  phone: string;
  password_hash: string;
  role: 'admin' | 'sub_admin' | 'instructor' | 'user';
  member_level: 'Free' | 'Premium' | 'VIP';
  created_at: string;
  updated_at: string;
}

/**
 * Get user profile from Supabase by email
 */
export async function getUserByEmail(email: string): Promise<SupabaseUser | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as SupabaseUser;
}

/**
 * Get user profile from Supabase by ID
 */
export async function getUserById(id: string): Promise<SupabaseUser | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as SupabaseUser;
}

/**
 * Create user profile in Supabase
 */
export async function createUserProfile(
  data: { email: string; name: string; phone?: string; passwordHash: string; role?: string; memberLevel?: string }
): Promise<SupabaseUser> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const userData = {
    email: data.email.toLowerCase(),
    name: data.name,
    phone: data.phone || '',
    password_hash: data.passwordHash,
    role: (['admin', 'sub_admin', 'instructor'].includes(data.role || '') ? data.role : 'user'),
    member_level: (['Free', 'Premium', 'VIP'].includes(data.memberLevel || '') ? data.memberLevel : 'Free'),
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) {
    throw new Error(`[Supabase] Failed to create user: ${error.message}`);
  }

  return inserted as SupabaseUser;
}

/**
 * Update user profile in Supabase
 */
export async function updateUserProfile(
  email: string,
  data: Partial<Pick<SupabaseUser, 'name' | 'phone' | 'role' | 'member_level' | 'password_hash'>>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email.toLowerCase());

  if (error) {
    throw new Error(`[Supabase] Failed to update user: ${error.message}`);
  }
}

/**
 * Check if email already exists in Supabase
 */
export async function emailExists(email: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .limit(1)
    .single();

  return !!data;
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers(): Promise<SupabaseUser[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as SupabaseUser[];
}
