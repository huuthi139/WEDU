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
  system_role?: 'admin' | 'instructor' | 'student';
  member_level: 'Free' | 'Premium' | 'VIP';
  avatar_url?: string | null;
  status?: string;
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

  if (error) {
    // PGRST116 = "no rows found" from .single() - this is expected when user doesn't exist
    if (error.code === 'PGRST116') return null;
    // Any other error (table missing, connection issue, etc.) should be thrown
    // so the caller can handle it properly
    throw new Error(`[Supabase] getUserByEmail failed: ${error.message} (code: ${error.code})`);
  }

  return data as SupabaseUser || null;
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

  if (error) {
    throw new Error(`[Supabase] getAllUsers failed: ${error.message} (code: ${error.code})`);
  }
  return (data as SupabaseUser[]) || [];
}

/**
 * One-way sync: Google Sheets → Supabase (upsert only, never delete)
 * Uses email as unique key. Only adds new users or updates existing ones.
 * Never removes users from Supabase even if they're removed from Sheets.
 */
export async function syncSheetUsersToSupabase(sheetUsers: Array<{
  email: string;
  name: string;
  phone?: string;
  role?: string;
  systemRole?: string;
  memberLevel?: string;
  passwordHash?: string;
  status?: string;
}>): Promise<{ added: number; updated: number; skipped: number }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const u of sheetUsers) {
    const email = (u.email || '').toLowerCase().trim();
    if (!email) { skipped++; continue; }

    try {
      // Check if user already exists in Supabase
      const { data: existing } = await supabase
        .from('users')
        .select('id, email, name, phone, role, system_role, member_level, status')
        .eq('email', email)
        .limit(1)
        .single();

      const validRole = ['admin', 'sub_admin', 'instructor', 'user'].includes(u.role || '') ? u.role! : 'user';
      const validLevel = ['Free', 'Premium', 'VIP'].includes(u.memberLevel || '') ? u.memberLevel! : 'Free';
      const validSystemRole = ['admin', 'instructor', 'student'].includes(u.systemRole || '')
        ? u.systemRole!
        : (validRole === 'admin' || validRole === 'sub_admin') ? 'admin'
        : validRole === 'instructor' ? 'instructor'
        : 'student';
      const validStatus = ['active', 'inactive', 'banned'].includes(u.status || '') ? u.status! : 'active';

      if (existing) {
        // Update only if Sheet has newer/different info (don't overwrite with empty values)
        const updates: Record<string, string> = { updated_at: now };
        if (u.name && u.name !== existing.name) updates.name = u.name;
        if (u.phone && u.phone !== existing.phone) updates.phone = u.phone;
        if (u.role && validRole !== existing.role) updates.role = validRole;
        if (u.memberLevel && validLevel !== existing.member_level) updates.member_level = validLevel;
        if (u.systemRole && validSystemRole !== existing.system_role) updates.system_role = validSystemRole;
        if (u.status && validStatus !== existing.status) updates.status = validStatus;

        // Only update if there are actual changes beyond updated_at
        if (Object.keys(updates).length > 1) {
          const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('email', email);
          if (!error) updated++;
          else skipped++;
        } else {
          skipped++;
        }
      } else {
        // Insert new user from Sheet
        // Use locked sentinel when no password provided – account must be
        // activated via "Quên mật khẩu" (forgot-password) flow.
        const { LOCKED_PASSWORD_SENTINEL } = await import('@/lib/auth/password');
        const { error } = await supabase
          .from('users')
          .insert({
            email,
            name: u.name || '',
            phone: u.phone || '',
            password_hash: u.passwordHash || LOCKED_PASSWORD_SENTINEL,
            role: validRole,
            system_role: validSystemRole,
            member_level: validLevel,
            status: validStatus,
            created_at: now,
            updated_at: now,
          });
        if (!error) added++;
        else skipped++;
      }
    } catch {
      skipped++;
    }
  }

  console.log(`[Sync] Sheet→Supabase users: added=${added}, updated=${updated}, skipped=${skipped}`);
  return { added, updated, skipped };
}
