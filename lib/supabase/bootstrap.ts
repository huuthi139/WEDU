/**
 * Auto-bootstrap: seed default admin when users table is empty.
 * Supabase is the only data source — no external sync.
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

/**
 * Try to auto-bootstrap if the users table is empty.
 * Seeds only the default admin user.
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

    console.log('[bootstrap] Users table is empty, seeding default admin...');

    const isoNow = new Date().toISOString();
    const adminPasswordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

    // Seed default admin
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

    console.log('[bootstrap] Default admin seeded successfully');
    return true;
  } catch (err) {
    console.error('[bootstrap] Error:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    bootstrapInProgress = false;
  }
}
