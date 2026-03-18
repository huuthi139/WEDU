'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import type { AccessTier, CourseAccess } from '@/lib/types';

interface CourseAccessContextType {
  /** All course access records for the current user */
  courseAccessList: CourseAccess[];
  /** Check if user has any access (free/premium/vip) for a course */
  hasAccess: (courseId: string) => boolean;
  /** Get the access tier for a specific course */
  getAccessTier: (courseId: string) => AccessTier;
  /** Get the full access record for a course */
  getAccess: (courseId: string) => CourseAccess | null;
  /** Refresh access data from server */
  refreshAccess: () => Promise<void>;

  // Legacy compat: enrollment-like interface
  enrollments: LegacyEnrollment[];
  isEnrolled: (courseId: string) => boolean;
  getProgress: (courseId: string) => number;
  enrollCourse: (courseId: string) => void;
  markLessonComplete: (courseId: string, lessonId: string, totalLessons: number) => void;

  // Order-related (kept for checkout flow)
  orders: LegacyOrder[];
  addOrder: (order: Omit<LegacyOrder, 'id' | 'date' | 'status'>) => void;
  updateOrderStatus: (orderId: string, status: LegacyOrder['status']) => void;

  // Stats
  totalHoursLearned: number;
  completedCoursesCount: number;
  currentStreak: number;
}

export interface LegacyEnrollment {
  courseId: string;
  enrolledAt: string;
  progress: number;
  completedLessons: string[];
  lastAccessedAt: string;
}

export interface LegacyOrder {
  id: string;
  name: string;
  email: string;
  phone: string;
  courses: { id: string; title: string; price: number }[];
  total: number;
  paymentMethod: string;
  status: 'Hoàn thành' | 'Đang chờ' | 'Đang xử lý';
  date: string;
}

const CourseAccessContext = createContext<CourseAccessContextType | undefined>(undefined);

const STORAGE_KEY_ENROLLMENTS = 'wedu-enrollments';
const STORAGE_KEY_ORDERS = 'wedu-orders';
const STORAGE_KEY_STREAK = 'wedu-streak';

