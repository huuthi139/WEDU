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
 * Parse Vietnamese-formatted number (e.g., "1.868.000" or "4,8") to a JS number.
 * Handles: dots as thousands separators, comma as decimal separator.
 */
function parseVietnameseNumber(str: string): number {
  if (!str) return 0;
  // Remove all non-numeric chars except dots and commas
  let cleaned = str.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  // If has both dots and commas, dots are thousands separators, comma is decimal
  // If only dots: check if last dot could be decimal (e.g., "4.8" vs "1.868.000")
  // If only commas: comma is decimal separator
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (commaCount > 0) {
    // Commas present: dots are thousands separators, last comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(/,/, '.');
  } else if (dotCount > 1) {
    // Multiple dots: all are thousands separators (e.g., "1.868.000")
    cleaned = cleaned.replace(/\./g, '');
  } else if (dotCount === 1) {
    // Single dot: could be decimal (4.8) or thousands (1.868)
    // If 3 digits after dot, it's thousands separator
    const parts = cleaned.split('.');
    if (parts[1] && parts[1].length === 3) {
      cleaned = cleaned.replace('.', '');
    }
    // Otherwise keep as decimal
  }

  return parseFloat(cleaned) || 0;
}

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
 * Derive memberLevel from price when not specified in Google Sheets.
 * Matches the pricing tiers from the actual course data.
 */
function deriveMemberLevel(price: number): MemberLevel {
  if (price >= 38000000) return 'VIP';
  if (price >= 10000000) return 'Premium';
  return 'Free';
}

/**
 * Transform a raw Google Sheet row into a Course object
 */
function rowToCourse(row: Record<string, string>): Course | null {
  const id = (row['ID'] || row['id'] || '').trim();
  const title = (row['Title'] || row['title'] || '').trim();
  if (!id || !title) return null;

  const price = parseVietnameseNumber(row['Price'] || row['price'] || '0');
  const originalPriceRaw = parseVietnameseNumber(row['OriginalPrice'] || row['originalPrice'] || row['Original Price'] || '0');
  const originalPrice = originalPriceRaw > 0 ? originalPriceRaw : undefined;
  const rating = parseVietnameseNumber(row['Rating'] || row['rating'] || '0');
  const reviewsCount = Math.round(parseVietnameseNumber(row['ReviewsCount'] || row['reviewsCount'] || row['Reviews Count'] || '0'));
  const enrollmentsCount = Math.round(parseVietnameseNumber(row['EnrollmentsCount'] || row['enrollmentsCount'] || row['Enrollments Count'] || '0'));
  const duration = Math.round(parseVietnameseNumber(row['Duration'] || row['duration'] || '0'));
  const lessonsCount = Math.round(parseVietnameseNumber(row['LessonsCount'] || row['lessonsCount'] || row['Lessons Count'] || '0'));
  const badge = (row['Badge'] || row['badge'] || '').trim() as Course['badge'] || undefined;
  const category = (row['Category'] || row['category'] || '').trim();
  const memberLevel = (row['MemberLevel'] || row['memberLevel'] || row['Member Level'] || '').trim() as MemberLevel;
  // Determine memberLevel from price if not specified in sheet
  const effectiveMemberLevel = (['Free', 'Premium', 'VIP'].includes(memberLevel) ? memberLevel : deriveMemberLevel(price)) as MemberLevel;

  return {
    id,
    thumbnail: (row['Thumbnail'] || row['thumbnail'] || '').trim(),
    title,
    description: (row['Description'] || row['description'] || '').trim(),
    instructor: (row['Instructor'] || row['instructor'] || 'WePower Academy').trim(),
    price,
    originalPrice,
    rating: Math.min(5, Math.max(0, rating)),
    reviewsCount,
    enrollmentsCount,
    duration,
    lessonsCount,
    isFree: price === 0,
    badge: badge && ['NEW', 'BESTSELLER', 'PREMIUM'].includes(badge) ? badge : undefined,
    category,
    memberLevel: effectiveMemberLevel,
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
