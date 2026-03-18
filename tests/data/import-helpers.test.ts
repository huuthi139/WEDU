import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  isValidEmail,
  normalizeAccessTier,
  normalizeAccessStatus,
  normalizeAccessSource,
  normalizeSystemRole,
  normalizeUserStatus,
  normalizeCourseStatus,
  normalizeCourseVisibility,
  mergeAccessTier,
  parseDate,
  parseCSV,
  getCol,
  detectDuplicateRows,
  emptyStats,
} from '@/lib/import/helpers';

describe('Import Helpers', () => {
  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Test@Gmail.COM  ')).toBe('test@gmail.com');
    });
    it('handles empty', () => {
      expect(normalizeEmail('')).toBe('');
    });
  });

  describe('isValidEmail', () => {
    it('validates correct emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co')).toBe(true);
    });
    it('rejects invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@no-user.com')).toBe(false);
    });
  });

  describe('normalizeAccessTier', () => {
    it('normalizes tier values', () => {
      expect(normalizeAccessTier('free')).toBe('free');
      expect(normalizeAccessTier('PREMIUM')).toBe('premium');
      expect(normalizeAccessTier('VIP')).toBe('vip');
      expect(normalizeAccessTier('vip')).toBe('vip');
    });
    it('returns null for invalid', () => {
      expect(normalizeAccessTier('gold')).toBe(null);
      expect(normalizeAccessTier('')).toBe(null);
    });
  });

  describe('mergeAccessTier', () => {
    it('upgrades when upgradeOnly is true', () => {
      expect(mergeAccessTier('free', 'premium', true)).toBe('premium');
      expect(mergeAccessTier('premium', 'vip', true)).toBe('vip');
    });
    it('does not downgrade when upgradeOnly is true', () => {
      expect(mergeAccessTier('vip', 'free', true)).toBe('vip');
      expect(mergeAccessTier('premium', 'free', true)).toBe('premium');
    });
    it('allows downgrade when upgradeOnly is false', () => {
      expect(mergeAccessTier('vip', 'free', false)).toBe('free');
    });
  });

  describe('normalizeSystemRole', () => {
    it('maps roles correctly', () => {
      expect(normalizeSystemRole('admin')).toBe('admin');
      expect(normalizeSystemRole('instructor')).toBe('instructor');
      expect(normalizeSystemRole('student')).toBe('student');
      expect(normalizeSystemRole('')).toBe('student');
      expect(normalizeSystemRole('giảng viên')).toBe('instructor');
    });
  });

  describe('normalizeAccessSource', () => {
    it('accepts valid sources including import', () => {
      expect(normalizeAccessSource('import')).toBe('import');
      expect(normalizeAccessSource('manual')).toBe('manual');
      expect(normalizeAccessSource('order')).toBe('order');
    });
    it('defaults to import for unknown', () => {
      expect(normalizeAccessSource('')).toBe('import');
      expect(normalizeAccessSource('unknown')).toBe('import');
    });
  });

  describe('normalizeCourseStatus', () => {
    it('normalizes valid statuses', () => {
      expect(normalizeCourseStatus('draft')).toBe('draft');
      expect(normalizeCourseStatus('published')).toBe('published');
      expect(normalizeCourseStatus('archived')).toBe('archived');
    });
    it('defaults to published', () => {
      expect(normalizeCourseStatus('')).toBe('published');
    });
  });

  describe('normalizeCourseVisibility', () => {
    it('normalizes visibility', () => {
      expect(normalizeCourseVisibility('public')).toBe('public');
      expect(normalizeCourseVisibility('private')).toBe('private');
      expect(normalizeCourseVisibility('')).toBe('public');
    });
  });

  describe('parseDate', () => {
    it('parses ISO dates', () => {
      const result = parseDate('2026-03-18T00:00:00.000Z');
      expect(result).not.toBe(null);
    });
    it('parses DD/MM/YYYY', () => {
      const result = parseDate('18/03/2026');
      expect(result).not.toBe(null);
    });
    it('returns null for empty', () => {
      expect(parseDate('')).toBe(null);
    });
  });

  describe('parseCSV', () => {
    it('parses basic CSV', () => {
      const csv = 'name,email\nAlice,alice@test.com\nBob,bob@test.com';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(2);
      expect(rows[0].name).toBe('Alice');
      expect(rows[1].email).toBe('bob@test.com');
    });
    it('handles quoted fields', () => {
      const csv = 'name,desc\n"Alice, Jr.","A ""quoted"" desc"';
      const rows = parseCSV(csv);
      expect(rows[0].name).toBe('Alice, Jr.');
      expect(rows[0].desc).toBe('A "quoted" desc');
    });
    it('returns empty for header-only', () => {
      expect(parseCSV('name,email')).toEqual([]);
    });
  });

  describe('getCol', () => {
    it('returns first non-empty match', () => {
      const row = { email: '', Email: 'test@a.com' };
      expect(getCol(row, 'email', 'Email')).toBe('test@a.com');
    });
    it('returns empty if none match', () => {
      expect(getCol({ a: '' }, 'b', 'c')).toBe('');
    });
  });

  describe('detectDuplicateRows', () => {
    it('detects duplicates', () => {
      const rows = [
        { email: 'a@test.com' },
        { email: 'b@test.com' },
        { email: 'a@test.com' },
      ];
      const dups = detectDuplicateRows(rows, r => r.email);
      expect(dups.has('a@test.com')).toBe(true);
      expect(dups.get('a@test.com')).toEqual([2, 4]); // 1-indexed + header
    });
    it('returns empty for no duplicates', () => {
      const rows = [{ email: 'a@test.com' }, { email: 'b@test.com' }];
      const dups = detectDuplicateRows(rows, r => r.email);
      expect(dups.size).toBe(0);
    });
  });

  describe('emptyStats', () => {
    it('returns all zeros', () => {
      const s = emptyStats();
      expect(s.total).toBe(0);
      expect(s.errors).toEqual([]);
    });
  });
});
