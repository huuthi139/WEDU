'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCourses } from '@/contexts/CoursesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCourseAccess } from '@/contexts/CourseAccessContext';
import type { MemberLevel, AccessTier } from '@/lib/types';
import { meetsAccessTier, accessTierLabel } from '@/lib/types';
import { isEmbedUrl, normalizeBunnyEmbedUrl, normalizeChapters, type Chapter, type Lesson } from '@/lib/utils/chapters';
import { canAccessLesson, isStaff, getLessonCTALabel } from '@/lib/access-control';

const defaultChapters: Chapter[] = [];

interface Comment {
  id: string;
  name: string;
  avatar: string;
  time: string;
  text: string;
  likes: number;
  courseId: string;
  lessonId: string;
}

const COMMENTS_STORAGE_KEY = 'wedu-comments';

function getStoredComments(courseId: string, lessonId: string): Comment[] {
  if (typeof window === 'undefined') return [];
  try {
    const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_STORAGE_KEY) || '[]');
    return all.filter(c => c.courseId === courseId && c.lessonId === lessonId);
  } catch (error) {
    console.error('[LearnPage] localStorage error:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

function saveComment(comment: Comment) {
  try {
    const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_STORAGE_KEY) || '[]');
    all.unshift(comment);
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('[LearnPage] localStorage error:', error instanceof Error ? error.message : String(error));
  }
}

