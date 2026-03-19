/**
 * Fix course_access data
 *
 * Logic:
 * 1. Read Google Sheet students (email + Level)
 * 2. Query Supabase for existing users and courses
 * 3. Build mapping: each user → all courses with their access_tier from Level
 * 4. Delete existing course_access records
 * 5. Insert correct records
 * 6. Verify
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = 'https://fmctniqxvkcfcqzpaalc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtY3RuaXF4dmtjZmNxenBhYWxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzE1MCwiZXhwIjoyMDg5MTY5MTUwfQ.x89LozBL7OiSHU4AjVZMXKiAsb8-8VItvvGVN0kXnHk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================
// Google Sheet data (parsed from CSV)
// ============================================================
interface SheetStudent {
  email: string;
  level: string; // Free, Premium, VIP
}

const SHEET_STUDENTS: SheetStudent[] = [
  { email: "admin@wepower.vn", level: "VIP" },
  { email: "admin2@wepower.vn", level: "VIP" },
  { email: "lyoanhnhi@gmail.com", level: "Premium" }, // appears twice, take highest: Premium > Free
  { email: "boreasson@gmail.com", level: "Premium" },
  { email: "tranglehip@gmail.com", level: "Premium" },
  { email: "dunglaocai68@gmail.com", level: "VIP" },
  { email: "nvd009@gmail.com", level: "Premium" },
  { email: "khanhtoan37@gmail.com", level: "Premium" },
  { email: "huynhforai@gmail.com", level: "Premium" },
  { email: "ngoxuanchinh0611@gmail.com", level: "VIP" },
  { email: "dongdinh1601@gmail.om", level: "Premium" },
  { email: "phamthihieunhi1980@gmail.com", level: "Premium" },
  { email: "khanhtd.bds@gmail.com", level: "Premium" },
  { email: "quoccuongtrieuphu@gmail.com", level: "Premium" },
  { email: "ndhai2308@gmail.com", level: "Premium" },
  { email: "thientuan0807@gmail.com", level: "VIP" },
  { email: "mmommo6868@gmail.com", level: "Premium" },
  { email: "nguyenvanthangnq96@gmail.com", level: "Premium" },
  { email: "ptdung1987@gmail.com", level: "Premium" },
  { email: "tranloi91vp@gmail.com", level: "Premium" },
  { email: "hhloc101@gmail.com", level: "VIP" },
  { email: "ducchinh568@gmail.com", level: "VIP" },
  { email: "nguyenngocanh14689@gmail.com", level: "VIP" },
  { email: "phungthanh1309@gmail.com", level: "VIP" },
  { email: "xehoithanhvinh@gmail.com", level: "Premium" },
  { email: "lechuong1994@gmail.com", level: "VIP" },
  { email: "phuonganhle785@gmail.com", level: "VIP" },
  { email: "quanuytin2704@gmail.com", level: "Premium" },
  { email: "nhatly1009@gmail.com", level: "Premium" },
  { email: "1hohoangphi1987@gmail.com", level: "Premium" },
  { email: "haclongkaka2012@gmail.com", level: "VIP" },
  { email: "kynguyen0405@gmail.com", level: "Premium" },
  { email: "daongocanh0808@gmail.com", level: "VIP" },
  { email: "kevintuan987@gmail.com", level: "Premium" },
  { email: "nguyen.doantung@gmail.com", level: "Premium" },
  { email: "thanhle.work102@gmail.com", level: "Premium" },
  { email: "ng.xuan.tien.01@gmail.com", level: "Premium" },
  { email: "kienmyg1998@gmail.com", level: "Premium" },
  { email: "cuchong031996@gmail.com", level: "Premium" },
  { email: "intruongthuan2021@gmail.com", level: "Premium" },
  { email: "m2mhung@gmail.com", level: "VIP" },
  { email: "dductruong22@gmail.com", level: "Premium" },
  { email: "nguyenthihan12a4@gmail.com", level: "Premium" },
  { email: "bentleylongnguyen@gmail.com", level: "Premium" },
  { email: "luuhuanvp@gmail.com", level: "Premium" },
  { email: "nguyenhuong144@gmail.com", level: "VIP" },
  { email: "testcurl@example.com", level: "Free" },
  { email: "testcurl2@example.com", level: "Free" },
];

// ============================================================
// HELPERS
// ============================================================
function levelToTier(level: string): 'free' | 'premium' | 'vip' {
  switch (level.toLowerCase()) {
    case 'vip': return 'vip';
    case 'premium': return 'premium';
    default: return 'free';
  }
}

const TIER_RANK: Record<string, number> = { free: 0, premium: 1, vip: 2 };

function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}

function logError(step: string, msg: string) {
  console.error(`[${step}] ERROR: ${msg}`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('='.repeat(60));
  console.log('FIX COURSE_ACCESS - START');
  console.log('='.repeat(60));

  // ── STEP 1: Deduplicate sheet students ──
  log('STEP1', 'Deduplicating Google Sheet students...');
  const emailMap = new Map<string, string>(); // email → highest level
  for (const s of SHEET_STUDENTS) {
    const email = s.email.toLowerCase().trim();
    const tier = levelToTier(s.level);
    const existing = emailMap.get(email);
    if (!existing || TIER_RANK[tier] > TIER_RANK[existing]) {
      emailMap.set(email, tier);
    }
  }
  log('STEP1', `Unique students from sheet: ${emailMap.size}`);
  const tierCounts = { free: 0, premium: 0, vip: 0 };
  for (const tier of emailMap.values()) {
    tierCounts[tier as keyof typeof tierCounts]++;
  }
  log('STEP1', `Distribution: Free=${tierCounts.free}, Premium=${tierCounts.premium}, VIP=${tierCounts.vip}`);

  // ── STEP 2: Query existing users from Supabase ──
  log('STEP2', 'Fetching users from Supabase...');
  const { data: dbUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .order('email');

  if (usersError) {
    logError('STEP2', `Failed to fetch users: ${usersError.message}`);
    process.exit(1);
  }
  log('STEP2', `Users in DB: ${dbUsers.length}`);

  // Build email→user_id lookup (case-insensitive)
  const userLookup = new Map<string, string>();
  for (const u of dbUsers) {
    userLookup.set(u.email.toLowerCase().trim(), u.id);
  }

  // ── STEP 3: Query existing courses from Supabase ──
  log('STEP3', 'Fetching courses from Supabase...');
  const { data: dbCourses, error: coursesError } = await supabase
    .from('courses')
    .select('id, title')
    .order('id');

  if (coursesError) {
    logError('STEP3', `Failed to fetch courses: ${coursesError.message}`);
    process.exit(1);
  }
  log('STEP3', `Courses in DB: ${dbCourses.length}`);
  for (const c of dbCourses) {
    log('STEP3', `  Course: ${c.id} - ${c.title}`);
  }

  const courseIds = dbCourses.map(c => c.id);

  // ── STEP 4: Build access mapping ──
  log('STEP4', 'Building access mapping...');

  interface AccessRecord {
    user_id: string;
    course_id: string;
    access_tier: string;
    status: string;
    activated_at: string;
    expires_at: null;
    source: string;
  }

  const records: AccessRecord[] = [];
  const unmatchedEmails: string[] = [];

  for (const [email, tier] of emailMap) {
    const userId = userLookup.get(email);
    if (!userId) {
      unmatchedEmails.push(email);
      continue;
    }
    for (const courseId of courseIds) {
      records.push({
        user_id: userId,
        course_id: courseId,
        access_tier: tier,
        status: 'active',
        activated_at: new Date().toISOString(),
        expires_at: null,
        source: 'import',
      });
    }
  }

  log('STEP4', `Total records to insert: ${records.length}`);
  log('STEP4', `Matched users: ${emailMap.size - unmatchedEmails.length}`);
  if (unmatchedEmails.length > 0) {
    log('STEP4', `Unmatched emails (not in DB): ${unmatchedEmails.join(', ')}`);
  }

  // Validate: no duplicates in our records
  const seen = new Set<string>();
  let dupes = 0;
  for (const r of records) {
    const key = `${r.user_id}|${r.course_id}`;
    if (seen.has(key)) {
      dupes++;
      logError('STEP4', `Duplicate: user_id=${r.user_id} course_id=${r.course_id}`);
    }
    seen.add(key);
  }
  if (dupes > 0) {
    logError('STEP4', `Found ${dupes} duplicates. STOPPING.`);
    process.exit(1);
  }
  log('STEP4', 'No duplicates detected in generated records.');

  // ── STEP 5: Check current state ──
  log('STEP5', 'Checking current course_access state...');
  const { count: currentCount, error: countError } = await supabase
    .from('course_access')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    logError('STEP5', `Failed to count: ${countError.message}`);
    process.exit(1);
  }
  log('STEP5', `Current course_access records: ${currentCount}`);

  // ── STEP 6: Delete all existing course_access ──
  log('STEP6', 'Deleting ALL existing course_access records...');

  // Supabase requires a filter for delete, so we delete where id is not null (all rows)
  const { error: deleteError } = await supabase
    .from('course_access')
    .delete()
    .not('id', 'is', null);

  if (deleteError) {
    logError('STEP6', `Failed to delete: ${deleteError.message}`);
    process.exit(1);
  }

  // Verify deletion
  const { count: afterDeleteCount } = await supabase
    .from('course_access')
    .select('*', { count: 'exact', head: true });
  log('STEP6', `Records after delete: ${afterDeleteCount}`);

  if (afterDeleteCount && afterDeleteCount > 0) {
    logError('STEP6', `Delete failed - still ${afterDeleteCount} records remaining. STOPPING.`);
    process.exit(1);
  }

  // ── STEP 7: Insert new records in batches ──
  log('STEP7', 'Inserting new course_access records...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('course_access')
      .insert(batch);

    if (insertError) {
      logError('STEP7', `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${insertError.message}`);
      errors++;
      // STOP on first error
      process.exit(1);
    }
    inserted += batch.length;
    log('STEP7', `Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records (total: ${inserted})`);
  }

  log('STEP7', `Total inserted: ${inserted}, Errors: ${errors}`);

  // ── STEP 8: Post-verify ──
  log('STEP8', 'Post-verification...');

  const { count: finalCount } = await supabase
    .from('course_access')
    .select('*', { count: 'exact', head: true });
  log('STEP8', `Final course_access count: ${finalCount}`);
  log('STEP8', `Expected: ${records.length}`);

  if (finalCount !== records.length) {
    logError('STEP8', `MISMATCH! Expected ${records.length} but got ${finalCount}`);
  } else {
    log('STEP8', 'COUNT MATCH OK');
  }

  // Check distribution per user
  const { data: distribution, error: distError } = await supabase
    .from('course_access')
    .select('user_id, access_tier');

  if (distError) {
    logError('STEP8', `Failed to fetch distribution: ${distError.message}`);
    process.exit(1);
  }

  const userCourseCounts = new Map<string, number>();
  const userTiers = new Map<string, Set<string>>();
  for (const row of distribution!) {
    userCourseCounts.set(row.user_id, (userCourseCounts.get(row.user_id) || 0) + 1);
    if (!userTiers.has(row.user_id)) userTiers.set(row.user_id, new Set());
    userTiers.get(row.user_id)!.add(row.access_tier);
  }

  log('STEP8', `Users with course_access: ${userCourseCounts.size}`);

  let anomalies = 0;
  for (const [userId, count] of userCourseCounts) {
    if (count !== courseIds.length) {
      logError('STEP8', `User ${userId} has ${count} courses (expected ${courseIds.length})`);
      anomalies++;
    }
    // Each user should have exactly 1 tier across all their courses
    const tiers = userTiers.get(userId)!;
    if (tiers.size !== 1) {
      logError('STEP8', `User ${userId} has mixed tiers: ${[...tiers].join(', ')}`);
      anomalies++;
    }
  }

  // Check for the old bug: no user should have 21 courses
  for (const [userId, count] of userCourseCounts) {
    if (count === 21) {
      logError('STEP8', `BUG STILL EXISTS: User ${userId} has 21 courses!`);
      anomalies++;
    }
  }

  // ── REPORT ──
  console.log('\n' + '='.repeat(60));
  console.log('FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`1. Data source: Google Sheet - ${emailMap.size} unique students, ${courseIds.length} courses`);
  console.log(`2. Records generated: ${records.length}`);
  console.log(`3. Validation: ${dupes} duplicates, ${unmatchedEmails.length} unmatched emails`);
  if (unmatchedEmails.length > 0) {
    console.log(`   Unmatched: ${unmatchedEmails.join(', ')}`);
  }
  console.log(`4. Insert result: ${inserted} inserted, ${errors} errors`);
  console.log(`5. Final DB state: ${finalCount} course_access records`);
  console.log(`6. Distribution: each user has ${courseIds.length} courses`);
  console.log(`7. Tier distribution: Free=${tierCounts.free}, Premium=${tierCounts.premium}, VIP=${tierCounts.vip}`);
  console.log(`8. Anomalies: ${anomalies}`);
  console.log('='.repeat(60));

  if (anomalies === 0) {
    console.log('SUCCESS: course_access has been fixed correctly!');
  } else {
    console.log('WARNING: Some anomalies detected. Review above.');
  }
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
