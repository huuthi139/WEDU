'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { CourseCard } from '@/components/ui/CourseCard';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCourses } from '@/contexts/CoursesContext';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

const BannerCarousel = dynamic(
  () => import('@/components/ui/BannerCarousel').then(m => ({ default: m.BannerCarousel })),
  { loading: () => <div className="h-[400px] md:h-[500px] rounded-2xl bg-white/[0.03] animate-pulse" /> }
);

import { useMemo } from 'react';

export default function Home() {
  const { courses, isLoading } = useCourses();
  const featuredCourses = useMemo(() => courses.slice(0, 6), [courses]);

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden aurora">
        {/* Aurora background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple/15 rounded-full blur-[100px] animate-glow-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-teal/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] bg-gold/6 rounded-full blur-[80px]" />
        </div>

        <div className="container mx-auto px-4 pt-12 pb-20 md:pt-20 md:pb-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-teal/30 bg-teal/5 mb-8">
              <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
              <span className="text-xs text-teal uppercase tracking-[2px] font-semibold">Wepower Edu App</span>
            </div>

            {/* Main Heading */}
            <h1 className="font-serif italic text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-white">Kinh nghiệm thực chiến</span>
              <br />
              <span className="text-gradient">Kiến thức chuyên sâu</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Nền tảng chia sẻ kiến thức và kinh nghiệm về kinh doanh, marketing, digital product.
            </p>

            {/* CTA Buttons - Pill style */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/courses">
                <Button variant="primary" size="xl">
                  Bắt đầu học ngay
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" size="xl">
                  Xem bảng giá
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 md:gap-8 pt-10 border-t border-white/[0.06]">
              {[
                { value: '30', label: 'Khóa học' },
                { value: '1,000+', label: 'Học viên' },
                { value: '20+', label: 'Năm kinh nghiệm' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-gold mb-1">{stat.value}</div>
                  <div className="text-xs md:text-sm text-gray-500 uppercase tracking-[1.5px]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Banner Carousel */}
      <section className="container mx-auto px-4 pb-16">
        <BannerCarousel />
      </section>

      {/* Featured Courses */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-teal text-xs font-semibold uppercase tracking-[2px] mb-2">Nổi bật</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Khóa học được yêu thích nhất
              </h2>
            </div>
            <Link href="/courses" className="hidden sm:block">
              <Button variant="ghost">
                Xem tất cả →
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
            ) : (
              featuredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/courses">
              <Button variant="ghost">
                Xem tất cả khóa học →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-64 h-64 bg-purple/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 right-0 w-64 h-64 bg-teal/5 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <p className="text-gold text-xs font-semibold uppercase tracking-[2px] mb-2">Ưu điểm</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Tại sao chọn <span className="text-teal">WEPOWER</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Nền tảng chia sẻ kiến thức và kinh nghiệm thực chiến
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="glass-card rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-teal/10 border border-teal/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-teal/20 transition-colors">
                <svg className="w-7 h-7 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Video chất lượng cao</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Trải nghiệm học tập tối ưu với video 4K, tốc độ tải nhanh trên mọi thiết bị.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
                <svg className="w-7 h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Chứng chỉ uy tín</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Nhận chứng chỉ được công nhận sau khi hoàn thành khóa học từ Wepower Edu App.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card rounded-2xl p-8 group">
              <div className="w-14 h-14 bg-purple/10 border border-purple/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple/20 transition-colors">
                <svg className="w-7 h-7 text-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Học mọi lúc mọi nơi</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Truy cập khóa học 24/7 trên mọi thiết bị. Học lúc nào cũng được, ở đâu cũng tiện.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-teal/10 via-purple/5 to-gold/10 border border-teal/20 rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/10 rounded-full blur-[80px]" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Sẵn sàng bắt đầu?
              </h2>
              <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">
                Tham gia cùng hàng ngàn học viên đã thay đổi sự nghiệp của họ với Wepower Edu App
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button variant="primary" size="lg">
                    Đăng ký miễn phí
                  </Button>
                </Link>
                <Link href="/courses">
                  <Button variant="ghost" size="lg">
                    Xem khóa học →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
