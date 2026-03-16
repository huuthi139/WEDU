import getResend, { EMAIL_FROM } from './client';
import { welcomeEmail, passwordResetEmail, courseCompletionEmail } from './templates';

/** Send welcome email to newly registered user */
export async function sendWelcomeEmail(to: string, name: string) {
  const { subject, html } = welcomeEmail(name);
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error('[Email] Failed to send welcome email:', error);
      return false;
    }
    console.log('[Email] Welcome email sent to', to);
    return true;
  } catch (err) {
    console.error('[Email] Error sending welcome email:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Send password reset email with reset link */
export async function sendPasswordResetEmail(to: string, name: string, resetToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wedu.vn';
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
  const { subject, html } = passwordResetEmail(name, resetLink);
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error('[Email] Failed to send password reset email:', error);
      return false;
    }
    console.log('[Email] Password reset email sent to', to);
    return true;
  } catch (err) {
    console.error('[Email] Error sending password reset email:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Send course completion congratulation email */
export async function sendCourseCompletionEmail(
  to: string,
  name: string,
  courseName: string,
  certificateLink?: string
) {
  const { subject, html } = courseCompletionEmail(name, courseName, certificateLink);
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error('[Email] Failed to send course completion email:', error);
      return false;
    }
    console.log('[Email] Course completion email sent to', to);
    return true;
  } catch (err) {
    console.error('[Email] Error sending course completion email:', err instanceof Error ? err.message : err);
    return false;
  }
}
