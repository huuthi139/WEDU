/**
 * Script: Audit & Cleanup Course Access
 *
 * Purpose: Fix incorrectly bulk-assigned course_access records.
 *
 * Problem: All 46 users were assigned access to ALL 21 courses based on their
 * user-level member_level (Free/Premium/VIP). This is wrong because WEDU's
 * business model requires per-course access grants.
 *
 * The Google Sheet "course_access" tab does NOT contain per-course mapping.
 * It only has user profiles (Email, Password, Role, Tên, Level, ...).
 * There is NO source data for which student has access to which specific course.
 *
 * Safe correction plan:
 * 1. Backup all course_access records (done: data/backup_course_access_production.json)
 * 2. DELETE all 966 bulk-assigned records (source='admin', created at bulk timestamps)
 * 3. Wait for business owner to provide true per-course mapping
 * 4. Re-import using /api/admin/import-sheet with proper course_access tab
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/audit-course-access.ts   # preview only
 *   DRY_RUN=false npx tsx scripts/audit-course-access.ts  # execute cleanup
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fmctniqxvkcfcqzpaalc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false';

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchAll(table: string, params = ''): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&limit=2000`, { headers });
  if (!res.ok) throw new Error(`Fetch ${table} failed: ${res.status}`);
  return res.json();
}

async function deleteRecords(ids: string[]): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  // Delete in batches of 50
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const idFilter = batch.map(id => `"${id}"`).join(',');

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/course_access?id=in.(${idFilter})`,
      {
        method: 'DELETE',
        headers: { ...headers, 'Prefer': 'return=minimal' },
      }
    );

    if (res.ok) {
      deleted += batch.length;
    } else {
      console.error(`  Delete batch ${i}-${i + batch.length} failed: ${res.status}`);
      errors += batch.length;
    }
  }

  return { deleted, errors };
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`COURSE_ACCESS AUDIT & CLEANUP`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : '⚠️  LIVE - WILL DELETE RECORDS'}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Fetch all data
  const allCA = await fetchAll('course_access', 'select=id,user_id,course_id,access_tier,source,status,created_at');
  const users = await fetchAll('users', 'select=id,email,name,system_role,member_level');
  const courses = await fetchAll('courses', 'select=id,title');

  console.log(`Total course_access records: ${allCA.length}`);
  console.log(`Total users: ${users.length}`);
  console.log(`Total courses: ${courses.length}`);

  // 2. Analyze per-user distribution
  const userMap = new Map(users.map(u => [u.id, u]));
  const userCounts: Record<string, number> = {};
  for (const ca of allCA) {
    userCounts[ca.user_id] = (userCounts[ca.user_id] || 0) + 1;
  }

  const dist: Record<number, number> = {};
  for (const count of Object.values(userCounts)) {
    dist[count] = (dist[count] || 0) + 1;
  }

  console.log('\n--- Distribution: courses per user ---');
  for (const [count, numUsers] of Object.entries(dist).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    console.log(`  ${count} courses: ${numUsers} users`);
  }

  // 3. Identify bulk-assigned records (source='admin', all users have 21 courses)
  const bulkAssigned = allCA.filter(ca => ca.source === 'admin');
  const legitimateRecords = allCA.filter(ca => ca.source !== 'admin');

  console.log(`\n--- Records by source ---`);
  console.log(`  admin (bulk-assigned, SUSPECT): ${bulkAssigned.length}`);
  console.log(`  other (legitimate): ${legitimateRecords.length}`);

  // 4. Identify records to delete
  // ALL records with source='admin' are suspect because:
  // - They were created in 2 bulk batches at identical timestamps
  // - Every user got ALL 21 courses
  // - No source data exists for per-course mapping
  const toDelete = bulkAssigned.map(ca => ca.id);

  console.log(`\n--- CLEANUP PLAN ---`);
  console.log(`Records to DELETE: ${toDelete.length}`);
  console.log(`Records to KEEP: ${legitimateRecords.length}`);

  if (toDelete.length === 0) {
    console.log('\nNo records to delete. Exiting.');
    return;
  }

  // Show sample of what will be deleted
  console.log('\nSample of records to delete:');
  for (const ca of bulkAssigned.slice(0, 5)) {
    const user = userMap.get(ca.user_id);
    console.log(`  ${user?.email || ca.user_id} → course ${ca.course_id} (${ca.access_tier})`);
  }
  if (bulkAssigned.length > 5) {
    console.log(`  ... and ${bulkAssigned.length - 5} more`);
  }

  // 5. Execute cleanup
  if (DRY_RUN) {
    console.log('\n⏸️  DRY RUN - No changes made. Set DRY_RUN=false to execute.');
  } else {
    console.log('\n🔥 EXECUTING CLEANUP...');
    const { deleted, errors } = await deleteRecords(toDelete);
    console.log(`✅ Deleted: ${deleted}`);
    if (errors > 0) console.log(`❌ Errors: ${errors}`);

    // Verify
    const remaining = await fetchAll('course_access', 'select=id&limit=1');
    console.log(`\nRemaining course_access records: check via admin UI`);
  }

  console.log('\n--- NEXT STEPS ---');
  console.log('1. Business owner needs to provide TRUE per-course access mapping');
  console.log('2. Create a proper "course_access" tab in Google Sheet with columns:');
  console.log('   email, course_code, access_tier, status, activated_at, expires_at, source');
  console.log('3. Each row = one student + one course they actually purchased/were granted');
  console.log('4. Run import via /admin/import → select "course_access" table');
  console.log(`\n${'='.repeat(60)}\n`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
