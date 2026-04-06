import type { MemberLevel, AccessTier } from '@/lib/types';

export type ChapterLessonType = 'video' | 'text' | 'pdf' | 'image';

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  requiredLevel: MemberLevel;
  accessTier: AccessTier;
  lessonType: ChapterLessonType;
  directPlayUrl: string;
  thumbnail?: string;
  content?: string;
  durationSeconds: number;
  documentUrl?: string;
  imageUrl?: string;
  /** @deprecated Use accessTier instead */
  isPreview?: boolean;
}

/** Legacy lesson shape without accessTier (for fallback data) */
export interface LegacyLesson {
  id: string;
  title: string;
  duration: string;
  requiredLevel: MemberLevel;
  directPlayUrl: string;
  thumbnail?: string;
  isPreview?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

/**
 * Detect video type from URL
 */
export type VideoSourceType = 'bunny' | 'youtube' | 'mp4' | 'unknown';

export function detectVideoType(url: string): VideoSourceType {
  if (!url) return 'unknown';
  if (/mediadelivery\.net/.test(url) || /video\.bunnycdn\.com/.test(url) || /b-cdn\.net/.test(url)) return 'bunny';
  if (/youtube\.com/.test(url) || /youtu\.be/.test(url)) return 'youtube';
  if (/\.mp4(\?|$)/.test(url)) return 'mp4';
  return 'unknown';
}

/**
 * Check if URL is an embed URL (YouTube, Bunny CDN, etc.)
 */
export function isEmbedUrl(url: string): boolean {
  const type = detectVideoType(url);
  return type === 'bunny' || type === 'youtube';
}

/**
 * Normalize Bunny embed URL: player.mediadelivery.net -> iframe.mediadelivery.net
 */
export function normalizeBunnyEmbedUrl(url: string): string {
  if (!url) return url;
  return url.replace(/^(https?:\/\/)player\.mediadelivery\.net/, '$1iframe.mediadelivery.net');
}

/**
 * Normalize YouTube URL to embed format
 */
export function normalizeYouTubeUrl(url: string): string {
  if (!url) return '';

  // Already embed URL
  if (url.includes('youtube.com/embed/')) {
    const base = url.split('?')[0];
    return base + '?rel=0&modestbranding=1';
  }

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}?rel=0&modestbranding=1`;
  }

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}?rel=0&modestbranding=1`;
  }

  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (shortsMatch) {
    return `https://www.youtube.com/embed/${shortsMatch[1]}?rel=0&modestbranding=1`;
  }

  return url;
}

/**
 * Get the proper embed URL for any video source type
 */
export function getVideoEmbedUrl(url: string): string {
  const type = detectVideoType(url);
  switch (type) {
    case 'bunny': return normalizeBunnyEmbedUrl(url);
    case 'youtube': return normalizeYouTubeUrl(url);
    default: return url;
  }
}

/**
 * Convert access_tier to MemberLevel for display
 */
function accessTierToLevel(tier: string | undefined): MemberLevel {
  switch (tier) {
    case 'vip': return 'VIP';
    case 'premium': return 'Premium';
    default: return 'Free';
  }
}

/**
 * Normalize chapter data — handle both new and legacy formats
 */
export function normalizeChapters(chapters: any[]): Chapter[] {
  return chapters.map((ch: any) => ({
    id: ch.id,
    title: ch.title,
    lessons: (ch.lessons || []).map((ls: any) => ({
      id: ls.id,
      title: ls.title,
      duration: ls.duration || '',
      // New: use accessTier if available, fall back to requiredLevel mapping
      accessTier: ls.accessTier || (ls.requiredLevel ? (
        ls.requiredLevel === 'VIP' ? 'vip' : ls.requiredLevel === 'Premium' ? 'premium' : 'free'
      ) : 'free') as AccessTier,
      // Legacy compat: requiredLevel for display
      requiredLevel: ls.requiredLevel || accessTierToLevel(ls.accessTier) || 'Free',
      lessonType: ls.lessonType || 'video',
      directPlayUrl: normalizeBunnyEmbedUrl(
        ls.directPlayUrl ||
        (ls.videoId && ls.libraryId
          ? `https://iframe.mediadelivery.net/embed/${ls.libraryId}/${ls.videoId}`
          : '')
      ),
      thumbnail: ls.thumbnail || '',
      content: ls.content || '',
      documentUrl: ls.documentUrl || '',
      imageUrl: ls.imageUrl || '',
      durationSeconds: ls.durationSeconds || ls.duration_seconds || 0,
    })),
  }));
}
