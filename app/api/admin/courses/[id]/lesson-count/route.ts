import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const courseId = params.id;
  const supabase = getSupabaseAdmin();

  // Count lessons via course_sections join
  const { count, error } = await supabase
    .from('lessons')
    .select('id, course_sections!inner(course_id)', { count: 'exact', head: true })
    .eq('course_sections.course_id', courseId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: count ?? 0 });
}
