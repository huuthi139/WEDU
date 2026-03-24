#!/bin/bash
set -euo pipefail

# ============================================================
# FIX COURSE_ACCESS - Shell script using curl
# ============================================================

SUPABASE_URL="https://fmctniqxvkcfcqzpaalc.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtY3RuaXF4dmtjZmNxenBhYWxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzE1MCwiZXhwIjoyMDg5MTY5MTUwfQ.x89LozBL7OiSHU4AjVZMXKiAsb8-8VItvvGVN0kXnHk"
REST_URL="${SUPABASE_URL}/rest/v1"
HEADERS=(-H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" -H "Content-Type: application/json" -H "Prefer: return=minimal")

echo "============================================================"
echo "FIX COURSE_ACCESS - START"
echo "============================================================"

# ── STEP 1: Fetch all users from Supabase ──
echo "[STEP1] Fetching users from Supabase..."
USERS_JSON=$(curl -s "${REST_URL}/users?select=id,email" "${HEADERS[@]}")
USER_COUNT=$(echo "$USERS_JSON" | jq length)
echo "[STEP1] Users in DB: ${USER_COUNT}"

# ── STEP 2: Fetch all courses from Supabase ──
echo "[STEP2] Fetching courses from Supabase..."
COURSES_JSON=$(curl -s "${REST_URL}/courses?select=id,title&order=id" "${HEADERS[@]}")
COURSE_COUNT=$(echo "$COURSES_JSON" | jq length)
echo "[STEP2] Courses in DB: ${COURSE_COUNT}"
echo "$COURSES_JSON" | jq -r '.[] | "  Course: \(.id) - \(.title)"'

# ── STEP 3: Check current course_access state ──
echo "[STEP3] Checking current course_access state..."
CURRENT_ACCESS=$(curl -s "${REST_URL}/course_access?select=id,user_id,course_id,access_tier" "${HEADERS[@]}")
CURRENT_COUNT=$(echo "$CURRENT_ACCESS" | jq length)
echo "[STEP3] Current course_access records: ${CURRENT_COUNT}"

# Show distribution
echo "[STEP3] Current distribution (courses per user):"
echo "$CURRENT_ACCESS" | jq -r '[group_by(.user_id)[] | {user: .[0].user_id, count: length, tiers: [.[].access_tier] | unique}] | sort_by(-.count) | .[:10][] | "  user=\(.user) courses=\(.count) tiers=\(.tiers)"'

# ── STEP 4: Build mapping from Google Sheet data ──
echo "[STEP4] Building access mapping..."

# Google Sheet student data: email → level (deduplicated, highest tier wins)
# Level mapping: VIP→vip, Premium→premium, Free→free
# Note: lyoanhnhi@gmail.com appears twice (Free and Premium) → keep Premium

declare -A EMAIL_TIER
EMAIL_TIER["admin@wepower.vn"]="vip"
EMAIL_TIER["admin2@wepower.vn"]="vip"
EMAIL_TIER["lyoanhnhi@gmail.com"]="premium"
EMAIL_TIER["boreasson@gmail.com"]="premium"
EMAIL_TIER["tranglehip@gmail.com"]="premium"
EMAIL_TIER["dunglaocai68@gmail.com"]="vip"
EMAIL_TIER["nvd009@gmail.com"]="premium"
EMAIL_TIER["khanhtoan37@gmail.com"]="premium"
EMAIL_TIER["huynhforai@gmail.com"]="premium"
EMAIL_TIER["ngoxuanchinh0611@gmail.com"]="vip"
EMAIL_TIER["dongdinh1601@gmail.om"]="premium"
EMAIL_TIER["phamthihieunhi1980@gmail.com"]="premium"
EMAIL_TIER["khanhtd.bds@gmail.com"]="premium"
EMAIL_TIER["quoccuongtrieuphu@gmail.com"]="premium"
EMAIL_TIER["ndhai2308@gmail.com"]="premium"
EMAIL_TIER["thientuan0807@gmail.com"]="vip"
EMAIL_TIER["mmommo6868@gmail.com"]="premium"
EMAIL_TIER["nguyenvanthangnq96@gmail.com"]="premium"
EMAIL_TIER["ptdung1987@gmail.com"]="premium"
EMAIL_TIER["tranloi91vp@gmail.com"]="premium"
EMAIL_TIER["hhloc101@gmail.com"]="vip"
EMAIL_TIER["ducchinh568@gmail.com"]="vip"
EMAIL_TIER["nguyenngocanh14689@gmail.com"]="vip"
EMAIL_TIER["phungthanh1309@gmail.com"]="vip"
EMAIL_TIER["xehoithanhvinh@gmail.com"]="premium"
EMAIL_TIER["lechuong1994@gmail.com"]="vip"
EMAIL_TIER["phuonganhle785@gmail.com"]="vip"
EMAIL_TIER["quanuytin2704@gmail.com"]="premium"
EMAIL_TIER["nhatly1009@gmail.com"]="premium"
EMAIL_TIER["1hohoangphi1987@gmail.com"]="premium"
EMAIL_TIER["haclongkaka2012@gmail.com"]="vip"
EMAIL_TIER["kynguyen0405@gmail.com"]="premium"
EMAIL_TIER["daongocanh0808@gmail.com"]="vip"
EMAIL_TIER["kevintuan987@gmail.com"]="premium"
EMAIL_TIER["nguyen.doantung@gmail.com"]="premium"
EMAIL_TIER["thanhle.work102@gmail.com"]="premium"
EMAIL_TIER["ng.xuan.tien.01@gmail.com"]="premium"
EMAIL_TIER["kienmyg1998@gmail.com"]="premium"
EMAIL_TIER["cuchong031996@gmail.com"]="premium"
EMAIL_TIER["intruongthuan2021@gmail.com"]="premium"
EMAIL_TIER["m2mhung@gmail.com"]="vip"
EMAIL_TIER["dductruong22@gmail.com"]="premium"
EMAIL_TIER["nguyenthihan12a4@gmail.com"]="premium"
EMAIL_TIER["bentleylongnguyen@gmail.com"]="premium"
EMAIL_TIER["luuhuanvp@gmail.com"]="premium"
EMAIL_TIER["nguyenhuong144@gmail.com"]="vip"
EMAIL_TIER["testcurl@example.com"]="free"
EMAIL_TIER["testcurl2@example.com"]="free"

echo "[STEP4] Sheet students: ${#EMAIL_TIER[@]}"

# Get course IDs as array
COURSE_IDS=$(echo "$COURSES_JSON" | jq -r '.[].id')

# Build the insert payload
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RECORDS="[]"
MATCHED=0
UNMATCHED_EMAILS=""

for email in "${!EMAIL_TIER[@]}"; do
  tier="${EMAIL_TIER[$email]}"

  # Look up user_id by email (case-insensitive)
  user_id=$(echo "$USERS_JSON" | jq -r --arg e "$email" '[.[] | select(.email | ascii_downcase == ($e | ascii_downcase))][0].id // empty')

  if [ -z "$user_id" ]; then
    UNMATCHED_EMAILS="${UNMATCHED_EMAILS} ${email}"
    continue
  fi

  MATCHED=$((MATCHED + 1))

  for course_id in $COURSE_IDS; do
    RECORDS=$(echo "$RECORDS" | jq --arg uid "$user_id" --arg cid "$course_id" --arg tier "$tier" --arg now "$NOW" \
      '. + [{
        "user_id": $uid,
        "course_id": $cid,
        "access_tier": $tier,
        "status": "active",
        "activated_at": $now,
        "expires_at": null,
        "source": "admin"
      }]')
  done
