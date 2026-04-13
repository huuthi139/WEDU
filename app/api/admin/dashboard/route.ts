import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      overviewResult,
      rpcResult,
      lessonProgressResult,
      recentEnrollmentsResult,
      topActiveUsersResult,
    ] = await Promise.all([
      getOverviewStats(supabase, todayStart, weekAgo),
      supabase.rpc('get_dashboard_stats'),
      getMostWatchedLessons(supabase),
      getRecentEnrollments(supabase, todayStart),
      getTopActiveUsers(supabase),
    ]);

    const rpc = rpcResult.data as Record<string, unknown> | null;

    // Fill missing days in userGrowth with 0
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rawGrowth = (rpc?.userGrowth as { date: string; count: number }[] | null) || [];
    const growthMap = new Map(rawGrowth.map(r => [r.date, r.count]));
    const usersByDay: { date: string; count: number }[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      usersByDay.push({ date: dateStr, count: growthMap.get(dateStr) || 0 });
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: overviewResult,
        top_courses: (rpc?.topCourses as unknown[]) || [],
        lesson_progress: {
          most_watched_lessons: lessonProgressResult,
          total_watch_time_hours: (rpc?.totalWatchTimeHours as number) || 0,
          avg_completion_rate: (rpc?.avgCompletionRate as number) || 0,
        },
        recent_enrollments: recentEnrollmentsResult.enrollments,
        active_learners_today: recentEnrollmentsResult.activeLearners,
        users_by_day: usersByDay,
        tier_distribution: (rpc?.tierDistribution as Record<string, number>) || { free: 0, premium: 0, vip: 0 },
        top_active_users: topActiveUsersResult,
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return NextResponse.json(
      { success: false, error: 'Không thể tải dữ liệu dashboard' },
      { status: 500 },
    );
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';

type Supabase = SupabaseClient;

async function getOverviewStats(supabase: Supabase, todayStart: string, weekAgo: string) {
  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: newUsersWeek },
    { count: totalCourses },
    { count: totalLessons },
    { count: totalVip },
    { count: totalPremium },
    { count: totalFree },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'admin'),
    supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'admin').gte('created_at', todayStart),
    supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'admin').gte('created_at', weekAgo),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('member_level', 'VIP').neq('role', 'admin'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('member_level', 'Premium').neq('role', 'admin'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('member_level', 'Free').neq('role', 'admin'),
  ]);

  return {
    total_users: totalUsers || 0,
    new_users_today: newUsersToday || 0,
    new_users_week: newUsersWeek || 0,
    total_courses: totalCourses || 0,
    total_lessons: totalLessons || 0,
    total_vip: totalVip || 0,
    total_premium: totalPremium || 0,
    total_free: totalFree || 0,
  };
}

async function getMostWatchedLessons(supabase: Supabase) {
  // Fetch limited set — only need top viewers
  const { data: progressData } = await supabase
    .from('lesson_progress')
    .select('lesson_id, user_id')
    .limit(5000);

  if (!progressData || progressData.length === 0) return [];

  const lessonUsers: Record<string, Set<string>> = {};
  for (const row of progressData) {
    if (!lessonUsers[row.lesson_id]) lessonUsers[row.lesson_id] = new Set();
    lessonUsers[row.lesson_id].add(row.user_id);
  }

  const topLessonIds = Object.entries(lessonUsers)
    .sort(([, a], [, b]) => b.size - a.size)
    .slice(0, 10)
    .map(([id]) => id);

  if (topLessonIds.length === 0) return [];

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title')
    .in('id', topLessonIds);

  const lessonsMap: Record<string, string> = {};
  if (lessons) {
    for (const l of lessons) lessonsMap[l.id] = l.title;
  }

  return topLessonIds.map(id => ({
    lesson_id: id,
    title: lessonsMap[id] || 'Unknown',
    viewer_count: lessonUsers[id].size,
  }));
}

async function getRecentEnrollments(supabase: Supabase, todayStart: string) {
  const [enrollmentsRes, activeLearnersRes] = await Promise.all([
    supabase
      .from('course_access')
      .select('id, user_id, course_id, access_tier, created_at, users(name, email), courses(title)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('lesson_progress')
      .select('user_id')
      .gte('updated_at', todayStart)
      .limit(5000),
  ]);

  const enrollments = (enrollmentsRes.data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    user_name: (row.users as Record<string, string>)?.name || 'N/A',
    user_email: (row.users as Record<string, string>)?.email || 'N/A',
    course_title: (row.courses as Record<string, string>)?.title || 'N/A',
    access_tier: row.access_tier,
    created_at: row.created_at,
  }));

  const uniqueUsers = new Set(
    (activeLearnersRes.data || []).map((r: { user_id: string }) => r.user_id)
  );

  return {
    enrollments,
    activeLearners: uniqueUsers.size,
  };
}

async function getTopActiveUsers(supabase: Supabase) {
  const { data: progressData } = await supabase
    .from('lesson_progress')
    .select('user_id, lesson_id, duration_seconds, is_completed')
    .limit(5000);

  if (!progressData || progressData.length === 0) return [];

  const userStats: Record<string, { lessons: Set<string>; completed: number; watchSeconds: number }> = {};
  for (const row of progressData) {
    if (!userStats[row.user_id]) {
      userStats[row.user_id] = { lessons: new Set(), completed: 0, watchSeconds: 0 };
    }
    userStats[row.user_id].lessons.add(row.lesson_id);
    if (row.is_completed) userStats[row.user_id].completed++;
    userStats[row.user_id].watchSeconds += row.duration_seconds || 0;
  }

  const topUserIds = Object.entries(userStats)
    .sort(([, a], [, b]) => b.lessons.size - a.lessons.size)
    .slice(0, 10)
    .map(([id]) => id);

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', topUserIds);

  const usersMap: Record<string, { name: string; email: string }> = {};
  if (users) {
    for (const u of users) {
      usersMap[u.id] = { name: u.name, email: u.email };
    }
  }

  return topUserIds.map(id => ({
    user_id: id,
    name: usersMap[id]?.name || 'N/A',
    email: usersMap[id]?.email || 'N/A',
    lessons_completed: userStats[id].completed,
    total_watch_seconds: userStats[id].watchSeconds,
  }));
}
