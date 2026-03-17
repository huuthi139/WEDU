/**
 * Fallback data for when external APIs (Google Sheets, Google Apps Script, Firebase)
 * are unreachable due to network restrictions.
 */
import type { Course } from './mockData';

export const FALLBACK_COURSES: Course[] = [
  {
    id: '1',
    title: 'Thiết kế website với Wordpress',
    description: 'Từ con số 0 đến website chuyên nghiệp chỉ trong 30 ngày! Khóa học giúp bạn tự tay xây dựng website bán hàng, landing page, blog cá nhân mà KHÔNG cần biết code.',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 1868000,
    originalPrice: 1868000,
    rating: 4.8,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 14,
    isFree: false,
    badge: 'BESTSELLER',
    category: 'Web Dev',
    memberLevel: 'Free',
  },
  {
    id: '2',
    title: 'Khởi nghiệp kiếm tiền online với AI',
    description: 'Khám phá cách tận dụng sức mạnh AI để xây dựng nguồn thu nhập thụ động!',
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 1868000,
    originalPrice: 3868000,
    rating: 4.9,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'BESTSELLER',
    category: 'AI',
    memberLevel: 'Free',
  },
  {
    id: '3',
    title: 'Xây dựng hệ thống Automation với N8N',
    description: 'Tự động hóa mọi quy trình kinh doanh - tiết kiệm 80% thời gian!',
    thumbnail: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 1868000,
    originalPrice: 3868000,
    rating: 4.7,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'NEW',
    category: 'Automation',
    memberLevel: 'Free',
  },
  {
    id: '4',
    title: 'Thiết kế hệ thống chatbot AI',
    description: 'Xây dựng chatbot AI thông minh - phục vụ khách hàng 24/7 không cần nhân viên!',
    thumbnail: 'https://images.unsplash.com/photo-1531746790095-e5cb157f3086?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 1868000,
    originalPrice: 3868000,
    rating: 4.8,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    category: 'AI',
    memberLevel: 'Free',
  },
  {
    id: '5',
    title: 'Xây dựng hệ thống thu hút 1000 khách hàng tự động',
    description: 'Hệ thống marketing tự động giúp bạn có 1000 khách hàng tiềm năng mỗi tháng!',
    thumbnail: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 3868000,
    originalPrice: 6868000,
    rating: 4.9,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'BESTSELLER',
    category: 'Marketing',
    memberLevel: 'Free',
  },
  {
    id: '6',
    title: 'Khởi nghiệp kiếm tiền với Youtube',
    description: 'Biến Youtube thành cỗ máy in tiền - từ 0 đến 100K subscribers!',
    thumbnail: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 58868000,
    originalPrice: 58868000,
    rating: 4.6,
    reviewsCount: 0,
    enrollmentsCount: 150,
    duration: 25585,
    lessonsCount: 123,
    isFree: false,
    category: 'Marketing',
    memberLevel: 'Free',
  },
  {
    id: '7',
    title: 'Vibe Code - Tạo ứng dụng với AI',
    description: 'Không biết code vẫn tạo được app! Khóa học hướng dẫn bạn sử dụng AI để xây dựng ứng dụng web và mobile từ A-Z.',
    thumbnail: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 3868000,
    originalPrice: 8868000,
    rating: 4.7,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'NEW',
    category: 'AI',
    memberLevel: 'Free',
  },
  {
    id: '8',
    title: 'Map To Success - Bản Đồ Đến Thành Công',
    description: 'Bản đồ chiến lược dành cho người muốn thành công trong kinh doanh online!',
    thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 38868000,
    originalPrice: 68000000,
    rating: 4.9,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'PREMIUM',
    category: 'Business',
    memberLevel: 'Premium',
  },
  {
    id: '9',
    title: 'Business Automation Mystery',
    description: 'Bí mật tự động hóa kinh doanh triệu đô - dành riêng cho CEO và founders!',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 300000000,
    originalPrice: 300000000,
    rating: 5,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'PREMIUM',
    category: 'Business',
    memberLevel: 'VIP',
  },
  {
    id: '10',
    title: 'Bản Đồ Kinh Doanh Triệu Đô',
    description: 'Lộ trình chi tiết từ 0 đến doanh thu 1 triệu USD!',
    thumbnail: 'https://images.unsplash.com/photo-1553729459-afe8f2e2882d?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 68868000,
    originalPrice: 99000000,
    rating: 4.9,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'PREMIUM',
    category: 'Business',
    memberLevel: 'VIP',
  },
  {
    id: '11',
    title: 'Business Internet System',
    description: 'Xây dựng hệ thống kinh doanh internet bài bản từ A đến Z!',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 68680000,
    originalPrice: 68680000,
    rating: 4.8,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    category: 'Business',
    memberLevel: 'Premium',
  },
  {
    id: '12',
    title: 'Wellness To Wealth',
    description: 'Biến đam mê sức khỏe thành nguồn thu nhập bền vững!',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 68680000,
    originalPrice: 68680000,
    rating: 4.7,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    category: 'Lifestyle',
    memberLevel: 'Premium',
  },
  {
    id: '13',
    title: 'Unlock Your Power',
    description: 'Khai phá tiềm năng vô hạn bên trong bạn!',
    thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 1868000,
    originalPrice: 3500000,
    rating: 4.8,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'NEW',
    category: 'Lifestyle',
    memberLevel: 'Free',
  },
  {
    id: '14',
    title: 'Design With AI',
    description: 'Thiết kế đồ họa chuyên nghiệp với AI - nhanh gấp 10 lần!',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 1868000,
    originalPrice: 3868000,
    rating: 4.6,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    category: 'AI',
    memberLevel: 'Free',
  },
  {
    id: '15',
    title: 'Master Video AI',
    description: 'Tạo video chuyên nghiệp bằng AI - không cần quay phim, không cần studio!',
    thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=450&fit=crop',
    instructor: 'WEDU Academy',
    price: 3868000,
    originalPrice: 6868000,
    rating: 4.7,
    reviewsCount: 0,
    enrollmentsCount: 0,
    duration: 0,
    lessonsCount: 0,
    isFree: false,
    badge: 'NEW',
    category: 'AI',
    memberLevel: 'Free',
  },
];