done

TOTAL_RECORDS=$(echo "$RECORDS" | jq length)
echo "[STEP4] Matched users: ${MATCHED}"
echo "[STEP4] Total records to insert: ${TOTAL_RECORDS}"
if [ -n "$UNMATCHED_EMAILS" ]; then
  echo "[STEP4] Unmatched emails:${UNMATCHED_EMAILS}"
fi

# ── STEP 5: Validate - check for duplicates ──
echo "[STEP5] Validating - checking for duplicates..."
DUPES=$(echo "$RECORDS" | jq '[.[] | "\(.user_id)|\(.course_id)"] | group_by(.) | map(select(length > 1)) | length')
if [ "$DUPES" -gt 0 ]; then
  echo "[STEP5] ERROR: Found ${DUPES} duplicate user_id+course_id pairs. STOPPING."
  exit 1
fi
echo "[STEP5] No duplicates. Validation passed."

# ── STEP 6: Delete existing course_access ──
echo "[STEP6] Deleting ALL existing course_access records..."
DELETE_RESP=$(curl -s -w "\n%{http_code}" -X DELETE "${REST_URL}/course_access?id=not.is.null" "${HEADERS[@]}")
DELETE_CODE=$(echo "$DELETE_RESP" | tail -1)
echo "[STEP6] Delete response code: ${DELETE_CODE}"

