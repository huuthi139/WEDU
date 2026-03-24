import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { logger } from '@/lib/telemetry/logger';

function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

/** GET - List all videos with search & pagination */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('videos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('admin.videos.get', 'Failed to list videos', { error: error.message });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      videos: data || [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    logger.error('admin.videos.get', 'Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

/** POST - Create a new video */
export async function POST(request: NextRequest) {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const body = await request.json();
    const { title, source, video_id, library_id, duration, thumbnail_url } = body;

    if (!title || !video_id || !source) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc (title, source, video_id)' }, { status: 422 });
    }

    if (!['bunny', 'youtube'].includes(source)) {
      return NextResponse.json({ success: false, error: 'Source phải là bunny hoặc youtube' }, { status: 422 });
    }

    // Generate URL based on source
    let url = '';
    if (source === 'bunny' && library_id) {
      url = `https://iframe.mediadelivery.net/embed/${library_id}/${video_id}`;
    } else if (source === 'youtube') {
      url = `https://www.youtube.com/watch?v=${video_id}`;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('videos')
      .insert({
        title,
        source,
        video_id,
        library_id: source === 'bunny' ? library_id : null,
        url,
        duration: duration || null,
        thumbnail_url: thumbnail_url || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('admin.videos.create', 'Failed to create video', { error: error.message });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    logger.info('admin.videos.create', 'Video created', { videoId: data.id, actor: adminUser.email });
    return NextResponse.json({ success: true, video: data });
  } catch (err) {
    logger.error('admin.videos.create', 'Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
