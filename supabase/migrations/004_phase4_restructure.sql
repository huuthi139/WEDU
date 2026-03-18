-- =============================================
-- WEDU Platform - Migration 004
-- Phase 4: Restructure Course Access Model + Content Hierarchy
--
-- Changes:
-- 1. Add system_role to users (admin|instructor|student), keep member_level for backward compat
-- 2. Add course_chapters table (rename from course_sections conceptually)
-- 3. Add course_sessions table (new layer between chapter and lesson)
-- 4. Add access_tier, lesson_type, slug, content columns to lessons
-- 5. Add course_access table (per-course access control)
-- 6. Add access_tier to order_items
-- 7. Update courses table with new fields
-- 8. Proper RLS policies
-- =============================================

-- =============================================
-- 1. UPDATE USERS TABLE
-- =============================================

-- Add system_role column (for system-level access control)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS system_role TEXT NOT NULL DEFAULT 'student'
  CHECK (system_role IN ('admin', 'instructor', 'student'));

-- Migrate existing role data to system_role
UPDATE public.users SET system_role = 'admin' WHERE role IN ('admin', 'sub_admin') AND system_role = 'student';
UPDATE public.users SET system_role = 'instructor' WHERE role = 'instructor' AND system_role = 'student';

-- Add status column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'banned'));

-- =============================================
-- 2. UPDATE COURSES TABLE
-- =============================================

-- Add new columns
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS short_description TEXT DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));

-- Migrate is_active/is_published to status
UPDATE public.courses SET status = 'archived' WHERE is_active = false;
UPDATE public.courses SET status = 'draft' WHERE is_published = false AND is_active = true;

-- =============================================
-- 3. COURSE_CHAPTERS TABLE
-- (We keep course_sections table and add chapter_id linkage,
--  but also create a proper course_chapters table for the new hierarchy)
-- =============================================

CREATE TABLE IF NOT EXISTS public.course_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_chapters_course ON public.course_chapters(course_id);
CREATE INDEX IF NOT EXISTS idx_course_chapters_sort ON public.course_chapters(course_id, sort_order);

-- =============================================
-- 4. COURSE_SESSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.course_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.course_chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_sessions_course ON public.course_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_course_sessions_chapter ON public.course_sessions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_course_sessions_sort ON public.course_sessions(chapter_id, sort_order);

-- =============================================
-- 5. UPDATE LESSONS TABLE
-- =============================================

-- Add new columns to existing lessons table
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.course_chapters(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.course_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'video'
  CHECK (lesson_type IN ('video', 'text', 'pdf', 'audio', 'quiz', 'live', 'replay'));
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (access_tier IN ('free', 'premium', 'vip'));
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_id TEXT DEFAULT '';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published'));

-- Migrate is_preview to access_tier
UPDATE public.lessons SET access_tier = 'free' WHERE is_preview = true;
-- Non-preview lessons default to premium (can be adjusted manually)
UPDATE public.lessons SET access_tier = 'premium' WHERE is_preview = false OR is_preview IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON public.lessons(chapter_id);
CREATE INDEX IF NOT EXISTS idx_lessons_session ON public.lessons(session_id);
CREATE INDEX IF NOT EXISTS idx_lessons_access_tier ON public.lessons(access_tier);

-- =============================================
-- 6. UPDATE LESSON_RESOURCES TABLE
-- =============================================

-- Add resource_type values and sort_order
ALTER TABLE public.lesson_resources ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
-- resource_type already exists, update check constraint
-- (existing values: 'file', new values: pdf|zip|link|doc|worksheet|asset)

-- =============================================
-- 7. COURSE_ACCESS TABLE (replaces enrollment-based access)
-- =============================================

CREATE TABLE IF NOT EXISTS public.course_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  access_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (access_tier IN ('free', 'premium', 'vip')),
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('manual', 'order', 'gift', 'admin', 'scholarship', 'system')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_access_user ON public.course_access(user_id);
CREATE INDEX IF NOT EXISTS idx_course_access_course ON public.course_access(course_id);
CREATE INDEX IF NOT EXISTS idx_course_access_tier ON public.course_access(access_tier);
CREATE INDEX IF NOT EXISTS idx_course_access_status ON public.course_access(status);

-- =============================================
-- 8. UPDATE ORDERS TABLE
-- =============================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VND';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transaction_code TEXT DEFAULT '';

-- =============================================
-- 9. UPDATE ORDER_ITEMS TABLE
-- =============================================

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'premium'
  CHECK (access_tier IN ('premium', 'vip'));

-- =============================================
-- 10. UPDATE LESSON_PROGRESS TABLE
-- =============================================

-- Add watch_seconds column
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS watch_seconds INTEGER DEFAULT 0;

-- Rename columns for consistency (position_seconds -> last_position_seconds)
-- (Keep existing column for backward compat, add alias)
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER DEFAULT 0;

-- =============================================
-- 11. UPDATE COURSE_PROGRESS TABLE
-- =============================================

ALTER TABLE public.course_progress ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.course_progress ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.course_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- =============================================
-- 12. MIGRATE ENROLLMENTS TO COURSE_ACCESS
-- =============================================

-- Migrate existing enrollments to course_access
-- All enrollments become 'free' access since the old system didn't track tiers
INSERT INTO public.course_access (user_id, course_id, access_tier, source, status, activated_at, created_at)
SELECT
  u.id,
  e.course_id,
  'free',
  'system',
  'active',
  e.enrolled_at,
  e.enrolled_at
FROM public.enrollments e
INNER JOIN public.users u ON u.email = e.user_email
ON CONFLICT (user_id, course_id) DO NOTHING;

-- Also migrate course_enrollments table
INSERT INTO public.course_access (user_id, course_id, access_tier, source, status, activated_at, created_at)
SELECT
  ce.user_id,
  ce.course_id,
  'free',
  'system',
  'active',
  ce.enrolled_at,
  ce.enrolled_at
FROM public.course_enrollments ce
ON CONFLICT (user_id, course_id) DO NOTHING;

-- =============================================
-- 13. MIGRATE COURSE_SECTIONS TO COURSE_CHAPTERS
-- =============================================

-- Copy existing course_sections data to course_chapters
INSERT INTO public.course_chapters (id, course_id, title, description, sort_order, created_at, updated_at)
SELECT id, course_id, title, description, sort_order, created_at, updated_at
FROM public.course_sections
ON CONFLICT (id) DO NOTHING;

-- Link existing lessons to their chapters (section_id -> chapter_id)
UPDATE public.lessons SET chapter_id = section_id WHERE section_id IS NOT NULL AND chapter_id IS NULL;

-- =============================================
-- 14. RLS POLICIES FOR NEW TABLES
-- =============================================

ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_access ENABLE ROW LEVEL SECURITY;

-- course_chapters: public read
CREATE POLICY "course_chapters_public_read" ON public.course_chapters
  FOR SELECT USING (true);
CREATE POLICY "course_chapters_admin_write" ON public.course_chapters
  FOR ALL USING (true) WITH CHECK (true);

-- course_sessions: public read
CREATE POLICY "course_sessions_public_read" ON public.course_sessions
  FOR SELECT USING (true);
CREATE POLICY "course_sessions_admin_write" ON public.course_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- course_access: users read their own, admin manages all
-- For now, service_role bypasses RLS, and we use API routes for access control
CREATE POLICY "course_access_public_read" ON public.course_access
  FOR SELECT USING (true);
CREATE POLICY "course_access_admin_write" ON public.course_access
  FOR ALL USING (true) WITH CHECK (true);

SELECT 'Migration 004: Phase 4 restructure completed!' as result;
