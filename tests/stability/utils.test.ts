import { describe, it, expect } from 'vitest';
import { parseCSV, csvToObjects } from '@/lib/utils/csv';
import { fetchWithTimeout } from '@/lib/utils/fetch';
import { isAdminRole, isInstructorRole } from '@/lib/utils/auth';

describe('CSV Utils', () => {
  it('parseCSV handles basic CSV', () => {
    const csv = 'name,email,role\nAlice,alice@test.com,student\nBob,bob@test.com,admin';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['name', 'email', 'role']);
    expect(rows[1]).toEqual(['Alice', 'alice@test.com', 'student']);
  });

  it('parseCSV handles quoted fields with commas', () => {
    const csv = '"Khóa học A, B","desc, more","100,000"';
    const rows = parseCSV(csv);
    expect(rows[0][0]).toBe('Khóa học A, B');
    expect(rows[0][2]).toBe('100,000');
  });

  it('csvToObjects returns array of objects', () => {
    const csv = 'email,role\ntest@test.com,student';
    const objects = csvToObjects(csv);
    expect(objects).toHaveLength(1);
    expect(objects[0].email).toBe('test@test.com');
    expect(objects[0].role).toBe('student');
  });

  it('csvToObjects returns empty array for empty CSV', () => {
    expect(csvToObjects('')).toHaveLength(0);
    expect(csvToObjects('header')).toHaveLength(0);
  });
});

describe('Auth Utils', () => {
  it('isAdminRole returns true for admin', () => {
    expect(isAdminRole('admin')).toBe(true);
  });

  it('isAdminRole returns false for non-admin', () => {
    expect(isAdminRole('student')).toBe(false);
    expect(isAdminRole('instructor')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('isInstructorRole returns true for admin and instructor', () => {
    expect(isInstructorRole('admin')).toBe(true);
    expect(isInstructorRole('instructor')).toBe(true);
    expect(isInstructorRole('student')).toBe(false);
  });
});

describe('Fetch Utils', () => {
  it('fetchWithTimeout throws on timeout', async () => {
    const originalFetch = global.fetch;
    global.fetch = (_url: any, options: any) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    await expect(
      fetchWithTimeout('http://test.com', {}, 100)
    ).rejects.toThrow(/timeout/i);

    global.fetch = originalFetch;
  });
});
