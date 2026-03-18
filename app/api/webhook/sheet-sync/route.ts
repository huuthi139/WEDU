import { NextResponse } from 'next/server';

/**
 * DEPRECATED - Phase 4.7
 * Google Sheets sync webhook is no longer used.
 * Use /api/admin/import-sheet for data migration.
 * This route returns 410 Gone.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Secret',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Endpoint deprecated since Phase 4.7. Use /api/admin/import-sheet for data migration.',
    },
    { status: 410, headers: CORS_HEADERS }
  );
}
