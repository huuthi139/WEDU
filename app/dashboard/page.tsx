'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { CourseCard } from '@/components/ui/CourseCard';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCourses } from '@/contexts/CoursesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEnrollment } from '@/contexts/EnrollmentContext';

const levelColors: Record<string, { bg: string; text: string; border: string }> = {
  Free: { bg: 'bg-white/10', text: 'text-gray-300', border: 'border-white/20' },
  Premium: { bg: 'bg-teal/10', text: 'text-teal', border: 'border-teal/30' },
  VIP: { bg: 'bg-gradient-to-r from-gold/10 to-amber-500/10', text: 'text-gold', border: 'border-gold/30' },
};

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const { enrollments, completedCoursesCount, totalHoursLearned, currentStreak } = useEnrollment();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 animate-spin text-teal mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  const { courses } = useCourses();

  if (!user) return null;

  const colors = levelColors[user.memberLevel] || levelColors.Free;

  // Get enrolled course objects with progress
  const enrolledIds = new Set(enrollments.map(e => e.courseId));
  const enrolledCourses = enrollments
    .map(enrollment => {
      const course = courses.find(c => c.id === enrollment.courseId);
      if (!course) return null;
      return { ...course, progress: enrollment.progress };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const inProgressCourses = enrolledCourses.filter(c => (c.progress ?? 0) < 100);
  const recommendedCourses = courses.filter(c => !enrolledIds.has(c.id)).slice(0, 3);

  // Calculate real weekly activity from enrollments
  const weeklyActivity = useMemo(() => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=CN, 1=T2, ...
    return days.map((day, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const dateStr = date.toISOString().split('T')[0];
      // Count completed lessons and estimate hours (0.25h per lesson)
      const lessonsOnDay = enrollments.reduce((acc, enrollment) => {
        if (enrollment.lastAccessedAt && enrollment.lastAccessedAt.startsWith(dateStr)) {
          return acc + 1;
        }
        return acc;
      }, 0);
      const hours = Math.round(lessonsOnDay * 0.25 * 10) / 10;
      return { day, hours };
    });
  }, [enrollments]);

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Chào mừng trở lại, {user.name}!
            </h1>
            <p className="text-gray-400">
              {user.role === 'admin' ? 'Quản trị viên hệ thống' : 'Tiếp tục hành trình học tập của bạn'}
            </p>
          </div>
          {/* Member Level Badge */}
          <div className={`flex items-center gap-3 ${colors.bg} border ${colors.border} rounded-xl px-5 py-3`}>
            <div className={`w-12 h-12 bg-white/10 border ${colors.border} rounded-full flex items-center justify-center`}>
              {user.memberLevel === 'VIP' ? (
                <svg className="w-6 h-6 text-gold" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ) : user.memberLevel === 'Premium' ? (
                <svg className="w-6 h-6 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {user.role === 'admin' ? 'Vai trò' : 'Hạng thành viên'}
              </p>
              <p className={`text-lg font-bold ${colors.text}`}>
                {user.role === 'admin' ? 'Admin' : user.memberLevel}
              </p>
              {user.memberLevel === 'Free' && user.role !== 'admin' && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  <Link href="/pricing" className="text-teal hover:underline">Nâng cấp Premium</Link>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Admin Quick Link */}
        {user.role === 'admin' && (
          <div className="mb-8 p-4 bg-teal/10 border border-teal/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Khu vực quản trị</p>
                <p className="text-sm text-gray-400">Quản lý khóa học, học viên và đơn hàng</p>
              </div>
            </div>
            <Link href="/admin">
              <Button variant="primary" size="sm">
                Vào Admin
              </Button>
            </Link>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Courses Enrolled */}
          <div className="bg-teal rounded-xl p-6 hover:shadow-glow-teal transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{enrollments.length}</div>
            <div className="text-white/90 text-sm">Khóa học đang học</div>
          </div>

          {/* Hours Learned */}
          <div className="bg-gold rounded-xl p-6 hover:shadow-glow-gold transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-dark/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-black mb-1">{totalHoursLearned}</div>
            <div className="text-black/90 text-sm">Giờ đã học</div>
          </div>

          {/* Certificates */}
          <Link href="/certificates" className="bg-dark border-2 border-white/10 rounded-xl p-6 hover:border-teal transition-all block">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{completedCoursesCount}</div>
            <div className="text-white/60 text-sm">Chứng chỉ đã đạt</div>
          </Link>

          {/* Current Streak */}
          <div className="bg-dark border-2 border-white/10 rounded-xl p-6 hover:border-gold transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{currentStreak}</div>
            <div className="text-white/60 text-sm">Ngày học liên tiếp</div>
          </div>
        </div>

        {/* Continue Learning */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              {inProgressCourses.length > 0 ? 'Tiếp tục học' : 'Khóa học nổi bật'}
            </h2>
            <Link href="/my-courses">
              <Button variant="ghost" size="sm">
                Xem tất cả
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(inProgressCourses.length > 0 ? inProgressCourses.slice(0, 3) : recommendedCourses).map((course) => (
              <CourseCard key={course.id} course={course} showProgress={inProgressCourses.length > 0} />
            ))}
          </div>
        </div>

        {/* Learning Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* Weekly Activity Chart */}
          <div className="bg-dark border-2 border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Hoạt động tuần này</h3>
            <div className="space-y-4">
              {weeklyActivity.map((item, index) => {
                const maxHours = Math.max(...weeklyActivity.map(w => w.hours), 1);
                const percentage = (item.hours / maxHours) * 100;
                const barColors = ['bg-teal', 'bg-gold', 'bg-white', 'bg-teal', 'bg-gold', 'bg-white', 'bg-teal'];
                return (
                  <div key={item.day}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/60">{item.day}</span>
                      <span className="text-sm text-gold font-bold">{item.hours}h</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColors[index]}`}
                        style={{ width: `${item.hours > 0 ? percentage : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="bg-dark border-2 border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Thành tích gần đây</h3>
            <div className="space-y-4">
              {enrollments.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-teal/20">
                  <div className="w-12 h-12 bg-teal rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">Bắt đầu học tập</h4>
                    <p className="text-sm text-white/60">Đã đăng ký {enrollments.length} khóa học</p>
                  </div>
                </div>
              )}

              {completedCoursesCount > 0 && (
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-gold/20">
                  <div className="w-12 h-12 bg-gold rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">Hoàn thành xuất sắc</h4>
                    <p className="text-sm text-white/60">Đã hoàn thành {completedCoursesCount} khóa học</p>
                  </div>
                </div>
              )}

              {currentStreak >= 3 && (
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-gold/20">
                  <div className="w-12 h-12 bg-gradient-to-br from-gold to-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">Học viên kiên trì</h4>
                    <p className="text-sm text-white/60">Hoàn thành {currentStreak} ngày học liên tiếp</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-white mb-1">Thành viên WEPOWER</h4>
                  <p className="text-sm text-white/60">Đăng ký thành công tài khoản</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-dark border-2 border-teal/30 rounded-xl p-8 text-center hover:border-teal hover:shadow-glow-teal transition-all">
          <h3 className="text-2xl font-bold text-white mb-4">
            Khám phá thêm khóa học mới
          </h3>
          <p className="text-white/60 mb-6 max-w-2xl mx-auto">
            Mở rộng kiến thức của bạn với {courses.length}+ khóa học chất lượng cao
          </p>
          <Link href="/courses">
            <Button variant="primary" size="lg">
              Xem khóa học
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
