/**
 * Phase 4.7 - Audit logging for admin mutations.
 * Records who did what, when, and the before/after state.
 */
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { logger } from './logger';

export interface AuditEntry {
  actorUserId?: string;
  actionType: string;       // import_run, user_upsert, course_upsert, course_access_upsert, course_access_upgrade, course_access_revoke
  targetTable?: string;     // users, courses, course_access
  targetId?: string;
  entityKey?: string;       // email / course_code / composite reference
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: 'success' | 'skipped' | 'failed';
  errorMessage?: string;
}

/**
 * Write an audit log entry.
 * Non-blocking: errors are logged but don't propagate.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    // Production uses migration 002 schema: action, entity_type, entity_id, before_json, after_json
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: entry.actorUserId || null,
        action: entry.actionType,
        entity_type: entry.targetTable || 'system',
        entity_id: entry.targetId || entry.entityKey || null,
        before_json: entry.oldValue || null,
        after_json: entry.newValue || entry.metadata || null,
      });

    if (error) {
      logger.warn('audit', 'Failed to write audit log', { error: error.message, action: entry.actionType });
    }
  } catch (err) {
    logger.warn('audit', 'Audit log write error', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Write multiple audit log entries in batch.
 */
export async function writeAuditLogBatch(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const supabase = getSupabaseAdmin();
    // Production uses migration 002 schema: action, entity_type, entity_id, before_json, after_json
    const rows = entries.map(entry => ({
      actor_user_id: entry.actorUserId || null,
      action: entry.actionType,
      entity_type: entry.targetTable || 'system',
      entity_id: entry.targetId || entry.entityKey || null,
      before_json: entry.oldValue || null,
      after_json: entry.newValue || entry.metadata || null,
    }));

    const { error } = await supabase.from('audit_logs').insert(rows);
    if (error) {
      logger.warn('audit', 'Failed to write audit log batch', { error: error.message, count: entries.length });
    }
  } catch (err) {
    logger.warn('audit', 'Audit log batch error', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Log an import run summary
 */
export async function logImportRun(opts: {
  actorUserId?: string;
  dryRun: boolean;
  tables: string[];
  results: Record<string, unknown>;
  totalRows: number;
  totalErrors: number;
}): Promise<void> {
  await writeAuditLog({
    actorUserId: opts.actorUserId,
    actionType: 'import_run',
    metadata: {
      dryRun: opts.dryRun,
      tables: opts.tables,
      results: opts.results,
      totalRows: opts.totalRows,
      totalErrors: opts.totalErrors,
    },
    status: opts.totalErrors > 0 ? 'failed' : 'success',
  });
}

/**
 * Get recent audit logs (for admin dashboard)
 */
export async function getRecentAuditLogs(limit = 50, offset = 0): Promise<unknown[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return data || [];
  } catch {
    return [];
  }
}

/**
 * Get audit logs filtered by action type
 */
export async function getAuditLogsByAction(actionType: string, limit = 50): Promise<unknown[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', actionType)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  } catch {
    return [];
  }
}
