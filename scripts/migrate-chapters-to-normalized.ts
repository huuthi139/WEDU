/**
 * Migration Script: Create videos table + Populate videos, course_sections, lessons
 * from existing chapters JSON data (Supabase chapters table + fallback)
 *
 * Usage: npx tsx scripts/migrate-chapters-to-normalized.ts
 *
 * SAFE: Does NOT delete any existing data.
 * IDEMPOTENT: Skips videos/sections/lessons that already exist.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create proxy-aware fetch
function createProxyFetch(): typeof globalThis.fetch | undefined {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxyUrl) return undefined;
  try {
    const { ProxyAgent, fetch: undiciFetch } = require('undici');
    const agent = new ProxyAgent(proxyUrl);
    return ((url: RequestInfo | URL, init?: RequestInit) =>
      undiciFetch(url, { ...init, dispatcher: agent } as never)) as typeof globalThis.fetch;
  } catch {
    console.warn('undici not available for proxy support');
    return undefined;
  }
}

const proxyFetch = createProxyFetch();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  ...(proxyFetch ? { global: { fetch: proxyFetch } } : {}),
});

// Helper to make raw SQL calls via Supabase REST
async function execSql(sql: string): Promise<{ data: any; error: string | null }> {
  const fetchFn = proxyFetch || globalThis.fetch;
  // Use Supabase's pg-meta SQL endpoint
  const resp = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    return { data: null, error: text };
  }
  try {
    return { data: JSON.parse(text), error: null };
  } catch {
    return { data: text, error: null };
  }
}

// =============================================
// Types
// =============================================
interface ChapterLesson {
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
  lessons: ChapterLesson[];
}

interface ParsedVideo {
  source: 'bunny' | 'youtube';
  video_id: string;
  library_id: string | null;
  url: string;
}

// =============================================
// URL Parsing
// =============================================
function parseDirectPlayUrl(url: string): ParsedVideo | null {
  if (!url) return null;

  // Bunny embed: https://iframe.mediadelivery.net/embed/598901/UUID
  const bunnyEmbedMatch = url.match(
    /iframe\.mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/i
  );
  if (bunnyEmbedMatch) {
    return {
      source: 'bunny',
      library_id: bunnyEmbedMatch[1],
      video_id: bunnyEmbedMatch[2],
      url,
    };
  }

  // Bunny play: https://iframe.mediadelivery.net/play/607264/UUID
  const bunnyPlayMatch = url.match(
    /iframe\.mediadelivery\.net\/play\/(\d+)\/([a-f0-9-]+)/i
  );
  if (bunnyPlayMatch) {
    return {
      source: 'bunny',
      library_id: bunnyPlayMatch[1],
      video_id: bunnyPlayMatch[2],
      url,
    };
  }

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (ytMatch) {
    return {
      source: 'youtube',
      library_id: null,
      video_id: ytMatch[1],
      url,
    };
  }

  return null;
}

function mapRequiredLevel(level: string): 'free' | 'premium' | 'vip' {
  const n = (level || '').toLowerCase().trim();
  if (n === 'vip') return 'vip';
  if (n === 'premium') return 'premium';
  return 'free';
}

// =============================================
// Phase 1A: Create tables via SQL
// =============================================
async function createTables(): Promise<boolean> {
  console.log('\n=== PHASE 1A: CREATE / ALTER TABLES ===');

  // Check if videos table exists
  const { error: checkErr } = await supabase.from('videos').select('id').limit(1);

  if (checkErr && checkErr.message.includes('Could not find')) {
    console.log('  videos table does not exist. Creating via psql...');

    // Read SQL file and execute via psql
    const fs = require('fs');
    const sqlPath = path.resolve(__dirname, '../supabase/migrations/008_videos_and_data_migration.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error('  SQL migration file not found:', sqlPath);
      return false;
    }

    // Execute SQL using the Supabase database connection
    // We'll use the REST API to create the table by inserting through a workaround
    // Actually, let's use pg directly since psql is available
    const { execSync } = require('child_process');

    // Build psql connection string for Supabase
    // Default Supabase connection: postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres
    // But we don't have the DB password. Let's try using the service role key approach.

    // Alternative: Create table via individual REST API calls
    // Since we can't run DDL via REST, let's create a workaround:
    // Use the Supabase Management API or just manually construct SQL via pg

    console.log('  Attempting to create videos table via direct REST...');

    // We'll try to use a postgres function if available, or create the table structure
    // by using the raw SQL endpoint

    // Try creating a temporary function
    const createFnSql = `
      CREATE OR REPLACE FUNCTION public.exec_migration_008()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        CREATE TABLE IF NOT EXISTS public.videos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          source TEXT NOT NULL CHECK (source IN ('bunny', 'youtube')),
          video_id TEXT NOT NULL,
          library_id TEXT,
          url TEXT,
          duration TEXT DEFAULT '',
          thumbnail_url TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_videos_source ON public.videos(source);
        CREATE INDEX IF NOT EXISTS idx_videos_video_id ON public.videos(video_id);

        ALTER TABLE public.lessons
          ADD COLUMN IF NOT EXISTS video_ref_id UUID REFERENCES public.videos(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_lessons_video_ref ON public.lessons(video_ref_id);

        ALTER TABLE public.course_sections
          ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

        UPDATE public.course_sections SET order_index = sort_order WHERE order_index = 0 AND sort_order != 0;

        ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS videos_read_all ON public.videos;
        CREATE POLICY videos_read_all ON public.videos FOR SELECT USING (true);
        DROP POLICY IF EXISTS videos_insert_service ON public.videos;
        CREATE POLICY videos_insert_service ON public.videos FOR INSERT WITH CHECK (true);
        DROP POLICY IF EXISTS videos_update_service ON public.videos;
        CREATE POLICY videos_update_service ON public.videos FOR UPDATE USING (true);
        DROP POLICY IF EXISTS videos_delete_service ON public.videos;
        CREATE POLICY videos_delete_service ON public.videos FOR DELETE USING (true);
      END;
      $$;
    `;

    // Try to create this function via REST
    const { error: fnErr } = await supabase.rpc('exec_migration_008');

    if (fnErr) {
      // Function doesn't exist yet, we need another way
      // Let's try direct pg connection
      console.log('  RPC not available, trying pg module...');

      try {
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Use Supabase's pooler connection
        // Connection string format: postgresql://postgres.[ref]:[service_role_key]@[host]:6543/postgres
        const ref = 'fmctniqxvkcfcqzpaalc';
        const connStr = `postgresql://postgres.${ref}:${SUPABASE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`;

        const { Client } = require('pg');

        // Try multiple connection approaches
        const configs = [
          // Session mode pooler
          { connectionString: `postgresql://postgres.${ref}:${SUPABASE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`, ssl: { rejectUnauthorized: false } },
          // Direct connection
          { connectionString: `postgresql://postgres:${SUPABASE_KEY}@db.${ref}.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } },
          // Transaction mode pooler
          { connectionString: `postgresql://postgres.${ref}:${SUPABASE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`, ssl: { rejectUnauthorized: false } },
        ];

        let connected = false;
        for (const config of configs) {
          try {
            console.log(`  Trying connection...`);
            const client = new Client(config);
            await client.connect();
            console.log('  Connected! Running migration SQL...');
            await client.query(sqlContent);
            await client.end();
            connected = true;
            console.log('  ✓ SQL migration executed successfully');
            break;
          } catch (connErr: any) {
            console.log(`  Connection failed: ${connErr.message?.substring(0, 80)}`);
          }
        }

        if (!connected) {
          console.error('  ✗ Could not connect to database directly.');
          console.error('  Please run the SQL migration manually:');
          console.error('  Copy supabase/migrations/008_videos_and_data_migration.sql');
          console.error('  and run it in Supabase Dashboard → SQL Editor');
          return false;
        }
      } catch (pgErr: any) {
        console.error('  pg connection failed:', pgErr.message);
        return false;
      }
    } else {
      console.log('  ✓ Migration function executed successfully');
    }

    // Verify table was created
    const { error: verifyErr } = await supabase.from('videos').select('id').limit(1);
    if (verifyErr && verifyErr.message.includes('Could not find')) {
      console.error('  ✗ videos table still not found after migration!');
      return false;
    }
  }

  console.log('  ✓ videos table exists');

  // Check course_sections
  const { error: csErr } = await supabase.from('course_sections').select('id').limit(1);
  if (csErr) {
    console.error('  ✗ course_sections:', csErr.message);
    return false;
  }
  console.log('  ✓ course_sections table exists');

  // Check lessons
  const { error: lErr } = await supabase.from('lessons').select('id').limit(1);
  if (lErr) {
    console.error('  ✗ lessons:', lErr.message);
    return false;
  }
  console.log('  ✓ lessons table exists');

  return true;
}

// =============================================
// Fetch chapters from Supabase
// =============================================
async function fetchChaptersFromSupabase(): Promise<Record<string, Chapter[]>> {
  console.log('\n  Fetching chapters from Supabase...');
  const result: Record<string, Chapter[]> = {};

  for (const courseId of ['1', '6']) {
    const { data, error } = await supabase
      .from('chapters')
      .select('chapters_json')
      .eq('course_id', courseId)
      .limit(1)
      .single();

    if (!error && data?.chapters_json) {
      result[courseId] = data.chapters_json as Chapter[];
      console.log(`    Course ${courseId}: ${result[courseId].length} chapters from Supabase`);
    } else {
      console.log(`    Course ${courseId}: not found in chapters table`);
    }
  }
  return result;
}

// =============================================
// Video upsert with dedup
// =============================================
const videoCache = new Map<string, string>(); // "video_id|library_id" -> uuid

async function upsertVideo(
  parsed: ParsedVideo,
  title: string,
  duration: string,
  thumbnail: string,
): Promise<string | null> {
  const cacheKey = `${parsed.video_id}|${parsed.library_id || ''}`;
  if (videoCache.has(cacheKey)) return videoCache.get(cacheKey)!;

  // Check DB
  let query = supabase.from('videos').select('id').eq('video_id', parsed.video_id);
  if (parsed.library_id) {
    query = query.eq('library_id', parsed.library_id);
  } else {
    query = query.is('library_id', null);
  }
  const { data: existing } = await query.limit(1).maybeSingle();

  if (existing) {
    videoCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from('videos')
    .insert({
      title,
      source: parsed.source,
      video_id: parsed.video_id,
      library_id: parsed.library_id,
      url: parsed.url,
      duration: duration || '',
      thumbnail_url: thumbnail || '',
    })
    .select('id')
    .single();

  if (error) {
    // Might be duplicate due to race condition, try select again
    if (error.code === '23505') {
      const { data: retry } = await query.limit(1).maybeSingle();
      if (retry) {
        videoCache.set(cacheKey, retry.id);
        return retry.id;
      }
    }
    console.error(`    ✗ Video insert "${title}": ${error.message}`);
    return null;
  }

  videoCache.set(cacheKey, inserted.id);
  return inserted.id;
}

// =============================================
// Main migration
// =============================================
async function migrateData() {
  console.log('\n=== PHASE 1B: MIGRATE DATA ===');

  const supabaseChapters = await fetchChaptersFromSupabase();

  // Load fallback
  let fallbackChapters: Record<string, Chapter[]> = {};
  try {
    const fb = require('../lib/fallback-chapters');
    fallbackChapters = fb.FALLBACK_CHAPTERS;
  } catch {
    console.warn('  Could not load fallback chapters');
  }

  const stats = {
    videosInserted: 0,
    sectionsInserted: 0,
    lessonsInserted: 0,
    lessonsUpdated: 0,
    errors: [] as string[],
    perCourse: {} as Record<string, { sections: number; lessons: number }>,
  };

  for (const courseId of ['1', '6']) {
    const chapters: Chapter[] = supabaseChapters[courseId] || fallbackChapters[courseId];

    if (!chapters || chapters.length === 0) {
      stats.errors.push(`Course ${courseId}: No chapter data found!`);
      continue;
    }

    console.log(`\n--- Course ${courseId}: ${chapters.length} chapters ---`);
    stats.perCourse[courseId] = { sections: 0, lessons: 0 };

    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      const chapter = chapters[chIdx];
      const chTitle = chapter.title || `Chapter ${chIdx}`;

      // Check existing section
      const { data: existingSec } = await supabase
        .from('course_sections')
        .select('id')
        .eq('course_id', courseId)
        .eq('title', chTitle)
        .limit(1)
        .maybeSingle();

      let sectionId: string;
      if (existingSec) {
        sectionId = existingSec.id;
      } else {
        const insertData: Record<string, any> = {
          course_id: courseId,
          title: chTitle,
          sort_order: chIdx,
        };

        const { data: sec, error: secErr } = await supabase
          .from('course_sections')
          .insert(insertData)
          .select('id')
          .single();

        if (secErr || !sec) {
          stats.errors.push(`Section "${chTitle}" (course ${courseId}): ${secErr?.message}`);
          continue;
        }
        sectionId = sec.id;
        stats.sectionsInserted++;
        stats.perCourse[courseId].sections++;
        console.log(`  ✓ Section "${chTitle}"`);
      }

      // Process lessons
      for (let lIdx = 0; lIdx < (chapter.lessons || []).length; lIdx++) {
        const lesson = chapter.lessons[lIdx];
        const parsed = parseDirectPlayUrl(lesson.directPlayUrl);
        let videoRefId: string | null = null;

        if (parsed) {
          videoRefId = await upsertVideo(parsed, lesson.title, lesson.duration || '', lesson.thumbnail || '');
          if (videoRefId) stats.videosInserted++; // counts attempts, deduped by cache
        }

        // Check existing lesson
        const { data: existingLesson } = await supabase
          .from('lessons')
          .select('id, video_ref_id')
          .eq('course_id', courseId)
          .eq('section_id', sectionId)
          .eq('title', lesson.title)
          .limit(1)
          .maybeSingle();

        if (existingLesson) {
          // Update video_ref_id if missing
          if (videoRefId && !existingLesson.video_ref_id) {
            await supabase.from('lessons')
              .update({ video_ref_id: videoRefId })
              .eq('id', existingLesson.id);
            stats.lessonsUpdated++;
          }
          continue;
        }

        const accessTier = mapRequiredLevel(lesson.requiredLevel);
        const { error: lesErr } = await supabase
          .from('lessons')
          .insert({
            course_id: courseId,
            section_id: sectionId,
            title: lesson.title,
            description: '',
            duration: lesson.duration || '',
            duration_seconds: 0,
            video_url: '',
            direct_play_url: lesson.directPlayUrl || '',
            is_preview: accessTier === 'free',
            sort_order: lIdx,
            access_tier: accessTier,
            lesson_type: 'video',
            video_id: parsed?.video_id || '',
            video_ref_id: videoRefId,
            status: 'published',
          });

        if (lesErr) {
          stats.errors.push(`Lesson "${lesson.title}": ${lesErr.message}`);
          continue;
        }
        stats.lessonsInserted++;
        stats.perCourse[courseId].lessons++;
      }
    }
  }

  return stats;
}

// =============================================
// Verify
// =============================================
async function verify() {
  console.log('\n=== PHASE 1C: VERIFY ===');

  const queries = await Promise.all([
    supabase.from('videos').select('*', { count: 'exact', head: true }),
    supabase.from('course_sections').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase.from('course_sections').select('id').eq('course_id', '6'),
    supabase.from('course_sections').select('id').eq('course_id', '1'),
    supabase.from('lessons').select('*', { count: 'exact', head: true }).not('video_ref_id', 'is', null),
    supabase.from('lessons').select('*', { count: 'exact', head: true }).is('video_ref_id', null),
  ]);

  const [videos, sections, lessons, c6sec, c1sec, withVid, noVid] = queries;

  console.log(`  Videos total: ${videos.count}`);
  console.log(`  Sections total: ${sections.count}`);
  console.log(`  Lessons total: ${lessons.count}`);
  console.log(`  Course 6 sections: ${c6sec.data?.length || 0}`);
  console.log(`  Course 1 sections: ${c1sec.data?.length || 0}`);
  console.log(`  Lessons WITH video FK: ${withVid.count}`);
  console.log(`  Lessons WITHOUT video FK: ${noVid.count}`);

  return {
    videoCount: videos.count,
    sectionCount: sections.count,
    lessonCount: lessons.count,
    course6Sections: c6sec.data?.length || 0,
    course1Sections: c1sec.data?.length || 0,
    lessonsWithVideo: withVid.count,
  };
}

// =============================================
// Main
// =============================================
async function main() {
  console.log('===========================================');
  console.log('WEDU Migration: Chapters → Normalized Tables');
  console.log('===========================================');

  // Phase 1A
  const ok = await createTables();
  if (!ok) {
    console.error('\n✗ FAIL: Tables not ready. Stopping.');
    process.exit(1);
  }

  // Phase 1B
  const stats = await migrateData();

  // Phase 1C
  const v = await verify();

  // Report
  console.log('\n===========================================');
  console.log('=== MIGRATION REPORT ===');
  console.log('===========================================');
  console.log(`  1. Tables: ✓ (videos, course_sections, lessons)`);
  console.log(`  2. Videos in DB: ${v.videoCount}`);
  console.log(`  3. Sections: Course 1 = ${v.course1Sections}, Course 6 = ${v.course6Sections}`);
  console.log(`  4. Lessons total: ${v.lessonCount}`);
  console.log(`  5. Lessons with video FK: ${v.lessonsWithVideo}`);
  console.log('');
  console.log('  This run inserted:');
  console.log(`    Sections: ${stats.sectionsInserted}`);
  console.log(`    Lessons: ${stats.lessonsInserted}`);
  console.log(`    Lessons updated (video FK): ${stats.lessonsUpdated}`);
  for (const [cid, s] of Object.entries(stats.perCourse)) {
    console.log(`    Course ${cid}: ${s.sections} sections, ${s.lessons} lessons`);
  }

  if (stats.errors.length > 0) {
    console.log(`\n  ⚠ Errors (${stats.errors.length}):`);
    for (const err of stats.errors) {
      console.log(`    - ${err}`);
    }
    process.exit(1);
  } else {
    console.log('\n  ✓ No errors!');
  }
  console.log('===========================================');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
