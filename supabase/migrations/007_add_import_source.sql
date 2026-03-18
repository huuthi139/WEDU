-- =============================================
-- WEDU Platform - Migration 007
-- Add 'import' to course_access source check constraint
-- =============================================

-- Drop the old constraint and add updated one with 'import' included
ALTER TABLE public.course_access DROP CONSTRAINT IF EXISTS course_access_source_check;
ALTER TABLE public.course_access ADD CONSTRAINT course_access_source_check
  CHECK (source IN ('manual', 'order', 'gift', 'admin', 'scholarship', 'system', 'import'));

SELECT 'Migration 007: Added import to course_access source constraint' as result;
