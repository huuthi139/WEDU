-- Add 'image' to lesson_type CHECK constraint
-- Drop old constraint and recreate with 'image' included
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_lesson_type_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_lesson_type_check
  CHECK (lesson_type IN ('video', 'text', 'pdf', 'audio', 'quiz', 'live', 'replay', 'image'));
