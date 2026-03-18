-- =============================================
-- WEDU Platform - Migration 006
-- Phase 4.7: Audit Logs for admin import and access changes
--
-- Changes:
-- 1. Create audit_logs table
-- 2. Enable RLS on audit_logs
-- 3. Add indexes for common queries
-- =============================================

-- =============================================
-- 1. CREATE AUDIT_LOGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  action_type TEXT NOT NULL,        -- import_run, user_upsert, course_upsert, course_access_upsert, course_access_upgrade, course_access_revoke
  target_table TEXT,                -- users, courses, course_access
  target_id TEXT,                   -- entity id (user id, course id, course_access id)
  entity_key TEXT,                  -- email / course_code / composite reference
  old_value JSONB,                  -- previous state (if applicable)
  new_value JSONB,                  -- new state (if applicable)
  metadata JSONB,                   -- additional context (import stats, batch info, etc.)
  status TEXT DEFAULT 'success',    -- success, skipped, failed
  error_message TEXT,               -- error details if failed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. ENABLE RLS
-- =============================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role (admin API) can read/write audit logs
CREATE POLICY "audit_logs_service_manage" ON public.audit_logs
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 3. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_table ON public.audit_logs (target_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_key ON public.audit_logs (entity_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_user_id);

SELECT 'Migration 006: Phase 4.7 audit_logs table created!' as result;
