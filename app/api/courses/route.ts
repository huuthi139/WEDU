import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getAllCourses } from '@/lib/supabase/courses';
import { FALLBACK_COURSES } from '@/lib/fallback-data';

// In-memory cache
let cachedCourses: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export async function GET() {
  try {
    const now = Date.now();

    // Serve from cache if still fresh
    if (cachedCourses && now - cacheTimestamp < CACHE_TTL_MS) {
      const response = NextResponse.json({ success: true, courses: cachedCourses });
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return response;
    }

    // Fetch from Supabase (source of truth)
    const supabaseCourses = await getAllCourses();

    let courses: any[];
    if (supabaseCourses.length > 0) {
      courses = supabaseCourses.map(c => ({
        id: c.id,
        thumbnail: c.thumbnail || '',
        title: c.title || '',
        description: c.description || '',
        instructor: c.instructor || 'WEDU',
        price: c.price || 0,
        originalPrice: c.original_price || undefined,
        rating: c.rating || 0,
        reviewsCount: c.reviews_count || 0,
        enrollmentsCount: c.enrollments_count || 0,
        duration: c.duration || 0,
        lessonsCount: c.lessons_count || 0,
        isFree: (c.price || 0) === 0,
        badge: c.badge || undefined,
        category: c.category || '',
        memberLevel: c.member_level || 'Free',
      }));
    } else {
      // Fallback to embedded data if Supabase returned nothing
      console.warn('[Courses] Supabase returned empty, using fallback data');
      courses = FALLBACK_COURSES;
    }

    cachedCourses = courses;
    cacheTimestamp = now;

    const response = NextResponse.json({ success: true, courses });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    // Serve stale cache on error
    if (cachedCourses) {
      const response = NextResponse.json({ success: true, courses: cachedCourses });
      response.headers.set('Cache-Control', 'public, s-maxage=60');
      return response;
    }
    return NextResponse.json({ success: true, courses: FALLBACK_COURSES });
  }
}
