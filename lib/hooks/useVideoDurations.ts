'use client';

import { useState, useEffect, useRef } from 'react';
import { isEmbedUrl } from '@/lib/utils/chapters';

const CACHE_KEY = 'wedu-video-durations';
const CACHE_VERSION = 1;

interface DurationCache {
  version: number;
  durations: Record<string, number>; // lessonId -> seconds
}

function loadCache(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed: DurationCache = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) return {};
    return parsed.durations || {};
  } catch {
    return {};
  }
}

function saveCache(durations: Record<string, number>) {
  try {
    const data: DurationCache = { version: CACHE_VERSION, durations };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/**
 * Extract Bunny libraryId and videoId from an embed/play URL.
 * e.g. https://iframe.mediadelivery.net/embed/607264/da7acb2a-...
 */
function parseBunnyUrl(url: string): { libId: string; vidId: string } | null {
  const match = url.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([a-f0-9-]+)/i);
  if (match) return { libId: match[1], vidId: match[2] };
  return null;
}

/**
 * Probe a single video URL for its duration in seconds.
 * Returns 0 if probing fails.
 */
function probeVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      video.src = '';
      resolve(0);
    }, 8000);

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';

    if (isEmbedUrl(videoUrl)) {
      const parsed = parseBunnyUrl(videoUrl);
      if (!parsed) { clearTimeout(timeout); resolve(0); return; }
      video.src = `https://vz-${parsed.libId}.b-cdn.net/${parsed.vidId}/original`;
    } else {
      video.src = videoUrl;
    }

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = video.duration && isFinite(video.duration) ? Math.round(video.duration) : 0;
      video.src = '';
      resolve(dur);
    };
    video.onerror = () => {
      clearTimeout(timeout);
      video.src = '';
      resolve(0);
    };
  });
}

export function formatSecondsToMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatSecondsFull(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface LessonInput {
  id: string;
  directPlayUrl: string;
}

/**
 * Hook that probes video URLs to get real durations.
 * Returns a map of lessonId -> duration in seconds.
 * Caches results in localStorage so probing only happens once per video.
 */
export function useVideoDurations(lessons: LessonInput[]): Record<string, number> {
  const [durations, setDurations] = useState<Record<string, number>>(loadCache);
  const probingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!lessons.length) return;

    const cached = loadCache();
    const toProbe = lessons.filter(
      (ls) => ls.directPlayUrl && !(ls.id in cached) && !probingRef.current.has(ls.id)
    );

    if (toProbe.length === 0) {
      // Ensure state matches cache
      setDurations((prev) => {
        const merged = { ...prev, ...cached };
        if (Object.keys(merged).length === Object.keys(prev).length) return prev;
        return merged;
      });
      return;
    }

    // Probe in batches of 3 to avoid overwhelming the browser
    let cancelled = false;
    const BATCH_SIZE = 3;

    async function probeBatches() {
      for (let i = 0; i < toProbe.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = toProbe.slice(i, i + BATCH_SIZE);

        batch.forEach((ls) => probingRef.current.add(ls.id));

        const results = await Promise.all(
          batch.map(async (ls) => {
            const dur = await probeVideoDuration(ls.directPlayUrl);
            return { id: ls.id, duration: dur };
          })
        );

        if (cancelled) return;

        setDurations((prev) => {
          const updated = { ...prev };
          results.forEach(({ id, duration }) => {
            if (duration > 0) updated[id] = duration;
          });
          saveCache(updated);
          return updated;
        });
      }
    }

    probeBatches();
    return () => { cancelled = true; };
  }, [lessons]);

  return durations;
}
