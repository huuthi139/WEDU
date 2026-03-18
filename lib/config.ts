/**
 * Centralized configuration - All secrets from environment variables.
 * NEVER hardcode secrets in source code.
 *
 * Phase 4.7: Supabase is the ONLY runtime source of truth.
 * Google Sheets is only used for admin import/migration (not runtime).
 * Google Apps Script: deprecated, kept for legacy migration only.
 */

// Google Sheet ID - used ONLY by admin import tool, NOT runtime
export function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error('[Config] GOOGLE_SHEET_ID not set - required for import tool');
  }
  return id;
}

// Safe version that returns null instead of throwing
export function getSheetIdSafe(): string | null {
  return process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || null;
}

// Google Apps Script URL - deprecated, kept for legacy migration only
export function getScriptUrl(): string {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) {
    throw new Error('[Config] GOOGLE_SCRIPT_URL not set');
  }
  return url;
}

// Safe version that returns null instead of throwing
export function getScriptUrlSafe(): string | null {
  return process.env.GOOGLE_SCRIPT_URL || null;
}

// Google Sheets CSV export URL helper (used only by import tool)
export function getSheetCsvUrl(sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// Validate required env vars on startup
export function validateEnv(): void {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
  }
  // Google Sheet ID is optional - only needed for admin import tool
  if (!process.env.GOOGLE_SHEET_ID && !process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID) {
    console.info('[Config] GOOGLE_SHEET_ID not set — admin import tool will require manual sheetId');
  }
}
