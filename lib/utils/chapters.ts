import type { MemberLevel } from '@/lib/mockData';

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  requiredLevel: MemberLevel;
  directPlayUrl: string;
  thumbnail?: string;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

/**
 * Check if URL is an embed URL (YouTube, Bunny CDN, etc.)
 */
export function isEmbedUrl(url: string): boolean {
  return /mediadelivery\.net\/(embed|play)/.test(url)
    || /player\.mediadelivery\.net/.test(url)
    || /iframe\.mediadelivery\.net/.test(url)
    || /video\.bunnycdn\.com/.test(url);
}

/**
 * Normalize Bunny embed URL: player.mediadelivery.net → iframe.mediadelivery.net
 */
export function normalizeBunnyEmbedUrl(url: string): string {
  if (!url) return url;
  return url.replace(/^(https?:\/\/)player\.mediadelivery\.net/, '$1iframe.mediadelivery.net');
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
      requiredLevel: ls.requiredLevel || 'Free',
      directPlayUrl: normalizeBunnyEmbedUrl(
        ls.directPlayUrl ||
        (ls.videoId && ls.libraryId
          ? `https://iframe.mediadelivery.net/embed/${ls.libraryId}/${ls.videoId}`
          : '')
      ),
      thumbnail: ls.thumbnail || '',
    })),
  }));
}
