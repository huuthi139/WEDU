/**
 * Audit logging for admin mutations.
 * Records who did what, when, and the before/after state.
 */
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { logger } from './logger';

export interface AuditEntry {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an audit log entry.
 * Non-blocking: errors are logged but don't propagate.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: entry.actorUserId || null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        before_json: entry.beforeJson || null,
        after_json: entry.afterJson || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
      });

    if (error) {
      logger.warn('audit', 'Failed to write audit log', { error: error.message, action: entry.action });
    }
  } catch (err) {
    logger.warn('audit', 'Audit log write error', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Get recent audit logs (for admin dashboard)
 */
export async function getRecentAuditLogs(limit = 50): Promise<AuditEntry[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []) as unknown as AuditEntry[];
  } catch {
    return [];
  }
}