if [ "$DELETE_CODE" -ge 300 ]; then
  echo "[STEP6] ERROR: Delete failed with code ${DELETE_CODE}"
  echo "$DELETE_RESP"
  exit 1
fi

# Verify deletion
AFTER_DELETE=$(curl -s "${REST_URL}/course_access?select=id" -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" -H "Prefer: count=exact" -H "Range: 0-0" -I 2>/dev/null | grep -i content-range || echo "")
echo "[STEP6] After delete check: ${AFTER_DELETE}"

# ── STEP 7: Insert in batches ──
echo "[STEP7] Inserting ${TOTAL_RECORDS} records in batches..."

BATCH_SIZE=50
INSERTED=0
i=0

while [ $i -lt "$TOTAL_RECORDS" ]; do
  end=$((i + BATCH_SIZE))
  BATCH=$(echo "$RECORDS" | jq ".[$i:$end]")
  BATCH_LEN=$(echo "$BATCH" | jq length)

  INSERT_RESP=$(curl -s -w "\n%{http_code}" -X POST "${REST_URL}/course_access" \
    "${HEADERS[@]}" \
    -H "Prefer: return=minimal,resolution=merge-duplicates" \
    -d "$BATCH")
  INSERT_CODE=$(echo "$INSERT_RESP" | tail -1)

  if [ "$INSERT_CODE" -ge 300 ]; then
    echo "[STEP7] ERROR: Batch insert failed with code ${INSERT_CODE}"
    echo "$INSERT_RESP" | head -5
    exit 1
  fi

  INSERTED=$((INSERTED + BATCH_LEN))
  echo "[STEP7] Batch $((i / BATCH_SIZE + 1)): inserted ${BATCH_LEN} (total: ${INSERTED})"
  i=$end
done

echo "[STEP7] Total inserted: ${INSERTED}"

# ── STEP 8: Post-verify ──
echo "[STEP8] Post-verification..."
FINAL_ACCESS=$(curl -s "${REST_URL}/course_access?select=user_id,course_id,access_tier" "${HEADERS[@]}")
FINAL_COUNT=$(echo "$FINAL_ACCESS" | jq length)
echo "[STEP8] Final course_access count: ${FINAL_COUNT}"
echo "[STEP8] Expected: ${TOTAL_RECORDS}"

if [ "$FINAL_COUNT" -ne "$TOTAL_RECORDS" ]; then
  echo "[STEP8] WARNING: Count mismatch!"
fi

# Distribution per user
echo "[STEP8] Distribution per user:"
echo "$FINAL_ACCESS" | jq -r '
  group_by(.user_id) |
  map({
    user_id: .[0].user_id,
    count: length,
    tier: [.[].access_tier] | unique | join(",")
  }) |
  sort_by(-.count) |
  .[] |
  "  \(.user_id): \(.count) courses, tier=\(.tier)"
'

# Check for anomalies
ANOMALY_21=$(echo "$FINAL_ACCESS" | jq '[group_by(.user_id)[] | select(length == 21)] | length')
MIXED_TIERS=$(echo "$FINAL_ACCESS" | jq '[group_by(.user_id)[] | select(([.[].access_tier] | unique | length) > 1)] | length')

echo ""
echo "============================================================"
echo "FINAL REPORT"
echo "============================================================"
echo "1. Data source: Google Sheet - ${#EMAIL_TIER[@]} unique students, $(echo "$COURSE_IDS" | wc -w | tr -d ' ') courses"
echo "2. Records generated: ${TOTAL_RECORDS}"
echo "3. Validation: 0 duplicates, $(echo "$UNMATCHED_EMAILS" | wc -w | tr -d ' ') unmatched emails"
if [ -n "$UNMATCHED_EMAILS" ]; then
  echo "   Unmatched:${UNMATCHED_EMAILS}"
fi
echo "4. Insert result: ${INSERTED} inserted, 0 errors"
echo "5. Final DB state: ${FINAL_COUNT} course_access records"
echo "6. Anomaly check - users with 21 courses: ${ANOMALY_21}"
echo "7. Anomaly check - users with mixed tiers: ${MIXED_TIERS}"
echo "============================================================"

if [ "$ANOMALY_21" -eq 0 ] && [ "$MIXED_TIERS" -eq 0 ] && [ "$FINAL_COUNT" -eq "$TOTAL_RECORDS" ]; then
  echo "SUCCESS: course_access has been fixed correctly!"
else
  echo "WARNING: Some anomalies detected. Review above."
fi
