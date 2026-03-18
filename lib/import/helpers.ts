/**
 * WEDU Phase 4.6 - Import Helpers
 * Utilities for validating, normalizing, and merging data
 * from Google Sheets into Supabase.
 */

import type { AccessTier, AccessStatus, SystemRole } from '@/lib/types';

// =============================================
// EMAIL
// =============================================

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

export function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// =============================================
// ACCESS TIER
// =============================================

const TIER_RANK: Record<AccessTier, number> = { free: 0, premium: 1, vip: 2 };

export function normalizeAccessTier(raw: string): AccessTier | null {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'free') return 'free';
  if (s === 'premium') return 'premium';
  if (s === 'vip') return 'vip';
  // Legacy MemberLevel mapping
  if (s === 'Free') return 'free';
  if (s === 'Premium') return 'premium';
  if (s === 'VIP') return 'vip';
  return null;
}

/**
 * Merge access tiers: upgrade only by default.
 * Returns the higher tier unless upgradeOnly is false.
 */
export function mergeAccessTier(
  current: AccessTier,
  incoming: AccessTier,
  upgradeOnly = true,
): AccessTier {
  if (upgradeOnly) {
    return TIER_RANK[incoming] > TIER_RANK[current] ? incoming : current;
  }
  return incoming;
}

// =============================================
// SYSTEM ROLE
// =============================================

export function normalizeSystemRole(raw: string): SystemRole {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'admin' || s === 'administrator' || s.includes('quản trị') || s === 'qtv') return 'admin';
  if (s === 'instructor' || s === 'giảng viên' || s === 'giang vien') return 'instructor';
  return 'student';
}

// =============================================
// ACCESS STATUS
// =============================================

export function normalizeAccessStatus(raw: string): AccessStatus {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'expired') return 'expired';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'active';
}

// =============================================
// COURSE STATUS
// =============================================

export function normalizeCourseStatus(raw: string): 'draft' | 'published' | 'archived' {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'draft') return 'draft';
  if (s === 'archived') return 'archived';
  return 'published';
}

// =============================================
// ACCESS SOURCE
// =============================================

export function normalizeAccessSource(raw: string): string {
  const s = (raw || '').trim().toLowerCase();
  const valid = ['manual', 'order', 'gift', 'admin', 'scholarship', 'system', 'import'];
  return valid.includes(s) ? s : 'import';
}

// =============================================
// USER STATUS
// =============================================

export function normalizeUserStatus(raw: string): 'active' | 'inactive' | 'banned' {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'inactive') return 'inactive';
  if (s === 'banned') return 'banned';
  return 'active';
}

// =============================================
// DATE PARSING
// =============================================

export function parseDate(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;

  // ISO format
  if (dateStr.includes('T') && dateStr.includes('-')) {
    try { const d = new Date(dateStr); if (!isNaN(d.getTime())) return d.toISOString(); } catch { /* */ }
  }

  // Vietnamese format: "HH:MM:SS DD/MM/YYYY"
  const vnMatch = dateStr.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnMatch) {
    const [, h, m, s, d, mo, y] = vnMatch;
    try { return new Date(+y, +mo - 1, +d, +h, +m, +s).toISOString(); } catch { /* */ }
  }

  // DD/MM/YYYY
  const dmyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const [, d, mo, y] = dmyMatch;
    try { return new Date(+y, +mo - 1, +d).toISOString(); } catch { /* */ }
  }

  // Fallback
  try { const d = new Date(dateStr); if (!isNaN(d.getTime())) return d.toISOString(); } catch { /* */ }

  return null;
}

// =============================================
// CSV PARSER
// =============================================

export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    return row;
  });
}

// =============================================
// COLUMN MAPPING HELPERS
// =============================================

/**
 * Get a value from a row, trying multiple possible column names.
 * Returns the first non-empty match.
 */
export function getCol(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== '') return val;
  }
  return '';
}

// =============================================
// COURSE VISIBILITY
// =============================================

export function normalizeCourseVisibility(raw: string): 'public' | 'private' {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'private') return 'private';
  return 'public';
}

// =============================================
// DUPLICATE DETECTION
// =============================================

/**
 * Detect duplicate rows in a dataset by a key function.
 * Returns a map of key -> array of row numbers that share that key.
 */
export function detectDuplicateRows(
  rows: Record<string, string>[],
  keyFn: (row: Record<string, string>) => string,
): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const key = keyFn(rows[i]);
    if (!key) continue;
    const existing = seen.get(key);
    if (existing) {
      existing.push(i + 2); // 1-indexed + header
    } else {
      seen.set(key, [i + 2]);
    }
  }
  // Return only actual duplicates
  const duplicates = new Map<string, number[]>();
  for (const [key, rowNums] of seen) {
    if (rowNums.length > 1) {
      duplicates.set(key, rowNums);
    }
  }
  return duplicates;
}

// =============================================
// REPORT TYPES
// =============================================

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportStats {
  total: number;
  valid: number;
  inserted: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: ImportError[];
}

export function emptyStats(): ImportStats {
  return { total: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, invalid: 0, errors: [] };
}
