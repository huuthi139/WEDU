import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { getSupabaseAdmin } from '@/lib/supabase/client';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTempPassword(): string {
  return Array.from(randomBytes(10))
    .map(b => CHARS[b % CHARS.length])
    .join('');
}

/**
 * POST /api/admin/reset-imported-passwords
 *
 * Generates a random temporary password for all imported users who still have
 * a locked/sentinel password_hash and sets must_change_password = true.
 * Only accessible by admin users.
 */
export async function POST(_req: NextRequest) {
  // Auth check – admin only
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const tempPassword = generateTempPassword();
    const newHash = await hashPassword(tempPassword);

    // Count affected users first
    const { count: countBefore } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('password_hash.eq.!IMPORTED_LOCKED,password_hash.eq.!!IMPORTED_LOCKED,password_hash.like.!!IMPORTED%,password_hash.like.!IMPORTED%,password_hash.is.null');

    // Update all locked/imported users to temporary password + flag must_change
    // Exclude admin and users who already have a real bcrypt hash
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: newHash, must_change_password: true })
      .or('password_hash.eq.!IMPORTED_LOCKED,password_hash.eq.!!IMPORTED_LOCKED,password_hash.like.!!IMPORTED%,password_hash.like.!IMPORTED%,password_hash.is.null')
      .not('email', 'eq', 'admin@wedu.vn')
      .not('password_hash', 'like', '$2b$%')
      .select('email');

    if (error) {
      console.error('[ResetImportedPasswords] Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error: ' + error.message },
        { status: 500 },
      );
    }

    const updatedCount = data?.length ?? 0;

    return NextResponse.json({
      success: true,
      message: `Da cap nhat ${updatedCount} tai khoan imported sang password tam thoi.`,
      tempPassword,
      updatedCount,
      countBefore: countBefore ?? 0,
      updatedEmails: data?.map((u: { email: string }) => u.email) ?? [],
    });
  } catch (err) {
    console.error('[ResetImportedPasswords] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}
