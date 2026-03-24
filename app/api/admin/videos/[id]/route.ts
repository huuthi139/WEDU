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

/** PATCH - Update a video */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const body = await request.json();
    const { title, source, video_id, library_id, duration, thumbnail_url } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (source !== undefined) {
      if (!['bunny', 'youtube'].includes(source)) {
        return NextResponse.json({ success: false, error: 'Source phải là bunny hoặc youtube' }, { status: 422 });
      }
      updates.source = source;
    }
    if (video_id !== undefined) updates.video_id = video_id;
    if (library_id !== undefined) updates.library_id = library_id;
    if (duration !== undefined) updates.duration = duration;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;

    // Regenerate URL if source/video_id/library_id changed
    const finalSource = source || body._currentSource;
    const finalVideoId = video_id || body._currentVideoId;
    const finalLibraryId = library_id !== undefined ? library_id : body._currentLibraryId;
    if (finalSource && finalVideoId) {
      if (finalSource === 'bunny' && finalLibraryId) {
        updates.url = `https://iframe.mediadelivery.net/embed/${finalLibraryId}/${finalVideoId}`;
      } else if (finalSource === 'youtube') {
        updates.url = `https://www.youtube.com/watch?v=${finalVideoId}`;
      }
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      logger.error('admin.videos.update', 'Failed to update video', { error: error.message, id: params.id });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    logger.info('admin.videos.update', 'Video updated', { videoId: params.id, actor: adminUser.email });
    return NextResponse.json({ success: true, video: data });
  } catch (err) {
    logger.error('admin.videos.update', 'Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

/** DELETE - Delete a video */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', params.id);

    if (error) {
      logger.error('admin.videos.delete', 'Failed to delete video', { error: error.message, id: params.id });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    logger.info('admin.videos.delete', 'Video deleted', { videoId: params.id, actor: adminUser.email });
    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    logger.error('admin.videos.delete', 'Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
