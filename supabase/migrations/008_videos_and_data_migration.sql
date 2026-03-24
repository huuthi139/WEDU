-- =============================================
-- WEDU Platform - Migration 008
-- Phase: Videos table + update lessons FK
--
-- Creates:
-- 1. videos table (video library/registry)
-- 2. Adds video_ref_id UUID FK to lessons → videos
-- 3. Adds order_index to course_sections (alias for sort_order)
-- =============================================

-- =============================================
-- 1. CREATE videos TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('bunny', 'youtube')),
  video_id TEXT NOT NULL,
  library_id TEXT,
  url TEXT,
  duration TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_source ON public.videos(source);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON public.videos(video_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_source_video_library
  ON public.videos(video_id, COALESCE(library_id, ''));

-- =============================================
-- 2. ADD video_ref_id UUID FK to lessons
-- (existing video_id is TEXT, keep it for backward compat)
-- =============================================
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS video_ref_id UUID REFERENCES public.videos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_video_ref ON public.lessons(video_ref_id);

-- =============================================
-- 3. ADD order_index to course_sections
-- (mirrors sort_order for the new schema convention)
-- =============================================
ALTER TABLE public.course_sections
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- Copy sort_order to order_index for existing rows
UPDATE public.course_sections SET order_index = sort_order WHERE order_index = 0 AND sort_order != 0;

-- =============================================
-- 4. RLS policies for videos table
-- =============================================
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Everyone can read videos
CREATE POLICY "videos_read_all" ON public.videos
  FOR SELECT USING (true);

-- Only service role can insert/update/delete (handled by service key)
CREATE POLICY "videos_insert_service" ON public.videos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "videos_update_service" ON public.videos
  FOR UPDATE USING (true);

CREATE POLICY "videos_delete_service" ON public.videos
  FOR DELETE USING (true);
