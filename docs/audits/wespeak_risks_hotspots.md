# WESPEAK — Risks & Hotspots

**Audit Date:** 2026-03-07

---

## Critical Risks

### 1. PLAINTEXT PASSWORDS — CRITICAL
- **Files:** `google-apps-script/Code.gs:228`, `app/api/auth/login/route.ts:169`, `contexts/AuthContext.tsx:45-47`, `app/api/auth/login/route.ts:9-17`
- **Evidence:** `if (userPassword !== password)` — direct string comparison
- **Why it matters:** Any access to Google Sheet = all passwords exposed. Hardcoded admin password `123456` in source code.
- **Action:** Implement bcrypt/argon2 hashing before any production launch

### 2. NO TESTS — CRITICAL
- **Evidence:** `find` returned zero test files in project (only in node_modules)
- **Why it matters:** No regression protection. Cannot safely refactor. No CI/CD validation.
- **Action:** Add test framework (Jest/Vitest) and critical path tests immediately

### 3. SECRETS IN REPOSITORY — HIGH
- **Files:** `.env.local`, `.env.production` — both committed to git
- **Evidence:** `git log --oneline` shows commit `7d4a6d8 Add .env.production with public Google Apps Script URL`
- **Content:** Google Apps Script URL, Google Sheet ID exposed
- **Why it matters:** Anyone with repo access can read/write to the Google Sheet
- **Action:** Remove from git, add to .gitignore, rotate credentials

### 4. ENROLLMENT DATA LOSS — HIGH
- **Files:** `contexts/EnrollmentContext.tsx:51-58`
- **Evidence:** `localStorage.getItem(STORAGE_KEY_ENROLLMENTS)` — no server backup
- **Why it matters:** User clears browser / changes device = all enrollment progress lost. Orders, reviews, comments also lost.
- **Action:** Persist enrollments server-side (new DB tab or proper database)

### 5. NO SESSION MANAGEMENT — HIGH
- **Files:** `contexts/AuthContext.tsx:179-181`
- **Evidence:** `document.cookie = wepower-user=${btoa(json)}` — user object in base64 cookie
- **Why it matters:** Anyone can forge admin access by setting a cookie with `role: "admin"`. No server-side session validation.
- **Action:** Implement JWT with server-side verification

---

## Structural Risks

### 6. GOD FILES (> 800 LOC) — MEDIUM
| File | LOC | Problem |
|------|-----|---------|
| `app/admin/courses/[id]/page.tsx` | 1,427 | Entire course editor in one component |
| `app/admin/page.tsx` | 1,119 | Entire admin panel in one component |
| `app/courses/[id]/page.tsx` | 818 | Course detail with reviews, video preview |
| `app/learn/[courseId]/page.tsx` | 800 | Learn page with comments, sidebar |

### 7. CODE DUPLICATION — MEDIUM
- **CSV Parser:** Duplicated in 4 files: `lib/googleSheets.ts`, `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`, `app/api/auth/users/route.ts`
- **normalizeChapters / isEmbedUrl:** Duplicated in 3 files: `app/courses/[id]/page.tsx`, `app/learn/[courseId]/page.tsx`, `app/admin/courses/[id]/page.tsx`
- **fetchWithTimeout:** Duplicated in 3 API routes
- **isAdminRole:** Duplicated in 3 files
- **DEMO_USERS:** Duplicated in 2 files (login route + AuthContext)

### 8. TYPE SAFETY GAPS — LOW
- `any` used extensively in chapters API: `app/api/chapters/[courseId]/route.ts:18,54,77,100`
- `MemberLevel` type defined in both `lib/mockData.ts` and `contexts/AuthContext.tsx`

---

## Runtime Risks

### 9. IN-MEMORY RATE LIMITER — MEDIUM
- **File:** `middleware.ts:5-28`
- **Problem:** `rateLimitMap` is per-process. Vercel serverless = each function invocation may have its own map. Rate limiting is effectively non-functional in production.
- **Also:** `setInterval` in middleware may cause issues in edge runtime

### 10. IN-MEMORY COURSE CACHE — LOW
- **File:** `app/api/courses/route.ts:126-128`
- **Problem:** `cachedCourses` is per-instance. Each serverless invocation starts cold. Cache provides no benefit on Vercel.

### 11. SILENT EXCEPTION SWALLOWING — MEDIUM
- Multiple `catch { /* ignore */ }` blocks throughout the codebase
- **Examples:** `EnrollmentContext.tsx:58,116`, `CartContext.tsx:34`, `AuthContext.tsx:170`
- **Why it matters:** Errors in data loading/saving are silently lost

### 12. RACE CONDITIONS — MEDIUM
- **Chapters save:** Two admins editing same course simultaneously → last write wins, no locking
- **Order submission:** Double-click → two orders with different `Date.now()` IDs
- **User registration:** Two users registering with same email at exact same moment → both may succeed (Apps Script reads all rows, checks, then appends — no transaction)

### 13. GOOGLE APPS SCRIPT URL LENGTH LIMIT — HIGH
- **File:** `app/api/chapters/[courseId]/route.ts:10`
- **Evidence:** `MAX_ENCODED_URL = 7500` — all data sent via GET query params
- **Problem:** Large chapters with many lessons must be split into multiple requests. Complex partitioning logic adds fragility.
- **Workaround exists:** Chunking/partitioning system works but is error-prone

---

## Operational Risks

### 14. NO HEALTH CHECK — HIGH
- No `/api/health` or equivalent endpoint
- No way to programmatically verify system health
- No monitoring or alerting

### 15. NO LOGGING INFRASTRUCTURE — MEDIUM
- Only `console.error` calls in API routes
- No structured logging
- No log aggregation
- Vercel logs are ephemeral

### 16. BOOT FRAGILITY — MEDIUM
- If Google Sheets or Apps Script is unreachable:
  - Courses list returns empty array (no error shown to user)
  - Login falls through to local demo (only 1 hardcoded user)
  - Register fails with "Không thể kết nối"
  - The app appears functional but is data-empty

### 17. NO ROLLBACK PATH — HIGH
- No database migrations (Google Sheets = manual)
- No versioning of chapter data
- Chapter cleanup deletes old chunks — if new save corrupts, old data is gone
- No backup mechanism

---

## Suggested Fixing Order

| Priority | Risk | Effort | Impact |
|----------|------|--------|--------|
| 1 | Plaintext passwords | Medium | Critical security |
| 2 | Secrets in repo (.env files) | Low | Security hygiene |
| 3 | Add basic tests | Medium | Development safety |
| 4 | Persist enrollments server-side | Medium | Data loss prevention |
| 5 | Implement proper session/JWT | Medium | Auth security |
| 6 | Add health check endpoint | Low | Operational |
| 7 | Extract shared code (CSV parser, normalizeChapters) | Low | Maintainability |
| 8 | Break up god files | Medium | Maintainability |
| 9 | Add error monitoring | Medium | Operational |
| 10 | Move from Google Sheets to proper DB | High | Scalability |
