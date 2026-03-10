'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useCourses } from '@/contexts/CoursesContext';
import type { MemberLevel } from '@/lib/mockData';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatPrice } from '@/lib/utils';
import { isEmbedUrl, normalizeBunnyEmbedUrl, normalizeChapters, type Chapter, type Lesson } from '@/lib/utils/chapters';

// Helper: format seconds to MM:SS
function formatSecondsToMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const initialChapters: Chapter[] = [];

function LevelBadge({ level }: { level: MemberLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
        level === 'VIP'
          ? 'bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30'
          : level === 'Premium'
            ? 'bg-teal/10 text-teal border border-teal/20'
            : 'bg-white/5 text-gray-400 border border-white/10'
      }`}
    >
      {level === 'VIP' && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {level === 'Premium' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      )}
      {level}
    </span>
  );
}

type ModalType =
  | { kind: 'none' }
  | { kind: 'addChapter' }
  | { kind: 'editChapter'; chapterId: string }
  | { kind: 'deleteChapter'; chapterId: string }
  | { kind: 'addLesson'; chapterId: string }
  | { kind: 'editLesson'; chapterId: string; lessonId: string }
  | { kind: 'deleteLesson'; chapterId: string; lessonId: string };

export default function CourseContentPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { courses } = useCourses();
  const course = courses.find((c) => c.id === id);

  const storageKey = `wepower-chapters-${id}`;
  const [chapters, setChapters] = useState<Chapter[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return normalizeChapters(JSON.parse(saved));
      } catch (error) {
        console.error('[CourseContentPage] localStorage read error:', error instanceof Error ? error.message : String(error));
      }
    }
    return initialChapters;
  });
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(['ch-1']));
  const [modal, setModal] = useState<ModalType>({ kind: 'none' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [previewVideo, setPreviewVideo] = useState<{ directPlayUrl: string; title: string } | null>(null);

  // Drag & drop state for reordering lessons
  const dragItem = useRef<{ chapterId: string; lessonIndex: number } | null>(null);
  const dragOverItem = useRef<{ chapterId: string; lessonIndex: number } | null>(null);
  const [draggingLesson, setDraggingLesson] = useState<{ chapterId: string; lessonIndex: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ chapterId: string; lessonIndex: number } | null>(null);

  // Drag & drop state for reordering chapters
  const dragChapter = useRef<number | null>(null);
  const dragOverChapter = useRef<number | null>(null);
  const [draggingChapterIndex, setDraggingChapterIndex] = useState<number | null>(null);
  const [dragOverChapterIndex, setDragOverChapterIndex] = useState<number | null>(null);

  const [apiSaving, setApiSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverSynced, setServerSynced] = useState<boolean | null>(null); // null=checking, true=synced, false=not synced
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track last saved state for change detection
  const lastSavedJson = useRef<string>('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingSave = useRef<Chapter[] | null>(null); // queue next save if one is in progress
  const serverLessonCount = useRef<number | null>(null); // track server's lesson count to prevent data loss
  const loadComplete = useRef(true); // whether the last API load was complete

  // Save to localStorage
  const persistToStorage = useCallback((data: Chapter[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('[CourseContentPage] localStorage save error:', error instanceof Error ? error.message : String(error));
    }
  }, [storageKey]);

  // Save to backend API with change detection, timeout, and pending queue
  const persistToApi = useCallback(async (data: Chapter[]) => {
    const currentJson = JSON.stringify(data);
    // Skip if nothing changed since last save
    if (currentJson === lastSavedJson.current) {
      setServerSynced(true);
      setHasUnsavedChanges(false);
      return;
    }
    // If already saving, queue this save for when current one finishes
    if (savingRef.current) {
      pendingSave.current = data;
      return;
    }
    savingRef.current = true;
    setApiSaving(true);
    setSaveError(null);
    try {
      // Client-side timeout: 90 seconds (server may process many chunks)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      // Send expectedLessons = actual count for transmission integrity check
      // (server verifies payload matches this count to catch truncation)
      const totalLessons = data.reduce((s: number, ch: Chapter) => s + ch.lessons.length, 0);
      const body: any = { chapters: data, expectedLessons: totalLessons };
      const res = await fetch(`/api/chapters/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const result = await res.json();
      if (result.success) {
        lastSavedJson.current = currentJson;
        // Update server lesson count after successful save
        serverLessonCount.current = totalLessons;
        setSaveStatus('saved');
        setServerSynced(true);
        setHasUnsavedChanges(false);
        if (result.verified && result.savedLessonsCount !== totalLessons) {
          setSaveError(`Cảnh báo: server chỉ lưu được ${result.savedLessonsCount} bài`);
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveError(result.error || 'Lưu thất bại - thử lại');
        setServerSynced(false);
      }
    } catch (err: any) {
      console.error('Failed to save chapters to API:', err);
      if (err.name === 'AbortError') {
        setSaveError('Hết thời gian chờ - nhấn Lưu để thử lại');
      } else {
        setSaveError('Lỗi kết nối - không thể lưu lên server');
      }
      setServerSynced(false);
    } finally {
      setApiSaving(false);
      // Process queued save BEFORE releasing the lock to prevent race condition
      const queued = pendingSave.current;
      if (queued) {
        pendingSave.current = null;
        // savingRef stays true - the queued save will release it
        setTimeout(() => persistToApi(queued), 500);
      } else {
        savingRef.current = false;
      }
    }
  }, [id]);

  // Debounced auto-save to API (60 seconds after last change)
  const scheduleAutoSave = useCallback((data: Chapter[]) => {
    // Don't auto-save if initial load was incomplete (prevents overwriting server data)
    if (!loadComplete.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      persistToApi(data);
    }, 60000);
  }, [persistToApi]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // Auto-save: update state + persist to localStorage + schedule API save
  const updateChapters = useCallback((newChapters: Chapter[]) => {
    setChapters(newChapters);
    persistToStorage(newChapters);
    setHasUnsavedChanges(true);
    setServerSynced(false);
    scheduleAutoSave(newChapters);
  }, [persistToStorage, scheduleAutoSave]);

  // Manual save: persist to both localStorage and API immediately
  const handleSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    persistToStorage(chapters);
    persistToApi(chapters);
  }, [persistToStorage, persistToApi, chapters]);

  // Load chapters from API on mount (sync from backend)
  useEffect(() => {
    setServerSynced(null); // checking
    fetch(`/api/chapters/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.chapters) && data.chapters.length > 0) {
          const normalized = normalizeChapters(data.chapters);
          const lessonCount = normalized.reduce((s, ch) => s + ch.lessons.length, 0);

          // Check if the load was complete (no read failures)
          if (data.complete === false) {
            // Incomplete load - warn user and disable auto-save
            loadComplete.current = false;
            setSaveError(`Cảnh báo: chỉ tải được ${data.loadedChapters}/${data.expectedChapters} chương. Tải lại trang để thử lại.`);
            // Still show what we got, but track original server count
            serverLessonCount.current = null; // unknown - don't allow saving
          } else {
            loadComplete.current = true;
            serverLessonCount.current = lessonCount;
          }

          setChapters(normalized);
          localStorage.setItem(storageKey, JSON.stringify(normalized));
          lastSavedJson.current = JSON.stringify(normalized);
          setServerSynced(data.complete !== false);
          setHasUnsavedChanges(false);
        } else {
          // Server has no data - check if we have local data
          loadComplete.current = true;
          serverLessonCount.current = 0;
          setServerSynced(chapters.length === 0);
          setHasUnsavedChanges(chapters.length > 0);
        }
      })
      .catch(() => {
        loadComplete.current = false;
        setServerSynced(false);
      });
  }, [id, storageKey]);

  // Form states
  const [chapterTitle, setChapterTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDuration, setLessonDuration] = useState('');
  const [lessonLevel, setLessonLevel] = useState<MemberLevel>('Free');
  const [lessonDirectPlayUrl, setLessonDirectPlayUrl] = useState('');
  const [lessonThumbnail, setLessonThumbnail] = useState('');
  const [durationLoading, setDurationLoading] = useState(false);

  // Auto-detect video duration when URL changes
  const handleUrlChange = useCallback((url: string) => {
    const normalized = normalizeBunnyEmbedUrl(url);
    setLessonDirectPlayUrl(normalized);
    const trimmed = normalized.trim();
    if (!trimmed) return;

    // For embed URLs, try to extract duration via Bunny API pattern
    // For direct video URLs, use hidden <video> element
    if (!isEmbedUrl(trimmed)) {
      setDurationLoading(true);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = trimmed;
      video.onloadedmetadata = () => {
        if (video.duration && isFinite(video.duration)) {
          setLessonDuration(formatSecondsToMMSS(video.duration));
        }
        setDurationLoading(false);
        video.src = '';
      };
      video.onerror = () => {
        setDurationLoading(false);
        video.src = '';
      };
    } else {
      // For embed URLs: try to fetch the embed page and extract duration
      // Bunny embed URLs contain a direct play URL we can probe
      // Pattern: extract libraryId and videoId from embed URL
      const match = trimmed.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([a-f0-9-]+)/i);
      if (match) {
        const [, libId, vidId] = match;
        // Try the Bunny CDN direct URL pattern to get metadata
        const probeUrl = `https://vz-${libId}.b-cdn.net/${vidId}/original`;
        setDurationLoading(true);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous';
        video.src = probeUrl;
        video.onloadedmetadata = () => {
          if (video.duration && isFinite(video.duration)) {
            setLessonDuration(formatSecondsToMMSS(video.duration));
          }
          setDurationLoading(false);
          video.src = '';
        };
        video.onerror = () => {
          // Probe failed - that's OK, admin can set duration manually
          setDurationLoading(false);
          video.src = '';
        };
      }
    }
  }, []);

  if (!course) {
    return (
      <div className="min-h-screen bg-dark">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 max-w-lg mx-auto">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">Khong tim thay khoa hoc</h2>
            <p className="text-gray-400 mb-6">Khoa hoc voi ID &quot;{id}&quot; khong ton tai.</p>
            <Link href="/admin">
              <Button variant="primary" size="md">Quay lai Admin</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  // ---- Chapter CRUD ----
  const openAddChapter = () => {
    setChapterTitle('');
    setModal({ kind: 'addChapter' });
  };

  const openEditChapter = (chapterId: string) => {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (chapter) {
      setChapterTitle(chapter.title);
      setModal({ kind: 'editChapter', chapterId });
    }
  };

  const openDeleteChapter = (chapterId: string) => {
    setModal({ kind: 'deleteChapter', chapterId });
  };

  const handleAddChapter = () => {
    if (!chapterTitle.trim()) return;
    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      title: chapterTitle.trim(),
      lessons: [],
    };
    updateChapters([...chapters, newChapter]);
    setModal({ kind: 'none' });
  };

  const handleEditChapter = () => {
    if (modal.kind !== 'editChapter' || !chapterTitle.trim()) return;
    updateChapters(
      chapters.map((ch) => (ch.id === modal.chapterId ? { ...ch, title: chapterTitle.trim() } : ch))
    );
    setModal({ kind: 'none' });
  };

  const handleDeleteChapter = () => {
    if (modal.kind !== 'deleteChapter') return;
    updateChapters(chapters.filter((ch) => ch.id !== modal.chapterId));
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.delete(modal.chapterId);
      return next;
    });
    setModal({ kind: 'none' });
  };

  // ---- Lesson CRUD ----
  const openAddLesson = (chapterId: string) => {
    setLessonTitle('');
    setLessonDuration('');
    setLessonLevel('Free');
    setLessonDirectPlayUrl('');
    setLessonThumbnail('');
    setModal({ kind: 'addLesson', chapterId });
  };

  const openEditLesson = (chapterId: string, lessonId: string) => {
    const chapter = chapters.find((c) => c.id === chapterId);
    const lesson = chapter?.lessons.find((l) => l.id === lessonId);
    if (lesson) {
      setLessonTitle(lesson.title);
      setLessonDuration(lesson.duration);
      setLessonLevel(lesson.requiredLevel);
      setLessonDirectPlayUrl(lesson.directPlayUrl);
      setLessonThumbnail(lesson.thumbnail || '');
      setModal({ kind: 'editLesson', chapterId, lessonId });
    }
  };

  const openDeleteLesson = (chapterId: string, lessonId: string) => {
    setModal({ kind: 'deleteLesson', chapterId, lessonId });
  };

  const handleAddLesson = () => {
    if (modal.kind !== 'addLesson' || !lessonTitle.trim()) return;
    const newLesson: Lesson = {
      id: `ls-${Date.now()}`,
      title: lessonTitle.trim(),
      duration: lessonDuration.trim(),
      requiredLevel: lessonLevel,
      directPlayUrl: lessonDirectPlayUrl.trim(),
      thumbnail: lessonThumbnail.trim(),
    };
    updateChapters(
      chapters.map((ch) =>
        ch.id === modal.chapterId ? { ...ch, lessons: [...ch.lessons, newLesson] } : ch
      )
    );
    setModal({ kind: 'none' });
  };

  const handleEditLesson = () => {
    if (modal.kind !== 'editLesson' || !lessonTitle.trim()) return;
    updateChapters(
      chapters.map((ch) =>
        ch.id === modal.chapterId
          ? {
              ...ch,
              lessons: ch.lessons.map((ls) =>
                ls.id === modal.lessonId
                  ? { ...ls, title: lessonTitle.trim(), duration: lessonDuration.trim(), requiredLevel: lessonLevel, directPlayUrl: lessonDirectPlayUrl.trim(), thumbnail: lessonThumbnail.trim() }
                  : ls
              ),
            }
          : ch
      )
    );
    setModal({ kind: 'none' });
  };

  const handleDeleteLesson = () => {
    if (modal.kind !== 'deleteLesson') return;
    updateChapters(
      chapters.map((ch) =>
        ch.id === modal.chapterId
          ? { ...ch, lessons: ch.lessons.filter((ls) => ls.id !== modal.lessonId) }
          : ch
      )
    );
    setModal({ kind: 'none' });
  };

  // ---- Drag & Drop handlers for lesson reordering ----
  const handleLessonDragStart = (chapterId: string, lessonIndex: number) => {
    dragItem.current = { chapterId, lessonIndex };
    setDraggingLesson({ chapterId, lessonIndex });
  };

  const handleLessonDragOver = (e: React.DragEvent, chapterId: string, lessonIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragItem.current) {
      dragOverItem.current = { chapterId, lessonIndex };
      setDragOverTarget({ chapterId, lessonIndex });
    }
  };

  // Allow dropping into an empty chapter
  const handleEmptyChapterDragOver = (e: React.DragEvent, chapterId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragItem.current) {
      dragOverItem.current = { chapterId, lessonIndex: 0 };
      setDragOverTarget({ chapterId, lessonIndex: 0 });
    }
  };

  const handleLessonDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragItem.current || !dragOverItem.current) return;

    const fromChapter = dragItem.current.chapterId;
    const fromIndex = dragItem.current.lessonIndex;
    const toChapter = dragOverItem.current.chapterId;
    const toIndex = dragOverItem.current.lessonIndex;

    if (fromChapter === toChapter && fromIndex === toIndex) {
      dragItem.current = null; dragOverItem.current = null;
      setDraggingLesson(null); setDragOverTarget(null);
      return;
    }

    if (fromChapter === toChapter) {
      // Same chapter reorder
      updateChapters(
        chapters.map((ch) => {
          if (ch.id !== fromChapter) return ch;
          const newLessons = [...ch.lessons];
          const [moved] = newLessons.splice(fromIndex, 1);
          newLessons.splice(toIndex, 0, moved);
          return { ...ch, lessons: newLessons };
        })
      );
    } else {
      // Cross-chapter move
      const srcChapter = chapters.find((ch) => ch.id === fromChapter);
      if (!srcChapter) return;
      const movedLesson = srcChapter.lessons[fromIndex];

      updateChapters(
        chapters.map((ch) => {
          if (ch.id === fromChapter) {
            return { ...ch, lessons: ch.lessons.filter((_, idx) => idx !== fromIndex) };
          }
          if (ch.id === toChapter) {
            const newLessons = [...ch.lessons];
            newLessons.splice(toIndex, 0, movedLesson);
            return { ...ch, lessons: newLessons };
          }
          return ch;
        })
      );
    }

    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingLesson(null);
    setDragOverTarget(null);
  };

  const handleLessonDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingLesson(null);
    setDragOverTarget(null);
  };

  // ---- Drag & Drop handlers for chapter reordering ----
  const handleChapterDragStart = (e: React.DragEvent, chapterIndex: number) => {
    dragChapter.current = chapterIndex;
    setDraggingChapterIndex(chapterIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleChapterDragOver = (e: React.DragEvent, chapterIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragChapter.current !== null) {
      dragOverChapter.current = chapterIndex;
      setDragOverChapterIndex(chapterIndex);
    }
  };

  const handleChapterDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragChapter.current === null || dragOverChapter.current === null) return;
    if (dragChapter.current === dragOverChapter.current) return;

    const fromIndex = dragChapter.current;
    const toIndex = dragOverChapter.current;

    const newChapters = [...chapters];
    const [moved] = newChapters.splice(fromIndex, 1);
    newChapters.splice(toIndex, 0, moved);
    updateChapters(newChapters);

    dragChapter.current = null;
    dragOverChapter.current = null;
    setDraggingChapterIndex(null);
    setDragOverChapterIndex(null);
  };

  const handleChapterDragEnd = () => {
    dragChapter.current = null;
    dragOverChapter.current = null;
    setDraggingChapterIndex(null);
    setDragOverChapterIndex(null);
  };

  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);

  // Helper to get names for delete confirmation
  const getChapterTitle = (chapterId: string) => chapters.find((c) => c.id === chapterId)?.title ?? '';
  const getLessonTitle = (chapterId: string, lessonId: string) =>
    chapters.find((c) => c.id === chapterId)?.lessons.find((l) => l.id === lessonId)?.title ?? '';

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Course Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{course.title}</h1>
              <p className="text-sm text-gray-400 mt-1">
                {course.instructor} &middot; {chapters.length} chương &middot; {totalLessons} bài học &middot; {formatPrice(course.price)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleSave}
                disabled={apiSaving}
                className={`inline-flex items-center gap-2 h-10 px-5 rounded-lg font-bold text-sm transition-all duration-200 ${
                  saveError
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : saveStatus === 'saved'
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : apiSaving
                        ? 'bg-teal/50 text-white/50 cursor-wait'
                        : 'bg-teal text-white hover:bg-teal/80 shadow-lg shadow-teal/20'
                }`}
              >
                {apiSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang lưu...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Đã lưu
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Lưu
                  </>
                )}
              </button>
              {saveError && (
                <p className="text-red-400 text-xs max-w-[200px] text-right">{saveError}</p>
              )}
              {!saveError && hasUnsavedChanges && !apiSaving && (
                <p className="text-yellow-400 text-xs">Tự động lưu sau 1 phút...</p>
              )}
              {serverSynced === null && (
                <p className="text-gray-500 text-xs">Đang kiểm tra server...</p>
              )}
            </div>
            <Link href="/admin?tab=courses">
              <Button variant="ghost" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Quay lại
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{chapters.length}</div>
            <p className="text-xs text-gray-400 mt-1">Chuong</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{totalLessons}</div>
            <p className="text-xs text-gray-400 mt-1">Bai hoc</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl font-bold text-gold">{course.enrollmentsCount.toLocaleString()}</div>
            <p className="text-xs text-gray-400 mt-1">Hoc vien</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-2xl font-bold text-white">{course.rating}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{course.reviewsCount} danh gia</p>
          </div>
        </div>

        {/* Add Chapter Button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Noi dung khoa hoc</h2>
          <Button variant="primary" size="sm" onClick={openAddChapter}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Them chuong moi
          </Button>
        </div>

        {/* Chapters Accordion */}
        <div className="space-y-4">
          {chapters.length === 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-gray-400">Chua co chuong nao. Nhan &quot;Them chuong moi&quot; de bat dau.</p>
            </div>
          )}

          {chapters.map((chapter, chapterIndex) => {
            const isExpanded = expandedChapters.has(chapter.id);
            const isChapterDragging = draggingChapterIndex === chapterIndex;
            const isChapterDragOver = dragOverChapterIndex === chapterIndex && draggingChapterIndex !== null && draggingChapterIndex !== chapterIndex;
            return (
              <div
                key={chapter.id}
                onDragOver={(e) => handleChapterDragOver(e, chapterIndex)}
                onDrop={handleChapterDrop}
                className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-all ${
                  isChapterDragging ? 'opacity-40 border-teal/30 bg-teal/5' : 'border-white/[0.06]'
                } ${isChapterDragOver ? 'border-t-2 !border-t-teal' : ''}`}
              >
                {/* Chapter Header */}
                <div className="flex items-center justify-between p-4 md:p-5">
                  {/* Drag Handle for Chapter */}
                  <div
                    draggable
                    onDragStart={(e) => handleChapterDragStart(e, chapterIndex)}
                    onDragEnd={handleChapterDragEnd}
                    className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors mr-2 cursor-grab active:cursor-grabbing"
                    title="Kéo để sắp xếp chương"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="5" r="1.5" />
                      <circle cx="15" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" />
                      <circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <svg
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{chapter.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {chapter.lessons.length} bai hoc
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={() => openEditChapter(chapter.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Chinh sua chuong"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openDeleteChapter(chapter.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-teal hover:bg-teal/5 transition-colors"
                      title="Xoa chuong"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Lessons List (expanded) */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06]">
                    {chapter.lessons.length === 0 && (
                      <div
                        className={`p-6 text-center transition-colors ${
                          dragOverTarget?.chapterId === chapter.id && draggingLesson ? 'bg-teal/10 border-2 border-dashed border-teal/40' : ''
                        }`}
                        onDragOver={(e) => handleEmptyChapterDragOver(e, chapter.id)}
                        onDrop={handleLessonDrop}
                      >
                        <p className="text-sm text-gray-500">
                          {draggingLesson ? 'Thả bài học vào đây' : 'Chua co bai hoc nao trong chuong nay.'}
                        </p>
                      </div>
                    )}

                    {chapter.lessons.map((lesson, lessonIndex) => {
                      const isDragging = draggingLesson?.chapterId === chapter.id && draggingLesson?.lessonIndex === lessonIndex;
                      const isDragOver = dragOverTarget?.chapterId === chapter.id && dragOverTarget?.lessonIndex === lessonIndex && draggingLesson && !(draggingLesson.chapterId === chapter.id && draggingLesson.lessonIndex === lessonIndex);
                      return (
                      <div
                        key={lesson.id}
                        draggable
                        onDragStart={() => handleLessonDragStart(chapter.id, lessonIndex)}
                        onDragOver={(e) => handleLessonDragOver(e, chapter.id, lessonIndex)}
                        onDrop={handleLessonDrop}
                        onDragEnd={handleLessonDragEnd}
                        className={`flex items-center justify-between px-4 md:px-5 py-3 transition-all ${
                          lessonIndex < chapter.lessons.length - 1 ? 'border-b border-white/[0.06]/50' : ''
                        } ${isDragging ? 'opacity-40 bg-teal/5' : 'hover:bg-white/[0.02]'} ${isDragOver ? 'border-t-2 !border-t-teal' : ''}`}
                        style={{ cursor: 'grab' }}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Drag Handle */}
                          <div className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors" title="Kéo để sắp xếp">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="5" r="1.5" />
                              <circle cx="15" cy="5" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="19" r="1.5" />
                              <circle cx="15" cy="19" r="1.5" />
                            </svg>
                          </div>
                          {lesson.thumbnail ? (
                            <button
                              onClick={() => lesson.directPlayUrl && setPreviewVideo({ directPlayUrl: lesson.directPlayUrl, title: lesson.title })}
                              className="w-10 h-7 rounded overflow-hidden flex-shrink-0 relative group"
                              title={lesson.directPlayUrl ? 'Xem trước video' : 'Thumbnail'}
                              style={{ cursor: lesson.directPlayUrl ? 'pointer' : 'default' }}
                            >
                              <img
                                src={lesson.thumbnail}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              {lesson.directPlayUrl && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          ) : lesson.directPlayUrl ? (
                            <button
                              onClick={() => setPreviewVideo({ directPlayUrl: lesson.directPlayUrl, title: lesson.title })}
                              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-green-500/10 hover:bg-green-500/25 transition-colors cursor-pointer"
                              title="Xem trước video"
                            >
                              <svg className="w-3.5 h-3.5 text-green-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                          ) : (
                            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-white/5">
                              <svg className="w-3.5 h-3.5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white truncate">{lesson.title}</div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <LevelBadge level={lesson.requiredLevel} />
                              {lesson.duration && <span className="text-xs text-gray-500">{lesson.duration}</span>}
                              {lesson.directPlayUrl ? (
                                <span className="text-xs text-green-400">Đã có video</span>
                              ) : (
                                <span className="text-xs text-gold">Chưa có video</span>
                              )}
                              {lesson.thumbnail && (
                                <span className="text-xs text-purple-400">Có thumbnail</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                          <button
                            onClick={() => openEditLesson(chapter.id, lesson.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            title="Chinh sua bai hoc"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteLesson(chapter.id, lesson.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-teal hover:bg-teal/5 transition-colors"
                            title="Xoa bai hoc"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      );
                    })}

                    {/* Add Lesson Button */}
                    <div className="p-3 border-t border-white/[0.06]">
                      <button
                        onClick={() => openAddLesson(chapter.id)}
                        className="flex items-center gap-2 text-sm text-teal hover:text-white transition-colors w-full justify-center py-2 rounded-lg hover:bg-white/5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Them bai hoc
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =============== MODALS =============== */}

      {/* Add Chapter Modal */}
      {modal.kind === 'addChapter' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModal({ kind: 'none' })} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Them chuong moi</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Tieu de chuong</label>
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Vd: Chuong 1: Gioi thieu"
                className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddChapter();
                }}
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'none' })}>
                Huy
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddChapter} disabled={!chapterTitle.trim()}>
                Them chuong
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Chapter Modal */}
      {modal.kind === 'editChapter' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModal({ kind: 'none' })} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Chinh sua chuong</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Tieu de chuong</label>
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Nhap tieu de chuong"
                className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditChapter();
                }}
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'none' })}>
                Huy
              </Button>
              <Button variant="primary" size="sm" onClick={handleEditChapter} disabled={!chapterTitle.trim()}>
                Luu thay doi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chapter Confirmation Modal */}
      {modal.kind === 'deleteChapter' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModal({ kind: 'none' })} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal/10 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xoa chuong</h3>
                <p className="text-sm text-gray-400">Hanh dong nay khong the hoan tac.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-1">
              Ban co chac chan muon xoa chuong:
            </p>
            <p className="text-sm text-white font-semibold mb-4">
              &quot;{getChapterTitle(modal.chapterId)}&quot;?
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Tat ca {chapters.find((c) => c.id === modal.chapterId)?.lessons.length ?? 0} bai hoc trong chuong nay cung se bi xoa.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'none' })}>
                Huy
              </Button>
              <button
                onClick={handleDeleteChapter}
                className="inline-flex items-center justify-center rounded-lg font-bold transition-all duration-200 h-9 px-4 text-sm bg-teal text-white hover:bg-teal/80"
              >
                Xoa chuong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {modal.kind === 'addLesson' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModal({ kind: 'none' })} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-1">Thêm bài học mới</h3>
            <p className="text-sm text-gray-400 mb-4">
              Vào chương: {getChapterTitle(modal.chapterId)}
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Tiêu đề bài học</label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="VD: Giới thiệu tổng quan"
                  className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Direct Play URL
                  </span>
                </label>
                <input
                  type="text"
                  value={lessonDirectPlayUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="Dán link video URL vào đây"
                  className="w-full h-10 px-3 bg-dark/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal transition-colors font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">Hỗ trợ: Bunny Stream embed URL hoặc direct video URL (.mp4)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Thumbnail
                  </span>
                </label>
                <input
                  type="text"
                  value={lessonThumbnail}
                  onChange={(e) => setLessonThumbnail(e.target.value)}
                  placeholder="Dán link ảnh thumbnail vào đây"
                  className="w-full h-10 px-3 bg-dark/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal transition-colors font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">URL ảnh đại diện cho video (JPG, PNG, WebP)</p>
                {lessonThumbnail.trim() && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border border-white/10 bg-dark/50" style={{ maxWidth: '200px' }}>
                    <img
                      src={lessonThumbnail.trim()}
                      alt="Thumbnail preview"
                      className="w-full aspect-video object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    Thời lượng
                    {durationLoading && (
                      <span className="text-xs text-orange-400 animate-pulse">Đang lấy...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    placeholder="Tự động hoặc VD: 10:30"
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Cấp độ</label>
                  <select
                    value={lessonLevel}
                    onChange={(e) => setLessonLevel(e.target.value as MemberLevel)}
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Free" className="bg-white/[0.03] text-white">Free</option>
                    <option value="Premium" className="bg-white/[0.03] text-white">Premium</option>
                    <option value="VIP" className="bg-white/[0.03] text-white">VIP</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'none' })}>
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddLesson}
                disabled={!lessonTitle.trim()}
              >
                Thêm bài học
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {modal.kind === 'editLesson' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModal({ kind: 'none' })} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-1">Chỉnh sửa bài học</h3>
            <p className="text-sm text-gray-400 mb-4">
              Trong chương: {getChapterTitle(modal.chapterId)}
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Tiêu đề bài học</label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Nhập tiêu đề bài học"
                  className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Direct Play URL
                  </span>
                </label>
                <input
                  type="text"
                  value={lessonDirectPlayUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="Dán link video URL vào đây"
                  className="w-full h-10 px-3 bg-dark/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal transition-colors font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">Hỗ trợ: Bunny Stream embed URL hoặc direct video URL (.mp4)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Thumbnail
                  </span>
                </label>
                <input
                  type="text"
                  value={lessonThumbnail}
                  onChange={(e) => setLessonThumbnail(e.target.value)}
                  placeholder="Dán link ảnh thumbnail vào đây"
                  className="w-full h-10 px-3 bg-dark/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-teal transition-colors font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">URL ảnh đại diện cho video (JPG, PNG, WebP)</p>
                {lessonThumbnail.trim() && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border border-white/10 bg-dark/50" style={{ maxWidth: '200px' }}>
                    <img
                      src={lessonThumbnail.trim()}
                      alt="Thumbnail preview"
                      className="w-full aspect-video object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    Thời lượng
                    {durationLoading && (
                      <span className="text-xs text-orange-400 animate-pulse">Đang lấy...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    placeholder="Tự động hoặc VD: 10:30"
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Cấp độ</label>
                  <select
                    value={lessonLevel}
                    onChange={(e) => setLessonLevel(e.target.value as MemberLevel)}
                    className="w-full h-11 px-4 bg-white/5 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Free" className="bg-white/[0.03] text-white">Free</option>
                    <option value="Premium" className="bg-white/[0.03] text-white">Premium</option>
                    <option value="VIP" className="bg-white/[0.03] text-white">VIP</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'none' })}>
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEditLesson}
                disabled={!lessonTitle.trim()}
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Lesson Confirmation Modal */}
      {modal.kind === 'deleteLesson' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setModal({ kind: 'none' })} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal/10 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xoa bai hoc</h3>
                <p className="text-sm text-gray-400">Hanh dong nay khong the hoan tac.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-1">
              Ban co chac chan muon xoa bai hoc:
            </p>
            <p className="text-sm text-white font-semibold mb-6">
              &quot;{getLessonTitle(modal.chapterId, modal.lessonId)}&quot;?
            </p>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'none' })}>
                Huy
              </Button>
              <button
                onClick={handleDeleteLesson}
                className="inline-flex items-center justify-center rounded-lg font-bold transition-all duration-200 h-9 px-4 text-sm bg-teal text-white hover:bg-teal/80"
              >
                Xoa bai hoc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm" onClick={() => setPreviewVideo(null)} />
          <div className="relative w-full max-w-3xl">
            <button
              onClick={() => setPreviewVideo(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
            >
              Đóng
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="relative aspect-video bg-dark">
                {isEmbedUrl(previewVideo.directPlayUrl) ? (
                  <iframe
                    key={previewVideo.directPlayUrl}
                    src={normalizeBunnyEmbedUrl(previewVideo.directPlayUrl)}
                    className="w-full h-full"
                    style={{ border: 'none' }}
                    loading="lazy"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={previewVideo.directPlayUrl}
                    src={previewVideo.directPlayUrl}
                    controls
                    autoPlay
                    className="w-full h-full"
                    controlsList="nodownload"
                  />
                )}
              </div>
              <div className="p-4 border-t border-white/[0.06]">
                <p className="text-white font-semibold">{previewVideo.title}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