function getAllCourseComments(courseId: string): Comment[] {
  if (typeof window === 'undefined') return [];
  try {
    const all: Comment[] = JSON.parse(localStorage.getItem(COMMENTS_STORAGE_KEY) || '[]');
    return all.filter(c => c.courseId === courseId);
  } catch (error) {
    console.error('[LearnPage] localStorage error:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

function VideoWatermark({ email }: { email: string }) {
  const [position, setPosition] = useState({ top: 20, left: 30 });
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const randomize = useCallback(() => {
    setPosition({
      top: 10 + Math.random() * 70,   // 10%–80%
      left: 5 + Math.random() * 80,   // 5%–85%
    });
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(randomize, 9000);
    return () => clearInterval(timerRef.current);
  }, [randomize]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none', zIndex: 10 }}
    >
      <span
        style={{
          position: 'absolute',
          top: `${position.top}%`,
          left: `${position.left}%`,
          color: 'white',
          opacity: 0.15,
          fontSize: '13px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          transition: 'top 2s ease-in-out, left 2s ease-in-out',
        }}
      >
        {email}
      </span>
    </div>
  );
}

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { enrollCourse, isEnrolled, markLessonComplete, getAccessTier, getAccess } = useCourseAccess();
  const { courses, isLoading } = useCourses();
  const courseId = params.courseId as string;
  const courseAccessTier = user ? getAccessTier(courseId) : 'free' as AccessTier;
  const courseAccess = user ? getAccess(courseId) : null;

  const course = courses.find(c => c.id === courseId);

  const [chapters, setChapters] = useState<Chapter[]>(defaultChapters);
  const [currentLessonId, setCurrentLessonId] = useState<string>('');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'curriculum' | 'comments'>('curriculum');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push(`/login?redirect=/learn/${courseId}`);
    }
  }, [user, isLoading, courseId, router]);

  // Only auto-enroll for FREE courses when user visits learn page
  // Paid courses require explicit purchase via order flow
  useEffect(() => {
    if (user && courseId && course && !isEnrolled(courseId)) {
      if (course.isFree || course.price === 0) {
        enrollCourse(courseId);
      }
    }
  }, [user, courseId, course, isEnrolled, enrollCourse]);

  // Load comments when lesson changes
  useEffect(() => {
    if (courseId && currentLessonId) {
      setComments(getStoredComments(courseId, currentLessonId));
    }
  }, [courseId, currentLessonId]);

  const handleSubmitComment = () => {
    if (!user || !commentText.trim()) return;
    const newComment: Comment = {
      id: `cmt-${Date.now()}`,
      name: user.name,
      avatar: user.name.charAt(0).toUpperCase(),
      time: 'Vừa xong',
      text: commentText,
      likes: 0,
      courseId,
      lessonId: currentLessonId,
    };
    saveComment(newComment);
    setComments(prev => [newComment, ...prev]);
    setCommentText('');
  };

  const handleMarkComplete = () => {
    if (!currentLessonId) return;
    const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    markLessonComplete(courseId, currentLessonId, totalLessons);
  };

  // Load chapters from API, fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    // Try localStorage first for instant display
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`wedu-chapters-${courseId}`);
        if (saved) {
          setChapters(normalizeChapters(JSON.parse(saved)));
        }
      } catch (error) {
        console.error('[LearnPage] localStorage error:', error instanceof Error ? error.message : String(error));
      }
    }
    // Then fetch from API for latest data
    fetch(`/api/chapters/${courseId}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success && Array.isArray(data.chapters) && data.chapters.length > 0) {
          const normalized = normalizeChapters(data.chapters);
          setChapters(normalized);
          try { localStorage.setItem(`wedu-chapters-${courseId}`, JSON.stringify(normalized)); } catch (error) { console.error('[LearnPage] localStorage error:', error instanceof Error ? error.message : String(error)); }
        }
      })
      .catch((error) => {
        console.error('[LearnPage] Failed to fetch chapters:', error instanceof Error ? error.message : String(error));
      });
    return () => { cancelled = true; };
  }, [courseId]);

  // Build user profile for access checks
  const userProfile = user ? {
    id: user.id || '', email: user.email, name: user.name, phone: '',
    role: user.role as any, systemRole: (user.systemRole || 'student') as any,
    memberLevel: (user.memberLevel || 'Free') as any, avatarUrl: null,
  } : null;

  // Helper to check if a lesson is accessible
  const isLessonAccessible = (lesson: Lesson) => {
    return canAccessLesson(userProfile, courseAccess, { accessTier: lesson.accessTier });
  };

  // Select first playable lesson on load
  useEffect(() => {
    if (chapters.length > 0 && !currentLessonId) {
      for (const ch of chapters) {
        for (const ls of ch.lessons) {
          if (ls.directPlayUrl && (ls.accessTier === 'free' || meetsAccessTier(courseAccessTier, ls.accessTier))) {
            setCurrentLessonId(ls.id);
            setExpandedChapters(new Set([ch.id]));
            return;
          }
        }
      }
      // fallback: select first lesson
      if (chapters[0]?.lessons[0]) {
        setCurrentLessonId(chapters[0].lessons[0].id);
        setExpandedChapters(new Set([chapters[0].id]));
      }
    }
  }, [chapters, currentLessonId, courseAccessTier]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 text-teal animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Đang tải khóa học...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect is happening)
  if (!user && !isLoading) return null;

  if (!course) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Không tìm thấy khóa học</p>
          <Link href="/courses" className="text-teal hover:underline">Quay lại</Link>
        </div>
      </div>
    );
  }

  // Find current lesson data
  let currentLesson: Lesson | null = null;
  let currentChapter: Chapter | null = null;
  let globalIndex = 0;
  let currentGlobalIndex = 0;
  for (const ch of chapters) {
    for (const ls of ch.lessons) {
      globalIndex++;
      if (ls.id === currentLessonId) {
        currentLesson = ls;
        currentChapter = ch;
        currentGlobalIndex = globalIndex;
      }
    }
  }

  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);

  // userProfile is defined above in the isLessonAccessible helper

  const selectLesson = (lesson: Lesson, chapter: Chapter) => {
    const isLocked = !isLessonAccessible(lesson);
    if (isLocked) return;
    setCurrentLessonId(lesson.id);
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.add(chapter.id);
      return next;
    });
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  // Navigate to next/prev lesson
  const allLessons = chapters.flatMap(ch => ch.lessons.map(ls => ({ ...ls, chapterId: ch.id })));
  const currentIdx = allLessons.findIndex(ls => ls.id === currentLessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const goToLesson = (ls: typeof allLessons[0] | null) => {
    if (!ls) return;
    if (!isLessonAccessible(ls)) return;
    setCurrentLessonId(ls.id);
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.add(ls.chapterId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-dark border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <Link href={`/courses/${courseId}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm hidden sm:inline">Quay lại</span>
            </Link>
            <div className="h-6 w-px bg-white/10 hidden sm:block" />
            <Link href="/" className="text-teal font-black text-lg tracking-wider hidden sm:block">
              WEDU
            </Link>
          </div>

          <h1 className="text-white text-sm font-semibold truncate max-w-[300px] md:max-w-[500px]">
            {course.title}
          </h1>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{user.name.charAt(0)}</span>
                </div>
                <div className="hidden md:block">
                  <p className="text-white text-xs font-medium">{user.name}</p>
                  <span className={`text-[10px] font-bold ${
                    courseAccessTier === 'vip' ? 'text-gold' : courseAccessTier === 'premium' ? 'text-teal' : 'text-gray-400'
                  }`}>
                    {accessTierLabel(courseAccessTier)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Area */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? '' : ''}`}>
          {/* Video Player */}
          <div className="relative bg-dark">
            <div className="relative aspect-video w-full max-h-[calc(100vh-280px)]">
              {currentLesson && !isLessonAccessible(currentLesson) ? (
                /* Access denied overlay */
                <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                  <div className="text-center p-8">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-white text-lg font-bold mb-2">
                      {currentLesson.accessTier === 'vip' ? 'Nội dung VIP / Coaching' : 'Nội dung Premium'}
                    </p>
                    <p className="text-gray-400 text-sm mb-4">
                      {getLessonCTALabel(currentLesson.accessTier)}
                    </p>
                    <Link
                      href={`/checkout?course=${courseId}`}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-teal text-white rounded-lg font-bold hover:bg-teal/80 transition-colors"
                    >
                      {currentLesson.accessTier === 'vip' ? 'Nâng cấp VIP' : 'Mua khóa học'}
                    </Link>
                  </div>
                </div>
              ) : currentLesson?.directPlayUrl ? (
                isEmbedUrl(currentLesson.directPlayUrl) ? (
                  <iframe
                    key={currentLesson.directPlayUrl}
                    src={normalizeBunnyEmbedUrl(currentLesson.directPlayUrl)}
                    className="w-full h-full"
                    style={{ border: 'none' }}
                    loading="lazy"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={currentLesson.directPlayUrl}
                    src={currentLesson.directPlayUrl}
                    controls
                    autoPlay
                    className="w-full h-full bg-dark"
                    controlsList="nodownload"
                    playsInline
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500 text-sm">Video chưa được tải lên</p>
                  </div>
                </div>
              )}
              {user?.email && <VideoWatermark email={user.email} />}
            </div>
          </div>

          {/* Lesson Info + Controls */}
          <div className="px-4 md:px-6 py-4 border-b border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-white text-lg md:text-xl font-bold mb-2">
                  {currentLesson?.title || 'Chọn bài học'}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {currentChapter && (
                    <span className="text-gray-500">{currentChapter.title}</span>
                  )}
                  {currentLesson?.duration && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {currentLesson.duration}
                    </span>
                  )}
                  {currentLesson && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      currentLesson.accessTier === 'vip'
                        ? 'bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30'
                        : currentLesson.accessTier === 'premium'
                          ? 'bg-teal/10 text-teal border border-teal/20'
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}>
                      {currentLesson.accessTier === 'free' ? 'FREE' : accessTierLabel(currentLesson.accessTier)}
                    </span>
                  )}
                  <span className="text-gray-500">Bài {currentGlobalIndex}/{totalLessons}</span>
                </div>
              </div>

              {/* Prev/Next buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => goToLesson(prevLesson ?? null)}
                  disabled={!prevLesson || (prevLesson && !isLessonAccessible(prevLesson))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Bài trước"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => goToLesson(nextLesson ?? null)}
                  disabled={!nextLesson || (nextLesson && !isLessonAccessible(nextLesson))}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Bài tiếp theo"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {/* Toggle sidebar on mobile */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors lg:hidden"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs: Danh mục / Bình luận */}
          <div className="px-4 md:px-6 border-b border-white/10">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('curriculum')}
                className={`py-3 text-sm font-semibold relative transition-colors ${
                  activeTab === 'curriculum' ? 'text-teal' : 'text-gray-400 hover:text-white'
                }`}
              >
                Danh mục
                {activeTab === 'curriculum' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal" />}
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`py-3 text-sm font-semibold relative transition-colors ${
                  activeTab === 'comments' ? 'text-teal' : 'text-gray-400 hover:text-white'
                }`}
              >
                Bình luận ({comments.length})
                {activeTab === 'comments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal" />}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
            {activeTab === 'curriculum' && (
              <div className="space-y-3 lg:hidden">
                {/* Show curriculum on mobile (desktop has sidebar) */}
                {chapters.map(chapter => {
                  const isExpanded = expandedChapters.has(chapter.id);
                  return (
                    <div key={chapter.id} className="border border-white/10 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleChapter(chapter.id)}
                        className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <span className="text-white text-sm font-semibold text-left">{chapter.title}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-white/5">
                          {chapter.lessons.map((lesson, i) => {
                            const isLocked = !isLessonAccessible(lesson);
                            const isActive = lesson.id === currentLessonId;
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => selectLesson(lesson, chapter)}
                                disabled={isLocked}
                                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                                  isActive ? 'bg-teal/10 border-l-2 border-teal' : 'hover:bg-white/5'
                                } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                  isActive ? 'bg-teal text-white' : 'bg-white/10 text-gray-400'
                                }`}>
                                  {isLocked ? (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  ) : (i + 1)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm truncate ${isActive ? 'text-teal font-semibold' : 'text-white'}`}>{lesson.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500">{lesson.duration}</span>
                                    <LevelBadgeSmall level={lesson.requiredLevel} accessTier={lesson.accessTier} />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="hidden lg:block">
                <p className="text-gray-500 text-sm">Danh sách bài học hiển thị ở sidebar bên phải.</p>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4 max-w-2xl">
                {/* Comment Input */}
                {user ? (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-teal rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{user.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Viết bình luận..."
                        rows={2}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal transition-colors resize-none"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={handleMarkComplete}
                          className="px-4 py-2 bg-gold/20 text-gold text-sm font-bold rounded-lg hover:bg-gold/30 transition-colors"
                        >
                          Đánh dấu hoàn thành
                        </button>
                        <button
                          disabled={!commentText.trim()}
                          onClick={handleSubmitComment}
                          className="px-4 py-2 bg-teal text-white text-sm font-bold rounded-lg hover:bg-teal/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Gửi bình luận
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm mb-2">Đăng nhập để bình luận</p>
                    <Link href="/login" className="text-teal text-sm font-semibold hover:underline">Đăng nhập</Link>
                  </div>
                )}

                {/* Comments List */}
                <div className="space-y-4 mt-6">
                  {comments.length > 0 ? comments.map(comment => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{comment.avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-sm font-semibold">{comment.name}</span>
                          <span className="text-gray-500 text-xs">{comment.time}</span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{comment.text}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button className="flex items-center gap-1 text-gray-500 hover:text-teal text-xs transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            {comment.likes}
                          </button>
                          <button className="text-gray-500 hover:text-white text-xs transition-colors">
                            Trả lời
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-6">
                      <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-gray-500 text-sm">Chưa có bình luận nào</p>
                      <p className="text-gray-600 text-xs mt-1">Hãy là người đầu tiên bình luận!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Lesson List */}
        <aside className={`${
          sidebarOpen ? 'w-80 xl:w-96' : 'w-0'
        } flex-shrink-0 border-l border-white/10 bg-[#111] hidden lg:flex flex-col overflow-hidden transition-all duration-300`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <h3 className="text-white font-bold text-sm mb-1">Nội dung khóa học</h3>
            <p className="text-gray-500 text-xs">{totalLessons} bài học</p>
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto">
            {chapters.map((chapter, chapterIdx) => {
              const isExpanded = expandedChapters.has(chapter.id);
              let lessonOffset = 0;
              for (let i = 0; i < chapterIdx; i++) {
                lessonOffset += chapters[i].lessons.length;
              }

              return (
                <div key={chapter.id}>
                  {/* Chapter Header */}
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border-b border-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <svg className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-white text-xs font-semibold truncate">{chapter.title}</span>
                    </div>
                    <span className="text-gray-500 text-xs flex-shrink-0 ml-2">{chapter.lessons.length} bài</span>
                  </button>

                  {/* Lessons */}
                  {isExpanded && chapter.lessons.map((lesson, lessonIdx) => {
                    const isActive = lesson.id === currentLessonId;
                    const isLocked = !isLessonAccessible(lesson);
                    const lessonNum = lessonOffset + lessonIdx + 1;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => selectLesson(lesson, chapter)}
                        disabled={isLocked}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 ${
                          isActive
                            ? 'bg-teal/10 border-l-2 border-l-red'
                            : 'hover:bg-white/5'
                        } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {/* Lesson Number / Play indicator */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isActive
                            ? 'bg-teal text-white'
                            : isLocked
                              ? 'bg-white/5 text-gray-600'
                              : lesson.directPlayUrl
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-white/5 text-gray-500'
                        }`}>
                          {isLocked ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : isActive ? (
                            <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          ) : (
                            String(lessonNum).padStart(2, '0')
                          )}
                        </div>

                        {/* Lesson Info */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate ${isActive ? 'text-teal font-semibold' : 'text-white'}`}>
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{lesson.duration}</span>
                            <LevelBadgeSmall level={lesson.requiredLevel} accessTier={lesson.accessTier} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-dark/60" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute right-0 top-0 bottom-0 w-80 bg-[#111] border-l border-white/10 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-white font-bold text-sm">Nội dung khóa học</h3>
                  <p className="text-gray-500 text-xs">{totalLessons} bài học</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chapters.map((chapter, chapterIdx) => {
                  const isExpanded = expandedChapters.has(chapter.id);
                  let lessonOffset = 0;
                  for (let i = 0; i < chapterIdx; i++) {
                    lessonOffset += chapters[i].lessons.length;
                  }
                  return (
                    <div key={chapter.id}>
                      <button
                        onClick={() => toggleChapter(chapter.id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] border-b border-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-white text-xs font-semibold truncate">{chapter.title}</span>
                        </div>
                        <span className="text-gray-500 text-xs flex-shrink-0 ml-2">{chapter.lessons.length} bài</span>
                      </button>
                      {isExpanded && chapter.lessons.map((lesson, lessonIdx) => {
                        const isActive = lesson.id === currentLessonId;
                        const isLocked = !isLessonAccessible(lesson);
                        const lessonNum = lessonOffset + lessonIdx + 1;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => { selectLesson(lesson, chapter); setSidebarOpen(false); }}
                            disabled={isLocked}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 ${
                              isActive ? 'bg-teal/10 border-l-2 border-l-red' : 'hover:bg-white/5'
                            } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              isActive ? 'bg-teal text-white' : isLocked ? 'bg-white/5 text-gray-600' : lesson.directPlayUrl ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-gray-500'
                            }`}>
                              {isLocked ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              ) : isActive ? (
                                <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              ) : String(lessonNum).padStart(2, '0')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm truncate ${isActive ? 'text-teal font-semibold' : 'text-white'}`}>{lesson.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">{lesson.duration}</span>
                                <LevelBadgeSmall level={lesson.requiredLevel} accessTier={lesson.accessTier} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function LevelBadgeSmall({ level, accessTier }: { level?: MemberLevel; accessTier?: AccessTier }) {
  // Prefer accessTier if available
  const tier = accessTier || (level === 'VIP' ? 'vip' : level === 'Premium' ? 'premium' : 'free');
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
      tier === 'vip'
        ? 'bg-gold/10 text-gold'
        : tier === 'premium'
          ? 'bg-teal/10 text-teal'
          : 'bg-green-500/10 text-green-400'
    }`}>
      {tier === 'free' ? 'FREE' : accessTierLabel(tier)}
    </span>
  );
}
