import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';

/**
 * GET /api/health
 *
 * Phase 4.7: Google Sheets removed from runtime health checks.
 * Supabase is the only runtime dependency.
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {
    status: 'ok',
    app: 'WEDU',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check: Supabase connection
  const supabaseStart = Date.now();
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('id').limit(1);
    checks.supabase = {
      status: error ? 'error' : 'ok',
      latencyMs: Date.now() - supabaseStart,
      ...(error ? { error: error.message, code: error.code } : { rowCount: data?.length ?? 0 }),
    };
    if (error) checks.status = 'degraded';
  } catch (err) {
    checks.supabase = {
      status: 'error',
      latencyMs: Date.now() - supabaseStart,
      error: err instanceof Error ? err.message : String(err),
    };
    checks.status = 'degraded';
  }

  // Check env vars presence (not values)
  checks.envVars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
  };

  checks.totalLatencyMs = Date.now() - startTime;
  const httpStatus = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: httpStatus });
}
