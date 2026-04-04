'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { CourseCard } from '@/components/ui/CourseCard';
import { useCourses } from '@/contexts/CoursesContext';
import { formatPrice, formatDuration } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/providers/ToastProvider';
import { useEnrollment } from '@/contexts/EnrollmentContext';
import { useCourseAccess } from '@/contexts/CourseAccessContext';
import Image from 'next/image';

import type { MemberLevel, AccessTier } from '@/lib/types';
import { meetsAccessTier, accessTierLabel } from '@/lib/types';
import { isEmbedUrl, normalizeBunnyEmbedUrl, normalizeChapters, type Chapter, type Lesson } from '@/lib/utils/chapters';
import { canAccessLesson, isStaff, getLessonCTALabel } from '@/lib/access-control';
import { useVideoDurations, formatSecondsToMMSS, formatSecondsFull } from '@/lib/hooks/useVideoDurations';

const defaultChapters: Chapter[] = [];

interface Review {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  date: string;
  comment: string;
  courseId: string;
}

const REVIEWS_STORAGE_KEY = 'wedu-reviews';

function getStoredReviews(courseId: string): Review[] {
  if (typeof window === 'undefined') return [];
  try {
    const all: Review[] = JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY) || '[]');
    return all.filter(r => r.courseId === courseId);
  } catch (error) {
    console.error('[CourseDetail] localStorage error:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

function saveReview(review: Review) {
  try {
    const all: Review[] = JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY) || '[]');
    all.unshift(review);
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('[CourseDetail] localStorage error:', error instanceof Error ? error.message : String(error));
  }
}

