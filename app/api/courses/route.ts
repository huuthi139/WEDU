import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { getAllCourses } from '@/lib/supabase/courses';
import { getAllChapterStats } from '@/lib/supabase/chapters';
import { FALLBACK_COURSES } from '@/lib/fallback-data';
import { getCachedCourses, setCachedCourses } from '@/lib/supabase/courses-cache';

export async function GET() {
  try {
    // Serve from cache if still fresh
    const cached = getCachedCourses();
    if (cached.fresh && cached.courses) {
      const response = NextResponse.json({ success: true, courses: cached.courses });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    // Fetch from Supabase (source of truth)
    const [supabaseCourses, chapterStats] = await Promise.all([
      getAllCourses(),
      getAllChapterStats(),
    ]);

    let courses: any[];
    if (supabaseCourses.length > 0) {
      courses = supabaseCourses.map(c => {
        const stats = chapterStats[c.id];
        return {
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
          duration: stats?.duration || c.duration || 0,
          lessonsCount: stats?.lessonsCount || c.lessons_count || 0,
          isFree: (c.price || 0) === 0,
          badge: c.badge || undefined,
          category: c.category || '',
          memberLevel: c.member_level || 'Free',
        };
      });
    } else {
      // Fallback to embedded data if Supabase returned nothing
      console.warn('[Courses] Supabase returned empty, using fallback data');
      courses = FALLBACK_COURSES;
    }

    setCachedCourses(courses);

    const response = NextResponse.json({ success: true, courses });
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    // Serve stale cache on error
    const cached = getCachedCourses();
    if (cached.courses) {
      const response = NextResponse.json({ success: true, courses: cached.courses });
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }
    return NextResponse.json({ success: true, courses: FALLBACK_COURSES });
  }
}
