import type { MemberLevel, AccessTier } from '@/lib/types';

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  requiredLevel: MemberLevel;
  accessTier: AccessTier;
  lessonType: string;
  directPlayUrl: string;
  thumbnail?: string;
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
 * Check if URL is an embed URL (YouTube, Bunny CDN, etc.)
 */
export function isEmbedUrl(url: string): boolean {
  return /mediadelivery\.net\/(embed|play)/.test(url)
    || /player\.mediadelivery\.net/.test(url)
    || /iframe\.mediadelivery\.net/.test(url)
    || /video\.bunnycdn\.com/.test(url);
}

/**
 * Normalize Bunny embed URL: player.mediadelivery.net -> iframe.mediadelivery.net
 */
export function normalizeBunnyEmbedUrl(url: string): string {
  if (!url) return url;
  return url.replace(/^(https?:\/\/)player\.mediadelivery\.net/, '$1iframe.mediadelivery.net');
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
    })),
  }));
}
