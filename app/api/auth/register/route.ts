import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { emailExists, createUserProfile } from '@/lib/supabase/users';
import { syncUserToSheet } from '@/lib/sync/sheetSync';
import { sendWelcomeEmail } from '@/lib/email/send';
import { apiSuccess, ERR } from '@/lib/api/response';
import { logger } from '@/lib/telemetry/logger';

export async function POST(request: Request) {
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

    if (!password || password.length < 6) {
      return ERR.VALIDATION('Mật khẩu phải có ít nhất 6 ký tự');
    }

    const hashedPassword = await hashPassword(password);

    if (await emailExists(email)) {
      return ERR.CONFLICT('Email đã được sử dụng. Vui lòng dùng email khác.');
    }

    // Create user in Supabase (source of truth)
    await createUserProfile({
      email, name, phone, passwordHash: hashedPassword, role: 'user', memberLevel: 'Free',
    });

    // Create session (set httpOnly cookie)
    try {
      await createSession({ email, role: 'user', name, level: 'Free' });
    } catch (sessionErr) {
      logger.error('auth.register', 'Session creation failed', {
        email,
        error: sessionErr instanceof Error ? sessionErr.message : String(sessionErr),
      });
    }

    // Background sync to Google Sheet (non-blocking)
    syncUserToSheet({ name, email, passwordHash: hashedPassword, phone });

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
