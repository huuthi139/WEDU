/**
 * Shared cache module for public courses API.
 * In-memory cache is DISABLED — every request fetches fresh data from Supabase.
 */

export function getCachedCourses(): { courses: any[] | null; fresh: boolean } {
  // Cache disabled: always return miss so callers fetch from DB
  return { courses: null, fresh: false };
}

export function debugCacheState(): { courses: any[] | null; fresh: boolean; ageMs: number } {
  return { courses: null, fresh: false, ageMs: -1 };
}

export function setCachedCourses(_courses: any[]) {
  // No-op: cache disabled
}

export function invalidateCoursesCache() {
  // No-op: cache disabled
}
