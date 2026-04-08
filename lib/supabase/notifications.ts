import { getSupabaseAdmin } from './client';
import type { NotificationType } from '@/lib/types';

/**
 * Create a notification for a specific user.
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link || '',
    metadata: params.metadata || {},
  });
}

/**
 * Create notifications for multiple users.
 */
export async function createBulkNotifications(params: {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (params.userIds.length === 0) return;
  const supabase = getSupabaseAdmin();
  const rows = params.userIds.map(userId => ({
    user_id: userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link || '',
    metadata: params.metadata || {},
  }));
  await supabase.from('notifications').insert(rows);
}
