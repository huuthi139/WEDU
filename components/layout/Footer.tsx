import Link from 'next/link';

export function Footer() {
  const footerLinks = {
    product: [
      { label: 'Khóa học', href: '/courses' },
      { label: 'Cộng đồng', href: '/community' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Giỏ hàng', href: '/cart' },
    ],
    company: [
      { label: 'Về chúng tôi', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Nghề nghiệp', href: '#' },
      { label: 'Liên hệ', href: '#' },
    ],
    support: [
      { label: 'Trung tâm hỗ trợ', href: '#' },
      { label: 'Câu hỏi thường gặp', href: '#' },
      { label: 'Điều khoản dịch vụ', href: '#' },
      { label: 'Chính sách bảo mật', href: '#' },
    ],
  };

  return (
    <footer className="bg-dark border-t border-white/[0.06]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-bold text-gold tracking-wider">WEPOWER</span>
            </Link>
            <p className="text-white/60 text-sm mb-4">
              Nền tảng học tập trực tuyến
            </p>

            {/* Contact Info */}
            <div className="space-y-2 mb-4">
              <a href="tel:0782222908" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>0782222908</span>
              </a>
              <a href="mailto:edu.cskh@wepower.vn" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>edu.cskh@wepower.vn</span>
              </a>
            </div>

            {/* Social Links - Kết nối với WEPOWER */}
            <p className="text-white text-sm font-semibold mb-2">Kết nối với WEPOWER</p>
            <div className="flex gap-3">
              <a href="https://facebook.com/wepower" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-teal rounded-lg flex items-center justify-center transition-colors group">
                <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="https://youtube.com/@wepower" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-teal rounded-lg flex items-center justify-center transition-colors group">
                <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://tiktok.com/@wepower" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-teal rounded-lg flex items-center justify-center transition-colors group">
                <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-bold text-white mb-4">Sản phẩm</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-bold text-white mb-4">Công ty</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-bold text-white mb-4">Hỗ trợ</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © 2026 Wepower Edu App. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-white/40">
            <a href="#" className="hover:text-white transition-colors">
              Điều khoản
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Quyền riêng tư
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
