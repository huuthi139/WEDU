'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface Enrollment {
  courseId: string;
  enrolledAt: string;
  progress: number; // 0-100
  completedLessons: string[]; // lesson IDs
  lastAccessedAt: string;
}

export interface Order {
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

interface EnrollmentContextType {
  enrollments: Enrollment[];
  orders: Order[];
  enrollCourse: (courseId: string) => void;
  isEnrolled: (courseId: string) => boolean;
  getProgress: (courseId: string) => number;
  markLessonComplete: (courseId: string, lessonId: string, totalLessons: number) => void;
  addOrder: (order: Omit<Order, 'id' | 'date' | 'status'>) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  totalHoursLearned: number;
  completedCoursesCount: number;
  currentStreak: number;
}

const EnrollmentContext = createContext<EnrollmentContextType | undefined>(undefined);

const STORAGE_KEY_ENROLLMENTS = 'wepower-enrollments';
const STORAGE_KEY_ORDERS = 'wepower-orders';
const STORAGE_KEY_STREAK = 'wepower-streak';

export function EnrollmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasSynced = useRef(false);

  // Sync enrollments from server (server is source of truth)
  const syncFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/enrollments');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.enrollments) {
        // Convert server format to local format (server wins for conflicts)
        const serverEnrollments: Enrollment[] = data.enrollments.map((e: Record<string, unknown>) => ({
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
      console.error('[Enrollment] Sync from server failed:', e);
      // Graceful degradation — use localStorage if server unavailable
    }
  }, []);

  // Sync from server when user logs in
  useEffect(() => {
    if (user?.email && !hasSynced.current) {
      hasSynced.current = true;
      syncFromServer();
    }
    if (!user) {
      hasSynced.current = false;
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
      console.error('[EnrollmentProvider] localStorage error:', error instanceof Error ? error.message : String(error));
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

  const enrollCourse = useCallback((courseId: string) => {
    // 1. Optimistic update — localStorage is updated immediately
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

    // 2. Sync to server (background, non-blocking)
    fetch('/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    }).catch(e => {
      console.error('[Enrollment] Server sync failed:', e);
    });
  }, []);

  const isEnrolled = useCallback((courseId: string) => {
    return enrollments.some(e => e.courseId === courseId);
  }, [enrollments]);

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
    try {
      const streakData = JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK) || '{}');
      const today = new Date().toISOString().split('T')[0];
      if (streakData.lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        streakData.count = streakData.lastDate === yesterday ? (streakData.count || 0) + 1 : 1;
        streakData.lastDate = today;
        localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(streakData));
      }
    } catch (error) {
      console.error('[EnrollmentProvider] localStorage error:', error instanceof Error ? error.message : String(error));
    }

    // Sync progress to server (background, non-blocking)
    fetch('/api/enrollments/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, lessonId, progress: newProgress }),
    }).catch(e => {
      console.error('[Progress] Server sync failed:', e);
    });
  }, []);

  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'date' | 'status'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `ORD-${crypto.randomUUID()}`,
      date: new Date().toISOString(),
      status: 'Đang chờ',
    };
    setOrders(prev => [newOrder, ...prev]);

    // Auto-enroll courses from the order
    orderData.courses.forEach(c => {
      enrollCourse(c.id);
    });
  }, [enrollCourse]);

  const updateOrderStatus = useCallback((orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  }, []);

  const totalHoursLearned = enrollments.reduce((sum, e) => {
    return sum + Math.round(e.completedLessons.length * 0.25 * 10) / 10;
  }, 0);

  const completedCoursesCount = enrollments.filter(e => e.progress === 100).length;

  let currentStreak = 0;
  try {
    const streakData = JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK) || '{}');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (streakData.lastDate === today || streakData.lastDate === yesterday) {
      currentStreak = streakData.count || 0;
    }
  } catch (error) {
    console.error('[EnrollmentProvider] localStorage error:', error instanceof Error ? error.message : String(error));
  }

  return (
    <EnrollmentContext.Provider value={{
      enrollments,
      orders,
      enrollCourse,
      isEnrolled,
      getProgress,
      markLessonComplete,
      addOrder,
      updateOrderStatus,
      totalHoursLearned,
      completedCoursesCount,
      currentStreak,
    }}>
      {children}
    </EnrollmentContext.Provider>
  );
}

export function useEnrollment() {
  const context = useContext(EnrollmentContext);
  if (context === undefined) {
    throw new Error('useEnrollment must be used within an EnrollmentProvider');
  }
  return context;
}
