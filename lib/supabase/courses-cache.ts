/**
 * Shared in-memory cache for public courses API.
 * Caches courses fetched from Supabase (primary source).
 * Admin operations can invalidate this cache so that the next
 * public GET /api/courses returns fresh data from the database.
 */

let cachedCourses: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export function getCachedCourses(): { courses: any[] | null; fresh: boolean } {
  const now = Date.now();
  if (cachedCourses && now - cacheTimestamp < CACHE_TTL_MS) {
    return { courses: cachedCourses, fresh: true };
  }
  return { courses: null, fresh: false };
}

/** Debug: peek at cache state without TTL filtering */
export function debugCacheState(): { courses: any[] | null; fresh: boolean; ageMs: number } {
  const now = Date.now();
  return {
    courses: cachedCourses,
    fresh: cachedCourses ? now - cacheTimestamp < CACHE_TTL_MS : false,
    ageMs: cachedCourses ? now - cacheTimestamp : -1,
  };
}

export function setCachedCourses(courses: any[]) {
  cachedCourses = courses;
  cacheTimestamp = Date.now();
}

/** Call after admin create/update/delete to bust the public cache */
export function invalidateCoursesCache() {
  cachedCourses = null;
  cacheTimestamp = 0;
}