/**
 * In-memory user store for when Firebase and Google Apps Script are unreachable.
 * Data persists within the same server process.
 */
export interface LocalUser {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'admin' | 'user';
  memberLevel: 'Free' | 'Premium' | 'VIP';
  createdAt: string;
}

const localUsers = new Map<string, LocalUser>();

// Embedded user data from Google Sheets - used when both Supabase and Google Sheets are unreachable
const EMBEDDED_USERS: Array<{ email: string; password: string; name: string; role: 'admin' | 'user'; memberLevel: 'Free' | 'Premium' | 'VIP' }> = [
  { email: 'admin@wedu.vn', password: 'Admin139@', name: 'Admin WEDU', role: 'admin', memberLevel: 'VIP' },
  { email: 'admin@wepower.vn', password: '123456', name: 'Admin WePower', role: 'admin', memberLevel: 'VIP' },
  { email: 'admin2@wepower.vn', password: '123456', name: 'Admin WePower', role: 'admin', memberLevel: 'VIP' },
  { email: 'lyoanhnhi@gmail.com', password: 'bambmo1712', name: 'LY OANH NHI', role: 'user', memberLevel: 'Free' },
  { email: 'boreasson@gmail.com', password: '123456', name: 'Nguyễn Đức Anh', role: 'user', memberLevel: 'Premium' },
  { email: 'tranglehip@gmail.com', password: '123456', name: 'lê thị Trang', role: 'user', memberLevel: 'Premium' },
  { email: 'dunglaocai68@gmail.com', password: '123456', name: 'Phan Văn Dũng', role: 'user', memberLevel: 'VIP' },
  { email: 'nvd009@gmail.com', password: '123456', name: 'Nguyễn Văn Dũng', role: 'user', memberLevel: 'Premium' },
  { email: 'khanhtoan37@gmail.com', password: '123456', name: 'Lê Khánh Toàn', role: 'user', memberLevel: 'Premium' },
  { email: 'huynhforai@gmail.com', password: '123456', name: 'Nguyễn Ngọc Huỳnh', role: 'user', memberLevel: 'Premium' },
  { email: 'ngoxuanchinh0611@gmail.com', password: '123456', name: 'ngo xuan chinh', role: 'user', memberLevel: 'VIP' },
  { email: 'phamthihieunhi1980@gmail.com', password: '123456', name: 'Phạm thị Hiếu Nhi', role: 'user', memberLevel: 'Premium' },
  { email: 'khanhtd.bds@gmail.com', password: '123456', name: 'Trần Đức Khánh', role: 'user', memberLevel: 'Premium' },
  { email: 'quoccuongtrieuphu@gmail.com', password: '123456', name: 'le quoc cuong', role: 'user', memberLevel: 'Premium' },
  { email: 'ndhai2308@gmail.com', password: '123456', name: 'Nguyễn Đình Hải', role: 'user', memberLevel: 'Premium' },
  { email: 'thientuan0807@gmail.com', password: '123456', name: 'Nguyễn Văn Tuấn', role: 'user', memberLevel: 'VIP' },
  { email: 'mmommo6868@gmail.com', password: '123456', name: 'Lê Đăng Khương', role: 'user', memberLevel: 'Premium' },
  { email: 'nguyenvanthangnq96@gmail.com', password: '123456', name: 'Nguyễn Văn Thắng', role: 'user', memberLevel: 'Premium' },
  { email: 'ptdung1987@gmail.com', password: '123456', name: 'Phạm Dũng', role: 'user', memberLevel: 'Premium' },
  { email: 'tranloi91vp@gmail.com', password: '123456', name: 'TRẦN LỢI', role: 'user', memberLevel: 'Premium' },
  { email: 'hhloc101@gmail.com', password: '123456', name: 'Huỳnh Hữu Lộc', role: 'user', memberLevel: 'VIP' },
  { email: 'ducchinh568@gmail.com', password: '123456', name: 'Nguyễn Đức Chinh', role: 'user', memberLevel: 'VIP' },
  { email: 'nguyenngocanh14689@gmail.com', password: '123456', name: 'Nguyễn Ngọc Anh', role: 'user', memberLevel: 'VIP' },
  { email: 'phungthanh1309@gmail.com', password: '123456', name: 'Phung Huu Thanh', role: 'user', memberLevel: 'VIP' },
  { email: 'xehoithanhvinh@gmail.com', password: '123456', name: 'Pham Đức Hải', role: 'user', memberLevel: 'Premium' },
  { email: 'lechuong1994@gmail.com', password: '123456', name: 'LÊ CHƯƠNG', role: 'user', memberLevel: 'VIP' },
  { email: 'phuonganhle785@gmail.com', password: '123456', name: 'Lê Phương Anh', role: 'user', memberLevel: 'VIP' },
  { email: 'quanuytin2704@gmail.com', password: '123456', name: 'Nguyễn Văn Quân', role: 'user', memberLevel: 'Premium' },
  { email: 'nhatly1009@gmail.com', password: '123456', name: 'Than Nhat Ly', role: 'user', memberLevel: 'Premium' },
  { email: '1hohoangphi1987@gmail.com', password: '123456', name: 'Hồ Hòang Phi', role: 'user', memberLevel: 'Premium' },
  { email: 'haclongkaka2012@gmail.com', password: '123456', name: 'Phan Trọng Hữu', role: 'user', memberLevel: 'VIP' },
  { email: 'kynguyen0405@gmail.com', password: '123456', name: 'Nguyễn Doãn Kỷ', role: 'user', memberLevel: 'Premium' },
  { email: 'daongocanh0808@gmail.com', password: '123456', name: 'ĐÀO NGỌC ANH', role: 'user', memberLevel: 'VIP' },
  { email: 'kevintuan987@gmail.com', password: '123456', name: 'Nguyễn Anh Tuấn', role: 'user', memberLevel: 'Premium' },
  { email: 'nguyen.doantung@gmail.com', password: '123456', name: 'nguyen doan tung', role: 'user', memberLevel: 'Premium' },
  { email: 'thanhle.work102@gmail.com', password: '123456', name: 'Lê Văn Thành', role: 'user', memberLevel: 'Premium' },
  { email: 'ng.xuan.tien.01@gmail.com', password: '123456', name: 'Nguyễn Xuân Tiến', role: 'user', memberLevel: 'Premium' },
  { email: 'kienmyg1998@gmail.com', password: '123456', name: 'PHẠM ĐÌNH KIÊN', role: 'user', memberLevel: 'Premium' },
  { email: 'cuchong031996@gmail.com', password: '123456', name: 'Vũ Thị Hồng Cúc', role: 'user', memberLevel: 'Premium' },
  { email: 'intruongthuan2021@gmail.com', password: '123456', name: 'Nguyễn Thuý Hằng', role: 'user', memberLevel: 'Premium' },
  { email: 'm2mhung@gmail.com', password: '123456', name: 'Ngô Thành Hưng', role: 'user', memberLevel: 'VIP' },
  { email: 'dductruong22@gmail.com', password: '123456', name: 'Đỗ Đức Trường', role: 'user', memberLevel: 'Premium' },
  { email: 'nguyenthihan12a4@gmail.com', password: '123456', name: 'Nguyễn Thị Hân', role: 'user', memberLevel: 'Premium' },
  { email: 'bentleylongnguyen@gmail.com', password: '123456', name: 'Nguyễn Đức Long', role: 'user', memberLevel: 'Premium' },
  { email: 'luuhuanvp@gmail.com', password: '123456', name: 'Lưu Hữu Huân', role: 'user', memberLevel: 'Premium' },
  { email: 'nguyenhuong144@gmail.com', password: '123456', name: 'Nguyễn Thị Hương', role: 'user', memberLevel: 'VIP' },
];

// Pre-seed all embedded users into local store
for (const u of EMBEDDED_USERS) {
  localUsers.set(u.email.toLowerCase(), {
    name: u.name,
    email: u.email.toLowerCase(),
    phone: '',
    passwordHash: u.password, // plaintext for embedded users
    role: u.role,
    memberLevel: u.memberLevel,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Look up a user from the local embedded store.
 */
export function getLocalUser(email: string): LocalUser | null {
  return localUsers.get(email.toLowerCase()) || null;
}

/**
 * Verify password against local user store (plaintext comparison for embedded users).
 */
export function verifyLocalPassword(email: string, password: string): boolean {
  const user = localUsers.get(email.toLowerCase());
  if (!user) return false;
  if (!user.passwordHash) return true; // empty hash = accept any password (demo mode)
  return user.passwordHash === password;
}

export function createLocalUser(data: {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
}): LocalUser {
  const user: LocalUser = {
    ...data,
    email: data.email.toLowerCase(),
    role: 'user',
    memberLevel: 'Free',
    createdAt: new Date().toISOString(),
  };
  localUsers.set(user.email, user);
  return user;
}

export function localUserExists(email: string): boolean {
  return localUsers.has(email.toLowerCase());
}
