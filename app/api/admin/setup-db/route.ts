/**
 * GET /api/admin/setup-db - Check database status
 * POST /api/admin/setup-db - Return SQL migration + seed data for manual execution
 */
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REQUIRED_TABLES = ['courses', 'orders', 'enrollments', 'reviews', 'chapters'];

async function checkTable(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=id&limit=0`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) {
      const data = await res.json();
      return data.code !== 'PGRST205';
    }
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const status: Record<string, boolean> = {};
  await Promise.all(REQUIRED_TABLES.map(async (t) => { status[t] = await checkTable(t); }));

  const missing = REQUIRED_TABLES.filter(t => !status[t]);
  const allOk = missing.length === 0;

  return NextResponse.json({
    success: allOk,
    tables: status,
    message: allOk
      ? 'Tất cả bảng đã tồn tại trên Supabase!'
      : `Thiếu ${missing.length} bảng: ${missing.join(', ')}. Gọi POST /api/admin/setup-db để lấy SQL.`,
  });
}

export async function POST() {
  const status: Record<string, boolean> = {};
  await Promise.all(REQUIRED_TABLES.map(async (t) => { status[t] = await checkTable(t); }));

  const missing = REQUIRED_TABLES.filter(t => !status[t]);

  if (missing.length === 0) {
    return NextResponse.json({ success: true, message: 'Tất cả bảng đã tồn tại!' });
  }

  return NextResponse.json({
    success: false,
    missing,
    message: `Thiếu ${missing.length} bảng. Copy SQL bên dưới → paste vào Supabase Dashboard → SQL Editor → Run.`,
    dashboard_url: `https://supabase.com/dashboard/project/juawbhosgdnfyeaanpnv/sql`,
    sql: MIGRATION_SQL,
  });
}

const MIGRATION_SQL = `
-- =============================================
-- WEDU Platform - Tạo tất cả bảng cần thiết
-- Copy toàn bộ SQL này → Supabase SQL Editor → Run
-- =============================================

-- 1. COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  thumbnail TEXT DEFAULT '',
  instructor TEXT DEFAULT 'WEDU',
  category TEXT DEFAULT '',
  price NUMERIC DEFAULT 0,
  original_price NUMERIC,
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  enrollments_count INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  lessons_count INTEGER DEFAULT 0,
  badge TEXT,
  member_level TEXT DEFAULT 'Free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  user_phone TEXT DEFAULT '',
  course_names TEXT DEFAULT '',
  course_ids TEXT DEFAULT '',
  total NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  course_id TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  progress INTEGER DEFAULT 0,
  completed_lessons JSONB DEFAULT '[]'::jsonb,
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, course_id)
);

-- 4. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CHAPTERS
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT UNIQUE NOT NULL,
  chapters_json JSONB DEFAULT '[]'::jsonb,
  lessons_count INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_user_email ON public.orders(user_email);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_email ON public.enrollments(user_email);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course_id ON public.reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_chapters_course_id ON public.chapters(course_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON public.courses(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses(category);

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN CREATE POLICY "allow_all_courses" ON public.courses FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "allow_all_orders" ON public.orders FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "allow_all_enrollments" ON public.enrollments FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "allow_all_reviews" ON public.reviews FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "allow_all_chapters" ON public.chapters FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- SEED DATA: Khóa học mẫu
-- =============================================
INSERT INTO public.courses (id, title, description, thumbnail, instructor, category, price, original_price, rating, reviews_count, enrollments_count, duration, lessons_count, badge, member_level, is_active)
VALUES
  ('course-001', 'Public Speaking Mastery', 'Khóa học giúp bạn tự tin thuyết trình trước đám đông, từ cơ bản đến nâng cao.', '', 'WEDU', 'Communication', 1500000, 2500000, 4.8, 156, 1250, 480, 24, 'Bestseller', 'Free', true),
  ('course-002', 'Leadership & Team Building', 'Phát triển kỹ năng lãnh đạo và xây dựng đội nhóm hiệu quả.', '', 'WEDU', 'Leadership', 2000000, 3000000, 4.7, 98, 850, 600, 30, 'Hot', 'Premium', true),
  ('course-003', 'Business English Communication', 'Tiếng Anh giao tiếp trong môi trường doanh nghiệp quốc tế.', '', 'WEDU', 'Language', 1200000, 1800000, 4.9, 234, 2100, 360, 18, 'Bestseller', 'Free', true),
  ('course-004', 'Critical Thinking & Problem Solving', 'Tư duy phản biện và giải quyết vấn đề trong công việc.', '', 'WEDU', 'Soft Skills', 800000, 1200000, 4.6, 67, 520, 240, 12, NULL, 'Free', true),
  ('course-005', 'Emotional Intelligence at Work', 'Nâng cao trí tuệ cảm xúc để thành công trong sự nghiệp.', '', 'WEDU', 'Soft Skills', 1000000, 1500000, 4.5, 89, 730, 300, 15, NULL, 'Premium', true),
  ('course-006', 'Sales & Negotiation Skills', 'Kỹ năng bán hàng và đàm phán chuyên nghiệp.', '', 'WEDU', 'Business', 1800000, 2800000, 4.8, 178, 1580, 420, 21, 'Hot', 'VIP', true)
ON CONFLICT (id) DO NOTHING;

SELECT 'Migration completed successfully!' as result;
`.trim();
