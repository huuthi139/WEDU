'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import type { Course, MemberLevel } from '@/lib/mockData';

interface CoursesContextType {
  courses: Course[];
  categories: { id: string; name: string; slug: string; count: number }[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined);

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = () => {
    setIsLoading(true);
    setError(null);
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.courses)) {
          setCourses(data.courses);
        } else {
          setError('Không thể tải danh sách khóa học');
        }
      })
      .catch(() => {
        setError('Lỗi kết nối - không thể tải khóa học');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCourses();

    // Auto-refetch every 60 seconds to sync latest data from Supabase
    const interval = setInterval(fetchCourses, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Memoize categories computation
  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const c of courses) {
      if (c.category) {
        catMap.set(c.category, (catMap.get(c.category) || 0) + 1);
      }
    }
    const result = [
      { id: '0', name: 'Tất cả', slug: 'all', count: courses.length },
    ];
    let idx = 1;
    for (const [cat, count] of catMap.entries()) {
      result.push({ id: String(idx++), name: cat, slug: cat, count });
    }
    return result;
  }, [courses]);

  return (
    <CoursesContext.Provider value={{ courses, categories, isLoading, error, refetch: fetchCourses }}>
      {children}
    </CoursesContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CoursesContext);
  if (context === undefined) {
    throw new Error('useCourses must be used within a CoursesProvider');
  }
  return context;
}
