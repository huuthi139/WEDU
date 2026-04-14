import { NextRequest } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { emailExists, createUserProfile } from '@/lib/supabase/users';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { sendWelcomeEmail } from '@/lib/email/send';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 15) : '';

    if (!name || name.length < 2) {
      return ERR.VALIDATION('Tên phải có ít nhất 2 ký tự');
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!email || !emailRegex.test(email)) {
      return ERR.VALIDATION('Email không hợp lệ');
    }

    if (!password || password.length < 8) {
      return ERR.VALIDATION('Mật khẩu phải có ít nhất 8 ký tự');
    }

    const hashedPassword = await hashPassword(password);

    if (await emailExists(email)) {
      return ERR.CONFLICT('Email đã được sử dụng. Vui lòng dùng email khác.');
    }

    // Create user profile in Supabase (source of truth)
    const newUser = await createUserProfile({
      email, name, phone, passwordHash: hashedPassword, role: 'user', memberLevel: 'Free',
    });

    // Create session (set httpOnly cookie)
    try {
      await createSession({ userId: newUser.id!, email, role: 'user', name, level: 'Free' });
    } catch (sessionErr) {
      logger.error('auth.register', 'Session creation failed', {
        email,
        error: sessionErr instanceof Error ? sessionErr.message : String(sessionErr),
      });
    }

    // --- Generate ref_code for new user ---
    if (newUser.id) {
      const supabase = getSupabaseAdmin();
      try {
        await supabase.rpc('generate_ref_code').then(async ({ data: code }) => {
          if (code) {
            await supabase.from('users').update({ ref_code: code }).eq('id', newUser.id!);
          }
        });
      } catch {
        // ref_code generation is best-effort
      }

      // --- Affiliate: referral + wallet ---
      const refCookie = request.cookies.get('wedu-ref')?.value;
      if (refCookie) {
        try {
          // Lookup referrer by ref_code (short code, not UUID)
          const { data: referrer } = await supabase
            .from('users').select('id').eq('ref_code', refCookie).single();
          if (referrer && referrer.id !== newUser.id) {
            await supabase.from('referrals').insert({
              referrer_id: referrer.id,
              referee_id: newUser.id,
            }).select().maybeSingle();
          }
        } catch (refErr) {
          logger.error('auth.register', 'Referral save failed', {
            email, refCode: refCookie,
            error: refErr instanceof Error ? refErr.message : String(refErr),
          });
        }
      }
      // Create affiliate wallet for new user (always)
      try {
        await supabase.from('affiliate_wallets').upsert(
          { user_id: newUser.id, balance: 0, total_earned: 0 },
          { onConflict: 'user_id' },
        );
      } catch {
        // wallet creation is best-effort
      }
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(() => {});

    logger.info('auth.register', 'User registered', { email });

    // Return success only - client hydrates from /api/auth/me
    return apiSuccess({ registered: true });
  } catch (error) {
    logger.error('auth.register', 'Error', { error: error instanceof Error ? error.message : String(error) });
    return ERR.INTERNAL();
  }
}
