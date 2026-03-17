'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

export const lessonProgressKeys = {
  lesson: (courseId: string, lessonId: string) => ['lesson-progress', courseId, lessonId] as const,
  course: (courseId: string) => ['course-lessons-progress', courseId] as const,
};

interface ProgressData {
  positionSeconds: number;
  durationSeconds: number;
}

/**
 * Hook to manage lesson progress with autosave.
 * Saves every 20 seconds, on blur, and on unmount.
 */
export function useLessonAutosave(courseId: string, lessonId: string) {
  const queryClient = useQueryClient();
  const progressRef = useRef<ProgressData>({ positionSeconds: 0, durationSeconds: 0 });
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSavingRef = useRef(false);

  // Fetch initial progress
  const { data: initialProgress } = useQuery({
    queryKey: lessonProgressKeys.lesson(courseId, lessonId),
    queryFn: async () => {
      const res = await fetch(`/api/lessons/progress?courseId=${courseId}&lessonId=${lessonId}`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.data?.progress : null;
    },
    enabled: !!courseId && !!lessonId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (progress: ProgressData) => {
      const res = await fetch('/api/lessons/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId,
          positionSeconds: progress.positionSeconds,
          durationSeconds: progress.durationSeconds,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lessonProgressKeys.lesson(courseId, lessonId) });
    },
  });

  const saveProgress = useCallback(() => {
    if (isSavingRef.current) return;
    const { positionSeconds, durationSeconds } = progressRef.current;
    if (positionSeconds === 0 && durationSeconds === 0) return;

    isSavingRef.current = true;
    saveMutation.mutate(
      { positionSeconds, durationSeconds },
      { onSettled: () => { isSavingRef.current = false; } }
    );
  }, [saveMutation]);

  // Update position (called by player component frequently)
  const updatePosition = useCallback((positionSeconds: number, durationSeconds: number) => {
    progressRef.current = { positionSeconds, durationSeconds };
  }, []);

  // Start autosave interval (every 20 seconds)
  useEffect(() => {
    saveTimerRef.current = setInterval(saveProgress, 20000);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [saveProgress]);

  // Save on blur/visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) saveProgress();
    };
    const handleBeforeUnload = () => saveProgress();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      // Save on unmount (lesson change)
      saveProgress();
    };
  }, [saveProgress]);

  // Mark complete mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lessons/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark complete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lessonProgressKeys.lesson(courseId, lessonId) });
      queryClient.invalidateQueries({ queryKey: lessonProgressKeys.course(courseId) });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });

  return {
    initialProgress,
    updatePosition,
    saveProgress,
    markComplete: () => completeMutation.mutate(),
    isSaving: saveMutation.isPending,
    isCompleting: completeMutation.isPending,
  };
}