export function CourseAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [courseAccessList, setCourseAccessList] = useState<CourseAccess[]>([]);
  const [enrollments, setEnrollments] = useState<LegacyEnrollment[]>([]);
  const [orders, setOrders] = useState<LegacyOrder[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasSynced = useRef(false);

  // Fetch course access from server
  const refreshAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/course-access');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.accessList) {
        setCourseAccessList(data.accessList);
      }
    } catch (e) {
      console.error('[CourseAccess] Fetch failed:', e);
    }
  }, []);

  // Legacy: sync enrollments from server
  const syncFromServer = useCallback(async () => {
    try {
      // Fetch new course access
      await refreshAccess();

      // Also fetch legacy enrollments for backward compat
      const res = await fetch('/api/enrollments');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.enrollments) {
        const serverEnrollments: LegacyEnrollment[] = data.enrollments.map((e: Record<string, unknown>) => ({
          courseId: e.courseId as string,
          enrolledAt: e.enrolledAt as string,
          progress: Number(e.progress) || 0,
          completedLessons: Array.isArray(e.completedLessons) ? e.completedLessons as string[] : [],
          lastAccessedAt: e.lastAccessedAt as string,
        }));
        setEnrollments(serverEnrollments);
        localStorage.setItem(STORAGE_KEY_ENROLLMENTS, JSON.stringify(serverEnrollments));
      }
    } catch (e) {
      console.error('[CourseAccess] Sync from server failed:', e);
    }
  }, [refreshAccess]);

  // Sync from server when user logs in
  useEffect(() => {
    if (user?.email && !hasSynced.current) {
      hasSynced.current = true;
      syncFromServer();
    }
    if (!user) {
      hasSynced.current = false;
      setCourseAccessList([]);
    }
  }, [user?.email, syncFromServer]);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedEnrollments = localStorage.getItem(STORAGE_KEY_ENROLLMENTS);
      if (savedEnrollments) setEnrollments(JSON.parse(savedEnrollments));

      const savedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (savedOrders) setOrders(JSON.parse(savedOrders));
    } catch (error) {
      console.error('[CourseAccessProvider] localStorage error:', error instanceof Error ? error.message : String(error));
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY_ENROLLMENTS, JSON.stringify(enrollments));
    }
  }, [enrollments, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    }
  }, [orders, isLoaded]);

  // Course access helpers
  const hasAccess = useCallback((courseId: string) => {
    return courseAccessList.some(ca => ca.courseId === courseId && ca.status === 'active');
  }, [courseAccessList]);

  const getAccessTier = useCallback((courseId: string): AccessTier => {
    const access = courseAccessList.find(ca => ca.courseId === courseId && ca.status === 'active');
    if (!access) return 'free';
    return access.accessTier;
  }, [courseAccessList]);

  const getAccess = useCallback((courseId: string): CourseAccess | null => {
    return courseAccessList.find(ca => ca.courseId === courseId && ca.status === 'active') || null;
  }, [courseAccessList]);

  // Legacy enrollment methods
  const enrollCourse = useCallback((courseId: string) => {
    setEnrollments(prev => {
      if (prev.find(e => e.courseId === courseId)) return prev;
      return [...prev, {
        courseId,
        enrolledAt: new Date().toISOString(),
        progress: 0,
        completedLessons: [],
        lastAccessedAt: new Date().toISOString(),
      }];
    });

    // Sync to server
    fetch('/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    }).catch(e => {
      console.error('[CourseAccess] Enrollment sync failed:', e);
    });
  }, []);

  const isEnrolled = useCallback((courseId: string) => {
    // Check both new access list and legacy enrollments
    if (courseAccessList.some(ca => ca.courseId === courseId && ca.status === 'active')) return true;
    return enrollments.some(e => e.courseId === courseId);
  }, [courseAccessList, enrollments]);

  const getProgress = useCallback((courseId: string) => {
    return enrollments.find(e => e.courseId === courseId)?.progress ?? 0;
  }, [enrollments]);

  const markLessonComplete = useCallback((courseId: string, lessonId: string, totalLessons: number) => {
    let newProgress = 0;
    setEnrollments(prev => prev.map(e => {
      if (e.courseId !== courseId) return e;
      const completedLessons = e.completedLessons.includes(lessonId)
        ? e.completedLessons
        : [...e.completedLessons, lessonId];
      newProgress = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;
      return { ...e, completedLessons, progress: newProgress, lastAccessedAt: new Date().toISOString() };
    }));

    // Update streak
    if (typeof window !== 'undefined') {
      try {
        const streakData = JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK) || '{}');
        const today = new Date().toISOString().split('T')[0];
        if (streakData.lastDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          streakData.count = streakData.lastDate === yesterday ? (streakData.count || 0) + 1 : 1;
          streakData.lastDate = today;
          localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(streakData));
          setCurrentStreak(streakData.count);
        }
      } catch {
        // localStorage not available
      }
    }

    // Sync progress to server
    fetch('/api/enrollments/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, lessonId, progress: newProgress }),
    }).catch(e => {
      console.error('[CourseAccess] Progress sync failed:', e);
    });
  }, []);

  const addOrder = useCallback((orderData: Omit<LegacyOrder, 'id' | 'date' | 'status'>) => {
    const newOrder: LegacyOrder = {
      ...orderData,
      id: `ORD-${crypto.randomUUID()}`,
      date: new Date().toISOString(),
      status: 'Đang chờ',
    };
    setOrders(prev => [newOrder, ...prev]);

    // Auto-enroll courses from the order (legacy compat)
    orderData.courses.forEach(c => {
      enrollCourse(c.id);
    });
  }, [enrollCourse]);

  const updateOrderStatus = useCallback((orderId: string, status: LegacyOrder['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  }, []);

  const totalHoursLearned = enrollments.reduce((sum, e) => {
    return sum + Math.round(e.completedLessons.length * 0.25 * 10) / 10;
  }, 0);

  const completedCoursesCount = enrollments.filter(e => e.progress === 100).length;

  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    try {
      const streakData = JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK) || '{}');
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (streakData.lastDate === today || streakData.lastDate === yesterday) {
        setCurrentStreak(streakData.count || 0);
      }
    } catch {
      // localStorage not available during SSR
    }
  }, [enrollments]);

  return (
    <CourseAccessContext.Provider value={{
      courseAccessList,
      hasAccess,
      getAccessTier,
      getAccess,
      refreshAccess,
      enrollments,
      isEnrolled,
      getProgress,
      enrollCourse,
      markLessonComplete,
      orders,
      addOrder,
      updateOrderStatus,
      totalHoursLearned,
      completedCoursesCount,
      currentStreak,
    }}>
      {children}
    </CourseAccessContext.Provider>
  );
}

export function useCourseAccess() {
  const context = useContext(CourseAccessContext);
  if (context === undefined) {
    throw new Error('useCourseAccess must be used within a CourseAccessProvider');
  }
  return context;
}

/**
 * Legacy hook - wraps useCourseAccess for backward compatibility.
 * Components using useEnrollment() will still work.
 */
export function useEnrollment() {
  return useCourseAccess();
}
