-- =============================================
-- WEDU Platform - Seed Data
-- Run after migrations to populate initial data
-- =============================================

-- =============================================
-- 1. SEED ADMIN USER
-- =============================================
INSERT INTO public.users (email, name, phone, password_hash, role, member_level, created_at, updated_at)
VALUES (
  'admin@wedu.vn',
  'Admin WEDU',
  '',
  -- bcrypt hash of 'Admin139@'
  '$2a$10$YourHashHere',
  'admin',
  'VIP',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- 2. SEED COURSES (from fallback data)
-- =============================================
INSERT INTO public.courses (id, title, description, thumbnail, instructor, category, price, original_price, rating, reviews_count, enrollments_count, duration, lessons_count, badge, member_level, is_active, is_published)
VALUES
  ('1', 'Thiết kế website với Wordpress', 'Từ con số 0 đến website chuyên nghiệp chỉ trong 30 ngày!', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop', 'WEDU Academy', 'Web Dev', 1868000, 1868000, 4.8, 0, 0, 0, 14, 'BESTSELLER', 'Free', true, true),
  ('2', 'Khởi nghiệp kiếm tiền online với AI', 'Khám phá cách tận dụng sức mạnh AI để xây dựng nguồn thu nhập thụ động!', 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop', 'WEDU Academy', 'AI', 1868000, 3868000, 4.9, 0, 0, 0, 0, 'BESTSELLER', 'Free', true, true),
  ('3', 'Xây dựng hệ thống Automation với N8N', 'Tự động hóa mọi quy trình kinh doanh - tiết kiệm 80% thời gian!', 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=800&h=450&fit=crop', 'WEDU Academy', 'Automation', 1868000, 3868000, 4.7, 0, 0, 0, 0, 'NEW', 'Free', true, true),
  ('4', 'Thiết kế hệ thống chatbot AI', 'Xây dựng chatbot AI thông minh - phục vụ khách hàng 24/7 không cần nhân viên!', 'https://images.unsplash.com/photo-1531746790095-e5cb157f3086?w=800&h=450&fit=crop', 'WEDU Academy', 'AI', 1868000, 3868000, 4.8, 0, 0, 0, 0, NULL, 'Free', true, true),
  ('5', 'Xây dựng hệ thống thu hút 1000 khách hàng tự động', 'Hệ thống marketing tự động giúp bạn có 1000 khách hàng tiềm năng mỗi tháng!', 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&h=450&fit=crop', 'WEDU Academy', 'Marketing', 3868000, 6868000, 4.9, 0, 0, 0, 0, 'BESTSELLER', 'Free', true, true),
  ('6', 'Khởi nghiệp kiếm tiền với Youtube', 'Biến Youtube thành cỗ máy in tiền - từ 0 đến 100K subscribers!', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&h=450&fit=crop', 'WEDU Academy', 'Marketing', 58868000, 58868000, 4.6, 0, 150, 25585, 123, NULL, 'Free', true, true),
  ('7', 'Vibe Code - Tạo ứng dụng với AI', 'Không biết code vẫn tạo được app!', 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=450&fit=crop', 'WEDU Academy', 'AI', 3868000, 8868000, 4.7, 0, 0, 0, 0, 'NEW', 'Free', true, true),
  ('8', 'Map To Success - Bản Đồ Đến Thành Công', 'Bản đồ chiến lược dành cho người muốn thành công trong kinh doanh online!', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=450&fit=crop', 'WEDU Academy', 'Business', 38868000, 68000000, 4.9, 0, 0, 0, 0, 'PREMIUM', 'Premium', true, true),
  ('9', 'Business Automation Mystery', 'Bí mật tự động hóa kinh doanh triệu đô - dành riêng cho CEO và founders!', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=450&fit=crop', 'WEDU Academy', 'Business', 300000000, 300000000, 5, 0, 0, 0, 0, 'PREMIUM', 'VIP', true, true),
  ('10', 'Bản Đồ Kinh Doanh Triệu Đô', 'Lộ trình chi tiết từ 0 đến doanh thu 1 triệu USD!', 'https://images.unsplash.com/photo-1553729459-afe8f2e2882d?w=800&h=450&fit=crop', 'WEDU Academy', 'Business', 68868000, 99000000, 4.9, 0, 0, 0, 0, 'PREMIUM', 'VIP', true, true),
  ('11', 'Business Internet System', 'Xây dựng hệ thống kinh doanh internet bài bản từ A đến Z!', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop', 'WEDU Academy', 'Business', 68680000, 68680000, 4.8, 0, 0, 0, 0, NULL, 'Premium', true, true),
  ('12', 'Wellness To Wealth', 'Biến đam mê sức khỏe thành nguồn thu nhập bền vững!', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop', 'WEDU Academy', 'Lifestyle', 68680000, 68680000, 4.7, 0, 0, 0, 0, NULL, 'Premium', true, true),
  ('13', 'Unlock Your Power', 'Khai phá tiềm năng vô hạn bên trong bạn!', 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop', 'WEDU Academy', 'Lifestyle', 1868000, 3500000, 4.8, 0, 0, 0, 0, 'NEW', 'Free', true, true),
  ('14', 'Design With AI', 'Thiết kế đồ họa chuyên nghiệp với AI - nhanh gấp 10 lần!', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop', 'WEDU Academy', 'AI', 1868000, 3868000, 4.6, 0, 0, 0, 0, NULL, 'Free', true, true),
  ('15', 'Master Video AI', 'Tạo video chuyên nghiệp bằng AI - không cần quay phim, không cần studio!', 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=450&fit=crop', 'WEDU Academy', 'AI', 3868000, 6868000, 4.7, 0, 0, 0, 0, 'NEW', 'Free', true, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  thumbnail = EXCLUDED.thumbnail,
  instructor = EXCLUDED.instructor,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  rating = EXCLUDED.rating,
  badge = EXCLUDED.badge,
  member_level = EXCLUDED.member_level,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT 'Seed data inserted successfully!' as result;
