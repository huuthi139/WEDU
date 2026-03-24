#!/usr/bin/env npx tsx
/**
 * Migration: Populate videos, course_sections, lessons from fallback-chapters.ts
 * Uses curl for all Supabase API calls (bypasses Node.js fetch proxy issues)
 *
 * Usage: npx tsx scripts/migrate-curl.ts
 */

import { execSync } from 'child_process';
import path from 'path';

// Load env manually
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SB_URL || !SB_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// =============================================
// curl helper
// =============================================
function curlGet(endpoint: string): any {
  const url = `${SB_URL}/rest/v1/${endpoint}`;
  const cmd = `curl -s "${url}" -H "apikey: ${SB_KEY}" -H "Authorization: Bearer ${SB_KEY}"`;
  const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

function curlPost(table: string, data: any): any {
  const url = `${SB_URL}/rest/v1/${table}`;
  const jsonStr = JSON.stringify(data).replace(/'/g, "'\\''");
  const cmd = `curl -s -X POST "${url}" \
    -H "apikey: ${SB_KEY}" \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '${jsonStr}'`;
  const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

function curlPatch(table: string, filter: string, data: any): any {
  const url = `${SB_URL}/rest/v1/${table}?${filter}`;
  const jsonStr = JSON.stringify(data).replace(/'/g, "'\\''");
  const cmd = `curl -s -X PATCH "${url}" \
    -H "apikey: ${SB_KEY}" \
    -H "Authorization: Bearer ${SB_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '${jsonStr}'`;
  const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

function curlCount(table: string, filter?: string): number {
  const filterStr = filter ? `&${filter}` : '';
  const url = `${SB_URL}/rest/v1/${table}?select=id${filterStr}`;
  const cmd = `curl -s "${url}" -H "apikey: ${SB_KEY}" -H "Authorization: Bearer ${SB_KEY}" -H "Prefer: count=exact" -I`;
  const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
  const match = result.match(/content-range:\s*\d+-\d+\/(\d+)/i) || result.match(/content-range:\s*\*\/(\d+)/i);
  return match ? parseInt(match[1]) : -1;
}

// =============================================
// Types
// =============================================
interface Lesson {
  id: string;
  title: string;
  duration: string;
  requiredLevel: string;
  directPlayUrl: string;
  thumbnail: string;
}

interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface ParsedVideo {
  source: 'bunny' | 'youtube';
  video_id: string;
  library_id: string | null;
  url: string;
}

// =============================================
// Parse URL
// =============================================
function parseUrl(url: string): ParsedVideo | null {
  if (!url) return null;
  const embed = url.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/i);
  if (embed) return { source: 'bunny', library_id: embed[1], video_id: embed[2], url };
  const play = url.match(/iframe\.mediadelivery\.net\/play\/(\d+)\/([a-f0-9-]+)/i);
  if (play) return { source: 'bunny', library_id: play[1], video_id: play[2], url };
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return { source: 'youtube', library_id: null, video_id: yt[1], url };
  return null;
}

function mapLevel(level: string): 'free' | 'premium' | 'vip' {
  const n = (level || '').toLowerCase().trim();
  if (n === 'vip') return 'vip';
  if (n === 'premium') return 'premium';
  return 'free';
}

// =============================================
// STEP 1: Read data from fallback-chapters
// =============================================
console.log('===========================================');
console.log('WEDU Migration: chapters → normalized tables');
console.log('===========================================');

console.log('\n=== STEP 1: Read fallback chapters ===');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FALLBACK_CHAPTERS } = require('../lib/fallback-chapters');

const courseData: Record<string, Chapter[]> = {
  '1': FALLBACK_CHAPTERS['1'] || [],
  '6': FALLBACK_CHAPTERS['6'] || [],
};

let totalChapters = 0;
let totalLessons = 0;
for (const [cid, chapters] of Object.entries(courseData)) {
  const lessonCount = chapters.reduce((sum: number, ch: Chapter) => sum + ch.lessons.length, 0);
  console.log(`  Course ${cid}: ${chapters.length} chapters, ${lessonCount} lessons`);
  totalChapters += chapters.length;
  totalLessons += lessonCount;
}
console.log(`  Total: ${totalChapters} chapters, ${totalLessons} lessons`);

if (totalChapters === 0) {
  console.error('✗ No chapter data found! STOPPING.');
  process.exit(1);
}

// =============================================
// STEP 2: Parse video info & deduplicate
// =============================================
console.log('\n=== STEP 2: Parse video info ===');

const uniqueVideos = new Map<string, { parsed: ParsedVideo; title: string; duration: string; thumbnail: string }>();

for (const chapters of Object.values(courseData)) {
  for (const ch of chapters) {
    for (const ls of ch.lessons) {
      const parsed = parseUrl(ls.directPlayUrl);
      if (parsed) {
        const key = `${parsed.video_id}|${parsed.library_id || ''}`;
        if (!uniqueVideos.has(key)) {
          uniqueVideos.set(key, { parsed, title: ls.title, duration: ls.duration || '', thumbnail: ls.thumbnail || '' });
        }
      }
    }
  }
}
console.log(`  Unique videos: ${uniqueVideos.size}`);
const bunnyCount = [...uniqueVideos.values()].filter(v => v.parsed.source === 'bunny').length;
const ytCount = [...uniqueVideos.values()].filter(v => v.parsed.source === 'youtube').length;
console.log(`  Bunny: ${bunnyCount}, YouTube: ${ytCount}`);

// =============================================
// STEP 3: Insert into Supabase via curl
// =============================================
console.log('\n=== STEP 3: Insert data ===');

const stats = {
  videosInserted: 0,
  videosSkipped: 0,
  sectionsInserted: 0,
  sectionsSkipped: 0,
  lessonsInserted: 0,
  lessonsSkipped: 0,
  errors: [] as string[],
};

// --- 3a: Insert videos ---
console.log('\n--- 3a: Insert videos ---');
const videoIdMap = new Map<string, string>(); // "video_id|library_id" -> UUID

// First, check existing videos
const existingVideos = curlGet('videos?select=id,video_id,library_id&limit=1000');
if (Array.isArray(existingVideos)) {
  for (const v of existingVideos) {
    videoIdMap.set(`${v.video_id}|${v.library_id || ''}`, v.id);
  }
  console.log(`  Existing videos in DB: ${existingVideos.length}`);
}

// Batch insert videos (in chunks of 20)
const videosToInsert: any[] = [];
for (const [key, { parsed, title, duration, thumbnail }] of uniqueVideos) {
  if (videoIdMap.has(key)) {
    stats.videosSkipped++;
    continue;
  }
  videosToInsert.push({
    title,
    source: parsed.source,
    video_id: parsed.video_id,
    library_id: parsed.library_id,
    url: parsed.url,
    duration,
    thumbnail_url: thumbnail,
  });
}

if (videosToInsert.length > 0) {
  const BATCH = 20;
  for (let i = 0; i < videosToInsert.length; i += BATCH) {
    const batch = videosToInsert.slice(i, i + BATCH);
    const result = curlPost('videos', batch);
    if (Array.isArray(result)) {
      for (const v of result) {
        videoIdMap.set(`${v.video_id}|${v.library_id || ''}`, v.id);
        stats.videosInserted++;
      }
      console.log(`  Inserted batch ${Math.floor(i / BATCH) + 1}: ${result.length} videos`);
    } else {
      const errMsg = typeof result === 'object' ? JSON.stringify(result) : result;
      console.error(`  ✗ Batch insert failed: ${errMsg}`);
      stats.errors.push(`Video batch insert: ${errMsg}`);
      // FAIL-SAFE
      if (stats.errors.length > 0) {
        console.error('\n✗ FAIL-SAFE: Error encountered. STOPPING.');
        console.error(stats.errors);
        process.exit(1);
      }
    }
  }
} else {
  console.log('  All videos already exist, skipping.');
}

console.log(`  Videos inserted: ${stats.videosInserted}, skipped: ${stats.videosSkipped}`);

// --- 3b: Insert course_sections ---
console.log('\n--- 3b: Insert course_sections ---');

// Get existing sections
const sectionIdMap = new Map<string, string>(); // "courseId|title" -> UUID
const existingSections = curlGet('course_sections?select=id,title,course_id&limit=100');
if (Array.isArray(existingSections)) {
  for (const s of existingSections) {
    sectionIdMap.set(`${s.course_id}|${s.title}`, s.id);
  }
  console.log(`  Existing sections: ${existingSections.length}`);
}

for (const [courseId, chapters] of Object.entries(courseData)) {
  for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
    const ch = chapters[chIdx];
    const key = `${courseId}|${ch.title}`;

    if (sectionIdMap.has(key)) {
      stats.sectionsSkipped++;
      continue;
    }

    const result = curlPost('course_sections', {
      course_id: courseId,
      title: ch.title,
      sort_order: chIdx,
    });

    if (Array.isArray(result) && result.length > 0) {
      sectionIdMap.set(key, result[0].id);
      stats.sectionsInserted++;
    } else {
      const errMsg = typeof result === 'object' ? JSON.stringify(result) : result;
      console.error(`  ✗ Section "${ch.title}": ${errMsg}`);
      stats.errors.push(`Section "${ch.title}": ${errMsg}`);
      console.error('\n✗ FAIL-SAFE: Error encountered. STOPPING.');
      process.exit(1);
    }
  }
  console.log(`  Course ${courseId}: inserted ${stats.sectionsInserted} sections`);
}

console.log(`  Sections inserted: ${stats.sectionsInserted}, skipped: ${stats.sectionsSkipped}`);

// --- 3c: Insert lessons ---
console.log('\n--- 3c: Insert lessons ---');

// Check existing lessons (if any)
const existingLessons = curlGet('lessons?select=id,title,section_id,course_id&limit=1000');
const existingLessonSet = new Set<string>();
if (Array.isArray(existingLessons)) {
  for (const l of existingLessons) {
    existingLessonSet.add(`${l.course_id}|${l.section_id}|${l.title}`);
  }
  console.log(`  Existing lessons: ${existingLessons.length}`);
}

for (const [courseId, chapters] of Object.entries(courseData)) {
  let courseInserted = 0;
  let courseSkipped = 0;

  for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
    const ch = chapters[chIdx];
    const sectionKey = `${courseId}|${ch.title}`;
    const sectionId = sectionIdMap.get(sectionKey);

    if (!sectionId) {
      stats.errors.push(`No section ID for "${ch.title}" course ${courseId}`);
      console.error('\n✗ FAIL-SAFE: Missing section. STOPPING.');
      process.exit(1);
    }

    // Batch lessons for this section
    const lessonsToInsert: any[] = [];

    for (let lIdx = 0; lIdx < ch.lessons.length; lIdx++) {
      const ls = ch.lessons[lIdx];
      const lessonKey = `${courseId}|${sectionId}|${ls.title}`;

      if (existingLessonSet.has(lessonKey)) {
        courseSkipped++;
        stats.lessonsSkipped++;
        continue;
      }

      const parsed = parseUrl(ls.directPlayUrl);
      let videoRefId: string | null = null;
      if (parsed) {
        const vKey = `${parsed.video_id}|${parsed.library_id || ''}`;
        videoRefId = videoIdMap.get(vKey) || null;
      }

      const accessTier = mapLevel(ls.requiredLevel);
      lessonsToInsert.push({
        course_id: courseId,
        section_id: sectionId,
        title: ls.title,
        description: '',
        duration: ls.duration || '',
        duration_seconds: 0,
        video_url: '',
        direct_play_url: ls.directPlayUrl || '',
        is_preview: accessTier === 'free',
        sort_order: lIdx,
        access_tier: accessTier,
        lesson_type: 'video',
        video_id: parsed?.video_id || '',
        video_ref_id: videoRefId,
        status: 'published',
      });
    }

    if (lessonsToInsert.length > 0) {
      // Insert in batches of 20
      const BATCH = 20;
      for (let i = 0; i < lessonsToInsert.length; i += BATCH) {
        const batch = lessonsToInsert.slice(i, i + BATCH);
        const result = curlPost('lessons', batch);
        if (Array.isArray(result)) {
          courseInserted += result.length;
          stats.lessonsInserted += result.length;
        } else {
          const errMsg = typeof result === 'object' ? JSON.stringify(result) : result;
          console.error(`  ✗ Lesson batch for "${ch.title}": ${errMsg}`);
          stats.errors.push(`Lesson batch "${ch.title}": ${errMsg}`);
          console.error('\n✗ FAIL-SAFE: Error encountered. STOPPING.');
          process.exit(1);
        }
      }
    }
  }

  console.log(`  Course ${courseId}: ${courseInserted} lessons inserted, ${courseSkipped} skipped`);
}

// =============================================
// STEP 4: Verify
// =============================================
console.log('\n=== STEP 4: VERIFY ===');

const vCount = curlCount('videos');
const sCount = curlCount('course_sections');
const lCount = curlCount('lessons');
console.log(`  Videos: ${vCount}`);
console.log(`  Sections: ${sCount}`);
console.log(`  Lessons: ${lCount}`);

// Course 6 sections
const c6secs = curlGet('course_sections?select=id,title&course_id=eq.6&limit=20');
console.log(`  Course 6 sections: ${Array.isArray(c6secs) ? c6secs.length : '?'}`);

// Course 1 sections
const c1secs = curlGet('course_sections?select=id,title&course_id=eq.1&limit=20');
console.log(`  Course 1 sections: ${Array.isArray(c1secs) ? c1secs.length : '?'}`);

// Sample lessons with video_ref_id
const sampleLessons = curlGet('lessons?select=id,title,video_ref_id,course_id&course_id=eq.6&video_ref_id=not.is.null&limit=3');
console.log(`  Sample course 6 lessons with video_ref_id:`);
if (Array.isArray(sampleLessons)) {
  for (const l of sampleLessons.slice(0, 3)) {
    console.log(`    - "${l.title}" → video_ref_id: ${l.video_ref_id}`);
  }
}

// =============================================
// STEP 5: Report
// =============================================
console.log('\n===========================================');
console.log('=== MIGRATION REPORT ===');
console.log('===========================================');
console.log(`  1. Tables: ✓ (videos, course_sections, lessons)`);
console.log(`  2. Videos inserted: ${stats.videosInserted}, skipped: ${stats.videosSkipped}, total: ${vCount}`);
console.log(`  3. Sections: Course 1 = ${Array.isArray(c1secs) ? c1secs.length : '?'}, Course 6 = ${Array.isArray(c6secs) ? c6secs.length : '?'} (inserted: ${stats.sectionsInserted}, skipped: ${stats.sectionsSkipped})`);
console.log(`  4. Lessons: total = ${lCount} (inserted: ${stats.lessonsInserted}, skipped: ${stats.lessonsSkipped})`);

if (stats.errors.length > 0) {
  console.log(`\n  ⚠ Errors (${stats.errors.length}):`);
  for (const err of stats.errors) {
    console.log(`    - ${err}`);
  }
} else {
  console.log(`\n  ✓ No errors!`);
}
console.log('===========================================');
