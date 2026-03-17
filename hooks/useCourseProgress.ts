'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const progressKeys = {
  all: ['course-progress'] as const,
  course: (courseId: string) => ['course-progress', courseId] as const,
  lesson: (courseId: string, lessonId: string) => ['lesson-progress', courseId, lessonId] as const,
};

export function useEnrollments() {
  return useQuery({
    queryKey: ['enrollments'],
    queryFn: async () => {
      const res = await fetch('/api/enrollments', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch enrollments');
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed');
      return data.enrollments || [];
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { courseId: string; lessonId: string; progress: number; courseName?: string }) => {
      const res = await fetch('/api/enrollments/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update progress');
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

export function useEnrollCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (courseId: string) => {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to enroll');
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}
