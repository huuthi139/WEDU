#!/usr/bin/env npx tsx
/**
 * PRODUCTION CLEANUP SCRIPT - course_access
 *
 * This script:
 * 1. Backs up ALL course_access records to audit_logs
 * 2. Deletes ALL course_access records
 * 3. Verifies users, courses, audit_logs are untouched
 * 4. Prints a full verification report
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/execute-cleanup.ts
 *
 * Or with .env file:
 *   cp .env.example .env  # fill in real values
 *   npx tsx scripts/execute-cleanup.ts
 */

import { createClient } from '@supabase/supabase-js';

// ---------- CONFIG ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- HELPERS ----------
async function countTable(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Count ${table} failed: ${error.message}`);
  return count || 0;
}

// ---------- MAIN ----------
async function main() {
  console.log('='.repeat(60));
  console.log('PRODUCTION CLEANUP: course_access');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  // ---- Step 0: Pre-flight counts ----
  console.log('--- STEP 0: Pre-flight counts ---');
  const usersBefore = await countTable('users');
  const coursesBefore = await countTable('courses');
  const auditLogsBefore = await countTable('audit_logs');
  const courseAccessBefore = await countTable('course_access');

  console.log(`  users:         ${usersBefore}`);
  console.log(`  courses:       ${coursesBefore}`);
  console.log(`  audit_logs:    ${auditLogsBefore}`);
  console.log(`  course_access: ${courseAccessBefore}`);
  console.log('');

  if (courseAccessBefore === 0) {
    console.log('✅ course_access is already empty. Nothing to clean up.');
    process.exit(0);
  }

  // ---- Step 1: Fetch all records for backup ----
  console.log('--- STEP 1: Fetching all course_access for backup ---');
  const { data: allRecords, error: fetchErr } = await supabase
    .from('course_access')
    .select(`
      id, user_id, course_id, access_tier, status, source,
      activated_at, expires_at, created_at, updated_at,
      users(email, name),
      courses(id, title)
    `);

  if (fetchErr) {
    console.error(`❌ Fetch failed: ${fetchErr.message}`);
    process.exit(1);
  }

  console.log(`  Fetched ${(allRecords || []).length} records for backup.`);

  // ---- Step 2: Write backup to audit_logs ----
  console.log('--- STEP 2: Writing backup to audit_logs ---');
  const backupPayload = (allRecords || []).map((r: any) => ({
    id: r.id,
    user_email: r.users?.email || '',
    user_name: r.users?.name || '',
    user_id: r.user_id,
    course_id: r.course_id,
    course_title: r.courses?.title || '',
    access_tier: r.access_tier,
    status: r.status,
    source: r.source,
    activated_at: r.activated_at,
    expires_at: r.expires_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  // Production audit_logs uses Migration 002 schema:
  //   action, entity_type, entity_id, before_json, after_json
  const { error: auditErr } = await supabase
    .from('audit_logs')
    .insert({
      action: 'course_access_bulk_cleanup',
      entity_type: 'course_access',
      entity_id: `cleanup_${new Date().toISOString()}`,
      before_json: {
        total_records: courseAccessBefore,
        reason: 'Invalid data: auto-generated without real mapping. Audit confirmed 100% incorrect.',
        records: backupPayload,
      },
      after_json: { total_records: 0 },
    });

  if (auditErr) {
    console.error(`❌ Audit log write failed: ${auditErr.message}`);
    console.error('ABORTING: backup was not saved. Will not delete.');
    process.exit(1);
  }
  console.log('  ✅ Backup written to audit_logs.');

  // ---- Step 3: Delete all course_access ----
  console.log('--- STEP 3: Deleting all course_access records ---');
  const { error: deleteErr } = await supabase
    .from('course_access')
    .delete()
    .gte('created_at', '1970-01-01');

  if (deleteErr) {
    console.error(`❌ Delete failed: ${deleteErr.message}`);
    console.error('Backup was saved to audit_logs. Manual intervention needed.');
    process.exit(1);
  }
  console.log('  ✅ Delete completed.');

  // ---- Step 4: Post-cleanup verification ----
  console.log('--- STEP 4: Post-cleanup verification ---');
  const usersAfter = await countTable('users');
  const coursesAfter = await countTable('courses');
  const auditLogsAfter = await countTable('audit_logs');
  const courseAccessAfter = await countTable('course_access');

  console.log('');
  console.log('='.repeat(60));
  console.log('CLEANUP REPORT');
  console.log('='.repeat(60));
  console.log('');

  // 1. Backup verification
  console.log('1. BACKUP VERIFICATION');
  console.log(`   audit_logs before: ${auditLogsBefore}`);
  console.log(`   audit_logs after:  ${auditLogsAfter}`);
  console.log(`   new backup record: ${auditLogsAfter > auditLogsBefore ? 'YES ✅' : 'NO ❌'}`);
  console.log('');

  // 2. Cleanup execution
  console.log('2. CLEANUP EXECUTION');
  console.log(`   action: DELETE all course_access`);
  console.log(`   status: ${courseAccessAfter === 0 ? 'SUCCESS ✅' : 'PARTIAL ⚠️'}`);
  console.log('');

  // 3. Before/after counts
  console.log('3. BEFORE/AFTER COUNTS');
  console.log(`   course_access before: ${courseAccessBefore}`);
  console.log(`   course_access after:  ${courseAccessAfter}`);
  console.log(`   records deleted:      ${courseAccessBefore - courseAccessAfter}`);
  console.log('');

  // 4. Audit log proof
  console.log('4. AUDIT LOG PROOF');
  const { data: proofLog } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, created_at')
    .eq('action', 'course_access_bulk_cleanup')
    .order('created_at', { ascending: false })
    .limit(1);

  if (proofLog && proofLog.length > 0) {
    console.log(`   audit log id:    ${proofLog[0].id}`);
    console.log(`   action:          ${proofLog[0].action}`);
    console.log(`   entity_type:     ${proofLog[0].entity_type}`);
    console.log(`   entity_id:       ${proofLog[0].entity_id}`);
    console.log(`   created_at:      ${proofLog[0].created_at}`);
    console.log(`   backup stored:   YES ✅`);
  } else {
    console.log('   ❌ No cleanup audit log found');
  }
  console.log('');

  // 5. Safety confirmation
  console.log('5. SAFETY CONFIRMATION - ONLY course_access was deleted');
  console.log(`   users:       ${usersBefore} → ${usersAfter}  ${usersAfter === usersBefore ? '✅ unchanged' : '❌ CHANGED'}`);
  console.log(`   courses:     ${coursesBefore} → ${coursesAfter}  ${coursesAfter === coursesBefore ? '✅ unchanged' : '❌ CHANGED'}`);
  console.log(`   audit_logs:  ${auditLogsBefore} → ${auditLogsAfter}  ${auditLogsAfter >= auditLogsBefore ? '✅ intact (+ backup)' : '❌ CHANGED'}`);
  console.log(`   course_access: ${courseAccessBefore} → ${courseAccessAfter}  ${courseAccessAfter === 0 ? '✅ cleaned' : '⚠️ remaining'}`);
  console.log('');

  const allGood = courseAccessAfter === 0 &&
    usersAfter === usersBefore &&
    coursesAfter === coursesBefore &&
    auditLogsAfter >= auditLogsBefore;

  if (allGood) {
    console.log('🎉 CLEANUP COMPLETE - All verifications passed.');
  } else {
    console.log('⚠️  CLEANUP COMPLETED WITH WARNINGS - Review report above.');
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