export default function CourseDetail() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isEnrolled, enrollCourse } = useEnrollment();
  const { getAccessTier, getAccess } = useCourseAccess();
  const { courses, isLoading } = useCourses();
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'reviews'>('overview');
  const [expandedSections, setExpandedSections] = useState<number[]>([0]);
  const [previewLesson, setPreviewLesson] = useState<{ name: string; sectionTitle: string; directPlayUrl: string } | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>(defaultChapters);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  // Load chapters from API, fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    const cid = params.id as string;
    // Try localStorage first for instant display
    if (typeof window !== 'undefined' && cid) {
      try {
        const saved = localStorage.getItem(`wedu-chapters-${cid}`);
        if (saved) {
          setChapters(normalizeChapters(JSON.parse(saved)));
        }
      } catch (error) {
        console.error('[CourseDetail] localStorage error:', error instanceof Error ? error.message : String(error));
      }
    }
    // Then fetch from API for latest data
    if (cid) {
      fetch(`/api/chapters/${cid}`)
        .then(res => res.json())
        .then(data => {
          if (!cancelled && data.success && Array.isArray(data.chapters) && data.chapters.length > 0) {
            const normalized = normalizeChapters(data.chapters);
            setChapters(normalized);
            try {
              localStorage.setItem(`wedu-chapters-${cid}`, JSON.stringify(normalized));
            } catch (error) {
              console.error('[CourseDetail] localStorage error:', error instanceof Error ? error.message : String(error));
            }
          }
        })
        .catch((error) => {
          console.error('[CourseDetail] Failed to fetch chapters:', error instanceof Error ? error.message : String(error));
        });
    }
    return () => { cancelled = true; };
  }, [params.id]);

  // Load reviews
  useEffect(() => {
    if (params.id) {
      setReviews(getStoredReviews(params.id as string));
    }
  }, [params.id]);

  const handleSubmitReview = () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để đánh giá', 'error');
      return;
    }
    if (!newReviewComment.trim()) {
      showToast('Vui lòng nhập nội dung đánh giá', 'error');
      return;
    }
    const review: Review = {
      id: `rev-${Date.now()}`,
      name: user.name,
      avatar: user.name.charAt(0).toUpperCase(),
      rating: newReviewRating,
      date: new Date().toLocaleDateString('vi-VN'),
      comment: newReviewComment,
      courseId: params.id as string,
    };
    saveReview(review);
    setReviews(prev => [review, ...prev]);
    setNewReviewComment('');
    setNewReviewRating(5);
    showToast('Đánh giá của bạn đã được gửi!', 'success');
  };

  const course = courses.find(c => c.id === params.id);

  // Probe video durations (must be before early returns)
  const allLessonsFlat = chapters.flatMap(ch => ch.lessons);
  const videoDurations = useVideoDurations(allLessonsFlat);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark">
        <Header />
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <div className="text-center">
            <svg className="w-10 h-10 text-teal animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400">Đang tải khóa học...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-dark">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Không tìm thấy khóa học</h1>
          <p className="text-gray-400 mb-6">Khóa học bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Button variant="primary" onClick={() => router.push('/courses')}>
            Quay lại danh sách khóa học
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const handleAddToCart = () => {
    addToCart(course, () => {
      showToast('Đã thêm vào giỏ hàng!', 'success');
    });
  };

  const handleCheckout = () => {
    router.push(`/checkout?course=${course.id}`);
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const relatedCourses = courses
    .filter(c => c.category === course.category && c.id !== course.id)
    .slice(0, 3);

  const totalLessons = chapters.reduce((sum, section) => sum + section.lessons.length, 0);

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-6">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <button onClick={() => router.push('/')} className="hover:text-white transition-colors">Trang chủ</button>
          <span>/</span>
          <button onClick={() => router.push('/courses')} className="hover:text-white transition-colors">Khóa học</button>
          <span>/</span>
          <span className="text-white truncate max-w-[200px]">{course.title}</span>
        </nav>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Course Header */}
            <div className="mb-6">
              {course.badge && (
                <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold mb-3 ${
                  course.badge === 'BESTSELLER' ? 'bg-gold text-black' :
                  course.badge === 'NEW' ? 'bg-teal text-white' :
                  'bg-gold text-black'
                }`}>
                  {course.badge}
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{course.title}</h1>
              {/* Member Level Required */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold mb-4 ${
                course.memberLevel === 'VIP' ? 'bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30' :
                course.memberLevel === 'Premium' ? 'bg-teal/10 text-teal border border-teal/20' :
                'bg-white/5 text-gray-300 border border-white/10'
              }`}>
                {course.memberLevel === 'VIP' && (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
                {course.memberLevel === 'Premium' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                )}
                Yêu cầu: {course.memberLevel}
              </div>
              <p className="text-gray-400 text-lg mb-4">
                Khóa học toàn diện giúp bạn nắm vững kiến thức và kỹ năng thực tế từ cơ bản đến nâng cao.
              </p>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-bold text-white">{course.rating}</span>
                  <span className="text-gray-400">({course.reviewsCount} đánh giá)</span>
                </div>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">{course.enrollmentsCount.toLocaleString()} học viên</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">Giảng viên: <span className="text-white">{course.instructor}</span></span>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
              <Image
                src={course.thumbnail}
                alt={course.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-dark/30 flex items-center justify-center cursor-pointer" onClick={() => router.push(`/learn/${course.id}`)}>
                <div className="w-16 h-16 bg-teal rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-glow-teal">
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-white/10 mb-8">
              <div className="flex gap-8">
                {(['overview', 'curriculum', 'reviews'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-semibold transition-colors relative ${
                      activeTab === tab
                        ? 'text-teal'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'overview' ? 'Tổng quan' : tab === 'curriculum' ? 'Nội dung' : 'Đánh giá'}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-fadeIn">
                {/* What you'll learn */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Bạn sẽ học được gì?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      'Nắm vững kiến thức từ cơ bản đến nâng cao',
                      'Áp dụng vào dự án thực tế ngay lập tức',
                      'Xây dựng portfolio chuyên nghiệp',
                      'Tối ưu hóa quy trình làm việc',
                      'Phân tích và giải quyết vấn đề phức tạp',
                      'Nhận chứng chỉ hoàn thành khóa học',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                        <svg className="w-5 h-5 text-teal flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Requirements */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Yêu cầu</h2>
                  <ul className="space-y-2">
                    {[
                      'Không cần kiến thức nền tảng - phù hợp cho người mới bắt đầu',
                      'Máy tính có kết nối Internet',
                      'Tinh thần ham học hỏi và sẵn sàng thực hành',
                    ].map((req, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-2 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Description */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Mô tả khóa học</h2>
                  <div className="text-gray-400 space-y-4 leading-relaxed">
                    {course.description ? (
                      course.description.split('\n').map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))
                    ) : (
                      <>
                        <p>
                          Khóa học toàn diện được thiết kế bởi đội ngũ chuyên gia tại WEDU.
                          Với {course.lessonsCount} bài học được sắp xếp khoa học, bạn sẽ từng bước nắm vững
                          kiến thức cần thiết.
                        </p>
                        <p>
                          Sau khi hoàn thành khóa học, bạn sẽ nhận được chứng chỉ từ WEDU
                          và có thể tự tin áp dụng những gì đã học vào công việc thực tế.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400">
                    {chapters.length} phần - {totalLessons} bài học
                    {(() => {
                      const totalSec = allLessonsFlat.reduce((s, ls) => s + (videoDurations[ls.id] || 0), 0);
                      return totalSec > 0 ? ` - ${formatSecondsFull(totalSec)}` : '';
                    })()}
                  </p>
                  <button
                    onClick={() => setExpandedSections(
                      expandedSections.length === chapters.length
                        ? []
                        : chapters.map((_, i) => i)
                    )}
                    className="text-teal text-sm font-semibold hover:underline"
                  >
                    {expandedSections.length === chapters.length ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                  </button>
                </div>

                {chapters.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="border border-white/10 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(sectionIndex)}
                      className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            expandedSections.includes(sectionIndex) ? 'rotate-90' : ''
                          }`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-semibold text-white text-left">
                          Phần {sectionIndex + 1}: {section.title}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400">
                        {section.lessons.length} bài học
                        {(() => {
                          const chSec = section.lessons.reduce((s, ls) => s + (videoDurations[ls.id] || 0), 0);
                          return chSec > 0 ? ` · ${formatSecondsFull(chSec)}` : '';
                        })()}
                      </span>
                    </button>

                    {expandedSections.includes(sectionIndex) && (
                      <div className="divide-y divide-white/5">
                        {section.lessons.map((lesson, lessonIndex) => {
                          // Per-course access check
                          const courseAccess = user ? getAccess(course.id) : null;
                          const userProfile = user ? {
                            id: user.id || '', email: user.email, name: user.name, phone: '',
                            role: user.role as any, systemRole: user.systemRole || 'student' as any,
                            memberLevel: user.memberLevel as any, avatarUrl: null,
                          } : null;
                          const hasLessonAccess = canAccessLesson(userProfile, courseAccess, { accessTier: lesson.accessTier });
                          const isFreeLesson = lesson.accessTier === 'free';
                          const canPreview = isFreeLesson || hasLessonAccess;
                          const isLocked = !isFreeLesson && !hasLessonAccess;
                          return (
                            <div
                              key={lessonIndex}
                              className={`flex items-center justify-between p-4 pl-12 transition-colors ${
                                isLocked ? 'opacity-60' : 'hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {isLocked ? (
                                  <div
                                    className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 bg-white/5 text-gray-600 cursor-not-allowed"
                                    title={getLessonCTALabel(lesson.accessTier)}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setPreviewLesson({ name: lesson.title, sectionTitle: section.title, directPlayUrl: lesson.directPlayUrl })}
                                    disabled={!lesson.directPlayUrl}
                                    className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
                                      lesson.directPlayUrl
                                        ? 'bg-teal/20 hover:bg-teal/40 text-teal cursor-pointer'
                                        : 'bg-white/5 text-gray-600 cursor-not-allowed'
                                    }`}
                                    title={lesson.directPlayUrl ? (isFreeLesson ? 'Xem miễn phí' : 'Xem bài học') : 'Chưa có video'}
                                  >
                                    <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </button>
                                )}
                                <span className="text-gray-300 text-sm truncate">{lesson.title}</span>
                                {/* Access tier badge */}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                                  lesson.accessTier === 'vip'
                                    ? 'bg-gradient-to-r from-gold/10 to-amber-500/10 text-gold border border-gold/30'
                                    : lesson.accessTier === 'premium'
                                      ? 'bg-teal/10 text-teal border border-teal/20'
                                      : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                }`}>
                                  {lesson.accessTier === 'free' ? 'FREE' : accessTierLabel(lesson.accessTier)}
                                </span>
                              </div>
                              {videoDurations[lesson.id] ? (
                                <span className="text-sm text-gray-500 flex-shrink-0 ml-3">{formatSecondsToMMSS(videoDurations[lesson.id])}</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Rating Summary */}
                <div className="flex flex-col sm:flex-row gap-8 p-6 bg-white/5 rounded-xl">
                  <div className="text-center sm:min-w-[120px]">
                    <div className="text-5xl font-bold text-gold mb-1">{course.rating}</div>
                    <div className="flex items-center justify-center gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg
                          key={star}
                          className={`w-5 h-5 ${star <= Math.round(course.rating) ? 'text-gold' : 'text-gray-600'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <div className="text-sm text-gray-400">{course.reviewsCount + reviews.length} đánh giá</div>
                  </div>

                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = reviews.filter(r => r.rating === star).length;
                      const total = reviews.length || 1;
                      const percentage = reviews.length > 0
                        ? Math.round((count / total) * 100)
                        : (star === 5 ? 78 : star === 4 ? 15 : star === 3 ? 5 : star === 2 ? 1 : 1);
                      return (
                        <div key={star} className="flex items-center gap-3">
                          <span className="text-sm text-gray-400 w-12">{star} sao</span>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gold rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-400 w-10 text-right">{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Write Review */}
                <div className="p-6 bg-white/[0.03] rounded-xl border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4">Viết đánh giá</h3>
                  {user ? (
                    <div className="space-y-4">
                      {/* Star Rating Input */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Đánh giá của bạn</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() => setNewReviewRating(star)}
                              className="transition-transform hover:scale-110"
                            >
                              <svg
                                className={`w-8 h-8 ${
                                  star <= (hoverRating || newReviewRating) ? 'text-gold' : 'text-gray-600'
                                } transition-colors`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                          ))}
                          <span className="ml-3 text-sm text-gray-400">
                            {newReviewRating === 5 ? 'Xuất sắc' : newReviewRating === 4 ? 'Tốt' : newReviewRating === 3 ? 'Bình thường' : newReviewRating === 2 ? 'Kém' : 'Rất kém'}
                          </span>
                        </div>
                      </div>
                      {/* Comment */}
                      <textarea
                        value={newReviewComment}
                        onChange={(e) => setNewReviewComment(e.target.value)}
                        placeholder="Chia sẻ trải nghiệm học tập của bạn..."
                        rows={3}
                        className="w-full px-4 py-3 bg-dark border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal resize-none"
                      />
                      <div className="flex justify-end">
                        <Button variant="primary" size="sm" onClick={handleSubmitReview}>
                          Gửi đánh giá
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm mb-3">Đăng nhập để viết đánh giá</p>
                      <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>
                        Đăng nhập
                      </Button>
                    </div>
                  )}
                </div>

                {/* Individual Reviews */}
                {reviews.length > 0 ? (
                  reviews.map(review => (
                    <div key={review.id} className="p-6 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-teal rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold">{review.avatar}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-white">{review.name}</h4>
                            <span className="text-xs text-gray-500">{review.date}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mb-3">
                            {[1, 2, 3, 4, 5].map(star => (
                              <svg
                                key={star}
                                className={`w-4 h-4 ${star <= review.rating ? 'text-gold' : 'text-gray-600'}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-gray-400 text-sm leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-gray-400">Chưa có đánh giá nào</p>
                    <p className="text-gray-500 text-sm mt-1">Hãy là người đầu tiên đánh giá khóa học này!</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06]">
                {/* Price */}
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gold">{formatPrice(course.price)}</div>
                  {course.originalPrice && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 line-through text-sm">{formatPrice(course.originalPrice)}</span>
                      <span className="text-teal text-sm font-semibold">
                        -{Math.round((1 - course.price / course.originalPrice) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* CTA Buttons */}
                <Button variant="primary" size="lg" className="w-full mb-3" onClick={() => router.push(`/learn/${course.id}`)}>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  HỌC NGAY
                </Button>
                <Button variant="secondary" size="lg" className="w-full mb-3" onClick={handleCheckout}>
                  Đăng Ký Ngay
                </Button>
                <Button variant="secondary" size="lg" className="w-full" onClick={handleAddToCart}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Thêm Giỏ Hàng
                </Button>

                <p className="text-center text-gray-500 text-xs mt-3">Đảm bảo hoàn tiền trong 7 ngày</p>

                {/* Course includes */}
                <div className="mt-6 pt-6 border-t border-white/[0.06]">
                  <h4 className="font-semibold text-white mb-4">Khóa học bao gồm:</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {(() => {
                        const totalSec = allLessonsFlat.reduce((s, ls) => s + (videoDurations[ls.id] || 0), 0);
                        return totalSec > 0 ? `${formatSecondsFull(totalSec)} video bài giảng` : 'Video bài giảng';
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      {course.lessonsCount} bài học
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Tài liệu bổ trợ
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Truy cập trên mọi thiết bị
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Truy cập trọn đời
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      Chứng chỉ hoàn thành
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Courses */}
        {relatedCourses.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-white mb-6">Khóa học liên quan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedCourses.map(c => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {previewLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm" onClick={() => setPreviewLesson(null)} />
          <div className="relative w-full max-w-3xl">
            {/* Close button */}
            <button
              onClick={() => setPreviewLesson(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
            >
              Đóng
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              {/* Video Player */}
              <div className="relative aspect-video bg-dark">
                {previewLesson.directPlayUrl ? (
                  isEmbedUrl(previewLesson.directPlayUrl) ? (
                    <iframe
                      key={previewLesson.directPlayUrl}
                      src={normalizeBunnyEmbedUrl(previewLesson.directPlayUrl)}
                      className="w-full h-full"
                      style={{ border: 'none' }}
                      loading="lazy"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      key={previewLesson.directPlayUrl}
                      src={previewLesson.directPlayUrl}
                      controls
                      autoPlay
                      className="w-full h-full"
                      controlsList="nodownload"
                      playsInline
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-500 text-sm">Video chưa được tải lên</p>
                  </div>
                )}
              </div>
              {/* Lesson info */}
              <div className="p-4 border-t border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">{previewLesson.sectionTitle}</p>
                <p className="text-white font-semibold">{previewLesson.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
