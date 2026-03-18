import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {
    status: 'ok',
    app: 'WEDU',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check 0: Supabase connection
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

  // Check 1: Google Sheets CSV reachable
  if (SHEET_ID) {
    try {
      const sheetsUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Courses`;
      const res = await fetch(sheetsUrl, {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 0 },
      });
      checks.googleSheets = {
        status: res.ok ? 'ok' : 'degraded',
        latencyMs: Date.now() - startTime,
      };
    } catch {
      checks.googleSheets = { status: 'error', latencyMs: Date.now() - startTime };
      checks.status = 'degraded';
    }
  } else {
    checks.googleSheets = { status: 'unconfigured' };
    checks.status = 'degraded';
  }

  // Check 2: Apps Script reachable
  if (SCRIPT_URL) {
    const scriptStart = Date.now();
    try {
      const res = await fetch(`${SCRIPT_URL}?action=ping`, {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 0 },
      });
      checks.appsScript = {
        status: res.ok ? 'ok' : 'degraded',
        latencyMs: Date.now() - scriptStart,
      };
    } catch {
      checks.appsScript = { status: 'error', latencyMs: Date.now() - scriptStart };
      checks.status = 'degraded';
    }
  } else {
    checks.appsScript = { status: 'unconfigured' };
  }

  checks.totalLatencyMs = Date.now() - startTime;
  const httpStatus = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: httpStatus });
}
