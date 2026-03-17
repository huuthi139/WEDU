/**
 * Auto-bootstrap: sync Google Sheet → Supabase when users table is empty.
 * Called automatically during login if no users are found.
 */
import { getSupabaseAdmin } from './client';
import { hashPassword } from '@/lib/auth/password';

// Prevent multiple concurrent bootstrap attempts
let bootstrapInProgress = false;
let lastBootstrapAttempt = 0;
const BOOTSTRAP_COOLDOWN_MS = 30_000; // 30 seconds between attempts

const DEFAULT_ADMIN_EMAIL = 'admin@wedu.vn';
const DEFAULT_ADMIN_PASSWORD = 'Admin139@';
const DEFAULT_ADMIN_NAME = 'Admin WEDU';
const SHEET_ADMIN_EMAILS = ['admin@wepower.vn', 'admin2@wepower.vn'];

/**
 * Try to auto-bootstrap if the users table is empty.
 * Returns true if bootstrap was executed, false if skipped.
 */
export async function tryAutoBootstrap(): Promise<boolean> {
  // Rate limit
  const now = Date.now();
  if (bootstrapInProgress || (now - lastBootstrapAttempt) < BOOTSTRAP_COOLDOWN_MS) {
    return false;
  }

  bootstrapInProgress = true;
  lastBootstrapAttempt = now;

  try {
    const supabase = getSupabaseAdmin();

    // Check if users table has data
    const { data: existing, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error || (existing && existing.length > 0)) {
      return false; // Table has data or error checking
    }

    console.log('[bootstrap] Users table is empty, starting auto-sync...');

    const isoNow = new Date().toISOString();
    const adminPasswordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

    // 1. Seed admin
    await supabase.from('users').insert({
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      phone: '',
      password_hash: adminPasswordHash,
      role: 'admin',
      member_level: 'VIP',
      created_at: isoNow,
      updated_at: isoNow,
    });

    // 2. Sync from Google Sheet
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!scriptUrl) {
      console.log('[bootstrap] No GOOGLE_SCRIPT_URL, skipping Sheet sync');
      return true;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(`${scriptUrl}?action=getUsers`, {
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (!data?.success || !Array.isArray(data.users)) {
      console.log('[bootstrap] Google Sheet returned no users');
      return true;
    }

    const usersToInsert = [];
    for (const u of data.users) {
      const email = (u.Email || u.email || '').toLowerCase().trim();
      if (!email || email === DEFAULT_ADMIN_EMAIL) continue;

      const sheetRole = (u.Role || '').toLowerCase().trim();
      let role = 'user';
      if (sheetRole === 'admin' || SHEET_ADMIN_EMAILS.includes(email)) {
        role = 'admin';
      } else if (sheetRole === 'instructor') {
        role = 'instructor';
      } else if (sheetRole === 'sub_admin') {
        role = 'sub_admin';
      }

      const sheetLevel = u.Level || 'Free';
      const member_level = ['Free', 'Premium', 'VIP'].includes(sheetLevel) ? sheetLevel : 'Free';
      const isSheetAdmin = SHEET_ADMIN_EMAILS.includes(email);

      usersToInsert.push({
        email,
        name: u['Tên'] || u.name || '',
        phone: u.Phone || u.phone || '',
        password_hash: isSheetAdmin ? adminPasswordHash : '',
        role,
        member_level,
        created_at: isoNow,
        updated_at: isoNow,
      });
    }

    if (usersToInsert.length > 0) {
      // Batch insert
      for (let i = 0; i < usersToInsert.length; i += 50) {
        const batch = usersToInsert.slice(i, i + 50);
        await supabase
          .from('users')
          .upsert(batch, { onConflict: 'email', ignoreDuplicates: true });
      }
    }

    console.log(`[bootstrap] Auto-sync complete: ${usersToInsert.length} users from Sheet`);
    return true;
  } catch (err) {
    console.error('[bootstrap] Error:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    bootstrapInProgress = false;
  }
}
