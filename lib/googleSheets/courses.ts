/**
 * Google Sheets Course Data Fetcher
 *
 * Architecture: Google Sheets is the PRIMARY data source for courses.
 * Flow: Google Sheets CSV → Parse → Transform → Cache → Frontend
 *
 * Google Sheet "Courses" tab columns:
 * ID | Title | Description | Thumbnail | Instructor | Price | OriginalPrice |
 * Rating | ReviewsCount | EnrollmentsCount | Duration | LessonsCount |
 * Badge | Category | MemberLevel
 */

import type { Course, MemberLevel } from '@/lib/types';

const FETCH_TIMEOUT = 15000;

/**
 * Parse CSV text into array of row objects keyed by header names.
 * Handles quoted fields with embedded commas and escaped quotes.
 */
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]);
  return lines
    .slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cols = parseRow(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || '';
      });
      return row;
    });
}

/**
 * Transform a raw Google Sheet row into a Course object
 */
function rowToCourse(row: Record<string, string>): Course | null {
  const id = (row['ID'] || row['id'] || '').trim();
  const title = (row['Title'] || row['title'] || '').trim();
  if (!id || !title) return null;

  const price = parseFloat(row['Price'] || row['price'] || '0') || 0;
  const originalPrice = parseFloat(row['OriginalPrice'] || row['originalPrice'] || row['Original Price'] || '0') || undefined;
  const rating = parseFloat(row['Rating'] || row['rating'] || '0') || 0;
  const reviewsCount = parseInt(row['ReviewsCount'] || row['reviewsCount'] || row['Reviews Count'] || '0', 10) || 0;
  const enrollmentsCount = parseInt(row['EnrollmentsCount'] || row['enrollmentsCount'] || row['Enrollments Count'] || '0', 10) || 0;
  const duration = parseInt(row['Duration'] || row['duration'] || '0', 10) || 0;
  const lessonsCount = parseInt(row['LessonsCount'] || row['lessonsCount'] || row['Lessons Count'] || '0', 10) || 0;
  const badge = (row['Badge'] || row['badge'] || '').trim() as Course['badge'] || undefined;
  const category = (row['Category'] || row['category'] || '').trim();
  const memberLevel = (row['MemberLevel'] || row['memberLevel'] || row['Member Level'] || 'Free').trim() as MemberLevel;

  return {
    id,
    thumbnail: (row['Thumbnail'] || row['thumbnail'] || '').trim(),
    title,
    description: (row['Description'] || row['description'] || '').trim(),
    instructor: (row['Instructor'] || row['instructor'] || 'WEDU').trim(),
    price,
    originalPrice: originalPrice && originalPrice > 0 ? originalPrice : undefined,
    rating: Math.min(5, Math.max(0, rating)),
    reviewsCount,
    enrollmentsCount,
    duration,
    lessonsCount,
    isFree: price === 0,
    badge: badge && ['NEW', 'BESTSELLER', 'PREMIUM'].includes(badge) ? badge : undefined,
    category,
    memberLevel: ['Free', 'Premium', 'VIP'].includes(memberLevel) ? memberLevel : 'Free',
  };
}

/**
 * Fetch all courses from Google Sheets CSV export.
 * Uses the public CSV export URL (sheet must be shared as "Anyone with the link").
 */
export async function fetchCoursesFromSheet(sheetId: string): Promise<Course[]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Courses')}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(csvUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[GoogleSheets] Failed to fetch Courses CSV: HTTP ${res.status}`);
      return [];
    }

    const csv = await res.text();
    if (!csv.trim()) {
      console.warn('[GoogleSheets] Courses CSV is empty');
      return [];
    }

    const rows = parseCSV(csv);
    const courses: Course[] = [];

    for (const row of rows) {
      const course = rowToCourse(row);
      if (course) {
        courses.push(course);
      }
    }

    console.log(`[GoogleSheets] Fetched ${courses.length} courses from sheet`);
    return courses;
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GoogleSheets] Fetch courses error:', msg);
    return [];
  }
}

/**
 * Fetch a single course by ID from Google Sheets
 */
export async function fetchCourseByIdFromSheet(sheetId: string, courseId: string): Promise<Course | null> {
  const courses = await fetchCoursesFromSheet(sheetId);
  return courses.find(c => c.id === courseId) || null;
}
