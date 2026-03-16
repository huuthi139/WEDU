/**
 * Centralized configuration - All secrets from environment variables.
 * NEVER hardcode secrets in source code.
 *
 * Primary data source: Supabase
 * Google Sheet: optional, used for backup sync only
 */

// Google Sheet ID - optional (only for backup sync)
export function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error('[Config] GOOGLE_SHEET_ID not set');
  }
  return id;
}

// Google Apps Script URL - optional (only for backup sync and legacy migration)
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

// Google Sheets CSV export URL helper
export function getSheetCsvUrl(sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${getSheetId()}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// Validate required env vars on startup
export function validateEnv(): void {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const optional = ['GOOGLE_SCRIPT_URL', 'GOOGLE_SHEET_ID'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
  }
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`[Config] Optional env vars not set (Google Sheet sync disabled): ${missingOptional.join(', ')}`);
  }
}
