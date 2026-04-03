# WEDU Platform - Comprehensive Audit V2
**Date:** 2026-04-03
**Scope:** Performance, UX, Cost, Security, Data Flow

---

## EXECUTIVE SUMMARY

5 điểm quan trọng nhất cần fix ngay:

1. **CRITICAL SECURITY: `fallback-secret` trong auth routes** — `forgot-password/route.ts:5` và `reset-password/route.ts:5` dùng `process.env.JWT_SECRET || 'fallback-secret'`. Nếu env thiếu, ai cũng forge được reset token.
2. **RLS Policies = allow all** — Mọi table đều có policy `USING (true) WITH CHECK (true)`. Dù dùng service_role key, nếu anon key bị lộ → toàn bộ DB exposed.
3. **Password reset token không bị invalidate sau khi dùng** — Token JWT 1h có thể reuse nhiều lần trong window đó.
4. **Duplicate enrollment systems** — `enrollments` (email-based) + `course_enrollments` (user_id-based) + `course_access` (tier-based) = 3 hệ thống song song, data không đồng bộ.
5. **Không có pagination trên admin endpoints** — `getAllUsers()`, `getAllOrders()` fetch toàn bộ table, sẽ crash khi scale.

---

## 1. PERFORMANCE ISSUES

### 1.1 N+1 Queries
| File | Line | Vấn đề | Cách fix |
|------|------|--------|----------|
| `lib/supabase/courses.ts` | 56-76 | `getAllCourses()` fetch ALL lessons rồi loop đếm per course | Dùng SQL aggregation hoặc view |
| `app/api/orders/route.ts` | 73-108 | Loop `grantCourseAccess()` per course trong order | Batch insert với `Promise.all()` |
| `app/api/chapters/[courseId]/route.ts` | 243-305 | Loop insert từng section + từng lesson tuần tự | Batch insert sections rồi batch insert lessons |

### 1.2 Missing Pagination
| File | Function | Fix |
|------|----------|-----|
| `lib/supabase/users.ts:132` | `getAllUsers()` — no limit | Add `.range(offset, offset+limit)` |
| `lib/supabase/orders.ts:66` | `getAllOrders()` — no limit | Add `.range(offset, offset+limit)` |
| `lib/supabase/reviews.ts:20` | `getReviewsByCourse()` — no limit | Add `.limit(20)` |
| `lib/supabase/enrollments.ts:20` | `getEnrollmentsByUser()` — no limit | Add `.limit(50)` |

### 1.3 select('*') — Fetch quá nhiều data
26 chỗ dùng `.select('*')` trong codebase. Quan trọng nhất:

| File | Line | Nên select |
|------|------|-----------|
| `lib/supabase/users.ts` | 29, 52, 136 | Exclude `password_hash` khi không cần |
| `lib/supabase/sections.ts` | 16, 25 | Select fields cần cho display |
| `lib/supabase/course-access.ts` | 20, 40, 82 | Select: `id, course_id, access_tier, status` |
| `lib/progress/service.ts` | 44, 61, 77 | Select fields cần thiết |

### 1.4 Frontend Performance
| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Auto-refetch mỗi 60s | `contexts/CoursesContext.tsx:43` | 100 users = ~1.7 req/s liên tục. Nên tăng lên 5-10 phút |
| React Query có nhưng không dùng | `package.json:20` | `@tanstack/react-query` đã install nhưng contexts dùng manual fetch |
| Sequential context fetches | `contexts/CourseAccessContext.tsx` | 2 API calls tuần tự, nên `Promise.all()` |

### 1.5 Bundle/Config
| Vấn đề | File | Fix |
|--------|------|-----|
| Không remove console.log production | `next.config.js` | Add `compiler: { removeConsole: true }` |
| Thiếu image format optimization | `next.config.js` | Add `formats: ['image/avif', 'image/webp']` |
| Image: chỉ whitelist unsplash | `next.config.js:5` | Thêm Bunny CDN domain |

---

## 2. SECURITY ISSUES

### Critical
| # | File:Line | Vấn đề | Fix |
|---|-----------|--------|-----|
| S1 | `app/api/auth/forgot-password/route.ts:5` | `JWT_SECRET \|\| 'fallback-secret'` — nếu env thiếu, secret = public | Remove fallback, throw error |
| S2 | `app/api/auth/reset-password/route.ts:5` | Same — `'fallback-secret'` | Remove fallback, throw error |
| S3 | `supabase/migrations/003_normalize_and_rls.sql` | ALL RLS policies = `USING (true)`. Nếu anon key lộ → full DB access | Implement proper per-user RLS |
| S4 | `lib/auth/password.ts:22` | Legacy plaintext password compare: `return plaintext === stored` | Remove sau khi migrate xong |
| S5 | `app/api/admin/bootstrap/route.ts` | POST /api/admin/bootstrap — NO AUTH. Ai cũng tạo được admin account | Add auth guard hoặc disable production |
| S6 | `app/api/admin/seed-admin/route.ts` | POST /api/admin/seed-admin — NO AUTH. Reset admin password to default | Add auth guard. Account takeover risk |
| S7 | `app/api/admin/setup-db/route.ts` | GET/POST — NO AUTH. Expose DB structure + Supabase project URL | Add requireAdmin() check |

### Important
| # | File:Line | Vấn đề | Fix |
|---|-----------|--------|-----|
| S8 | `app/api/auth/register/route.ts:25` | Password min length = 6, no complexity | Tăng lên 8+, yêu cầu mixed chars |
| S9 | `lib/auth/jwt.ts:20` | JWT expire = 7 days, no refresh mechanism | Giảm xuống 24h + implement refresh token |
| S10 | Reset password flow | Token không bị invalidate sau khi dùng — reusable trong 1h | Lưu used tokens vào DB hoặc dùng one-time token |
| S11 | `lib/rate-limit.ts:19` | Rate limiting disabled khi thiếu Redis config — fails open | Log warning + implement in-memory fallback |
| S12 | `app/api/auth/me/route.ts:28-35` | Auto-create profile với `passwordHash: ''` — empty password hash | Dùng LOCKED_PASSWORD_SENTINEL |
| S13 | `middleware.ts:35` | IP detection dùng `x-forwarded-for` — có thể spoof để bypass rate limit | Validate proxy headers |
| S14 | `app/api/auth/change-password/route.ts` | Không invalidate existing sessions sau password change | Token cũ vẫn valid 7 ngày |
| S15 | `app/api/auth/me/route.ts:24-50` | Auto-create user nếu deleted khỏi DB nhưng JWT vẫn valid | Privilege escalation risk nếu admin bị xoá |

### Minor
| # | File:Line | Vấn đề | Fix |
|---|-----------|--------|-----|
| S16 | `middleware.ts:117-119` | CSP cho phép `'unsafe-inline' 'unsafe-eval'` | Dùng nonce-based CSP |
| S17 | `app/api/auth/login/route.ts:33` | Username → email append `@wedu.vn` có thể bị abuse | Validate username format |
| S18 | `app/api/webhook/sheet-sync/route.ts:11` | CORS `Access-Control-Allow-Origin: '*'` trên deprecated endpoint | Remove CORS headers |

---

## 3. AUTH & PASSWORD RESET

### Trạng thái hoạt động
| Flow | Status | Chi tiết |
|------|--------|----------|
| Register | ✅ Working | Hash bcrypt, tạo session, gửi welcome email |
| Login | ✅ Working | Verify bcrypt, tạo JWT 7d, set httpOnly cookie |
| Logout | ✅ Working | Delete cookie server-side + clear localStorage client |
| Forgot Password | ⚠️ Partial | Gửi email với JWT reset token 1h — nhưng dùng fallback-secret |
| Reset Password | ⚠️ Partial | Verify token + update hash — nhưng token reusable |
| Change Password | ✅ Working | Verify old password + update hash |
| Multi-tab sync | ✅ Working | BroadcastChannel cho login/logout sync |

### Bugs phát hiện
1. **`fallback-secret` trong forgot-password và reset-password** — khác với `lib/auth/jwt.ts` dùng `getSecret()` có validation. Hai file auth dùng inline secret.
2. **Register không set cookie trực tiếp** — gọi `createSession()` nhưng đó dùng `cookies()` từ next/headers, có thể không work trong POST route handler context.
3. **`/api/auth/me` auto-create profile với empty passwordHash** — nên dùng `LOCKED_PASSWORD_SENTINEL`.

### Recommendations
- Unify JWT secret handling: dùng `getSecret()` từ `lib/auth/jwt.ts` ở mọi nơi
- Implement one-time reset token (store in DB, delete after use)
- Add password complexity requirements
- Reduce JWT expiry to 24h + add refresh endpoint

---

## 4. DATA FLOW ISSUES

### 4.1 Database Tables (from migrations 001-009)

**Active tables:**
| Table | Purpose | Status |
|-------|---------|--------|
| `users` | User profiles + auth | Active |
| `courses` | Course catalog | Active |
| `course_sections` | Normalized sections | Active (source of truth) |
| `lessons` | Normalized lessons | Active (source of truth) |
| `course_access` | Per-course access control | Active |
| `lesson_progress` | Per-lesson watch progress | Active |
| `course_progress` | Aggregated course progress | Active |
| `lesson_notes` | User notes on lessons | Active |
| `orders` | Purchase orders | Active |
| `order_items` | Normalized order line items | Active |
| `reviews` | Course reviews | Active |
| `videos` | Video library registry | Active |
| `audit_logs` | System audit trail | Active |
| `lesson_resources` | Lesson attachments | Active (empty?) |

**Legacy/Duplicate tables:**
| Table | Problem | Recommendation |
|-------|---------|---------------|
| `enrollments` | Email-based, replaced by `course_access` | Deprecate, migrate remaining refs |
| `course_enrollments` | User-id based, replaced by `course_access` | Deprecate |
| `chapters` | JSONB blob, replaced by `course_sections` + `lessons` | Deprecate |
| `course_chapters` | Migration 004 created but code uses `course_sections` | Drop or migrate |
| `course_sessions` | Migration 004 created but not used in code | Drop |
| `course_sections` | Predecessor to `course_chapters`, still actively used in code | Consolidate with `course_chapters` |

### 4.2 Duplicate Data — 3 Enrollment Systems
```
enrollments (migration 001)     → email + course_id → legacy
course_enrollments (migration 002) → user_id + course_id → intermediate
course_access (migration 004)    → user_id + course_id + tier → current
```
Code still reads from ALL THREE:
- `lib/supabase/enrollments.ts` → reads `enrollments`
- `contexts/EnrollmentContext.tsx` → calls `/api/enrollments`
- `lib/supabase/course-access.ts` → reads `course_access`
- `contexts/CourseAccessContext.tsx` → calls `/api/course-access`

**Fix:** Consolidate to `course_access` only. Remove `enrollments` and `course_enrollments` references.

### 4.3 Duplicate Content — 3 Chapter/Lesson Systems
```
chapters table (JSONB blob)     → legacy
course_sections + lessons       → normalized (source of truth)
fallback-chapters.ts            → hardcoded fallback
```
The chapters API (`app/api/chapters/[courseId]/route.ts`) tries all 3 sources with fallback chain. Background migration runs on first access to convert old → new format.

### 4.4 Cache
- `lib/supabase/courses-cache.ts` — **DISABLED** (all functions are no-ops)
- `localStorage` — only used for legacy cleanup on logout
- No server-side caching active

### 4.5 Missing Indexes (from DB audit)
| Index cần thêm | Lý do |
|----------------|-------|
| `lesson_progress (course_id, is_completed)` | Filter by completion status |
| `courses (status, visibility, is_active)` | Admin dashboard filters |
| `lessons (course_id, access_tier, status)` | Public lesson listing + access filter |
| `order_items (course_id)` | Reverse lookup: orders bought this course |
| `audit_logs (target_table, action_type, created_at DESC)` | Admin audit queries |

### 4.6 Stale Denormalized Fields
| Field | Table | Vấn đề |
|-------|-------|--------|
| `enrollments_count` | courses | Không bao giờ update khi có enrollment mới |
| `lessons_count` | courses | Có update khi save chapters nhưng không khi delete lesson |
| `orders.course_ids` (TEXT) | orders | Duplicate với `order_items` table — có thể diverge |

### 4.7 Data Flow Diagrams

**User đăng ký:**
```
Client → POST /api/auth/register
  → hashPassword() → createUserProfile() in users table
  → createSession() sets httpOnly cookie
  → sendWelcomeEmail() via Resend (non-blocking)
```

**User mua khoá:**
```
Client → POST /api/orders
  → createOrder() in orders table
  → Loop: grantCourseAccess() in course_access table
  → Loop: insert order_items
```

**User xem bài:**
```
Client → GET /api/chapters/[courseId]
  → getSession() check auth
  → getEffectiveAccessTier() from course_access
  → getSectionsByCourse() from course_sections + lessons
  → Filter content based on tier
  → Return chapters with protected content
```

**Admin import từ Google Sheet:**
```
Google Sheet → webhook /api/webhook/sheet-sync (DEPRECATED)
  HOẶC Admin → POST /api/admin/import-sheet
  → syncSheetUsersToSupabase() → upsert users table
  → grantCourseAccess() per user per course
  → audit_logs ghi lại changes
```

---

## 5. UX ISSUES

### Broken/Incomplete Flows
| Flow | Issue | File |
|------|-------|------|
| Email verification | Không có — register xong login luôn | `app/api/auth/register/route.ts` |
| Payment integration | Chỉ tạo order "Đang chờ xử lý" — không có payment gateway | `app/api/orders/route.ts` |
| Certificate generation | Page exists nhưng chưa implement | `app/certificates/page.tsx` |
| Community page | Static placeholder | `app/community/page.tsx` |
| Social login | Buttons hiển thị nhưng showToast "in development" | `app/login/page.tsx`, `app/register/page.tsx` |
| Remember me | Checkbox có state nhưng không dùng cho session persistence | `app/login/page.tsx` |
| Course not found | Render empty content, không có "not found" message | `app/courses/[id]/page.tsx` |
| Custom 404 page | Không có | N/A |
| Lesson comments | Lưu trong localStorage — mất khi clear/đổi device | `app/learn/[courseId]/page.tsx` |
| Profile extra fields | Bio, location, occupation lưu localStorage, không sync server | `app/profile/page.tsx` |
| Order confirmation email | Resend integrated nhưng không wire vào checkout | `app/checkout/page.tsx` |

### Missing States
| Vấn đề | File |
|--------|------|
| Error boundary chỉ catch render errors, không handle API failures | `components/ErrorBoundary.tsx` |
| No offline/network error handling | Across all contexts |
| No retry mechanism for failed API calls | `contexts/*.tsx` |
| Admin pages không có loading states | `app/admin/page.tsx` |
| Admin dashboard fetch all tabs data upfront | `app/admin/page.tsx` |

### Positive UX
- Course filtering: advanced filters, debounced search (250ms), sort options
- Skeleton loading cards trên courses page
- Responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Touch targets đạt 44px minimum (`h-12`, `h-10`)
- Image optimized với `next/image` + lazy loading + responsive sizes
- Multi-tab auth sync via BroadcastChannel

### Mobile
- Tailwind responsive classes present (`md:`, `lg:` prefixes used)
- Header has mobile menu toggle with body scroll lock
- Footer links collapse to 2-column on mobile
- Modals dùng fixed positioning — có thể không scrollable trên small screens

---

## 6. COST OPTIMIZATION

### Quick Wins
| Vấn đề | Impact | Fix |
|--------|--------|-----|
| CoursesContext refetch mỗi 60s | ~1440 req/user/day | Tăng interval lên 5-10 phút |
| `select('*')` 26 chỗ | Bandwidth lãng phí | Select specific columns |
| Courses cache disabled | Mỗi request = DB query | Enable cache với TTL 5 phút |
| Welcome email gửi fire-and-forget | Email cost nếu fail silently | Log failures, implement retry queue |
| Home page fetch all courses, chỉ hiện 6 | Thừa data | Add `/api/courses?limit=6` |
| Google Fonts load all weights (100-1000) | Extra bandwidth | Chỉ load 400, 500, 600, 700 |
| No Cache-Control headers trên chapters API | Repeated DB queries | Add `Cache-Control: max-age=3600` |

### Long Term
| Vấn đề | Fix |
|--------|-----|
| Migrate manual fetch → React Query | Dedup requests, smart caching |
| Implement ISR cho course pages | Giảm serverless invocations |
| Add CDN caching headers | Giảm Vercel bandwidth |
| Consolidate 3 enrollment systems → 1 | Giảm duplicate DB queries |

### External Services
| Service | Usage | Status |
|---------|-------|--------|
| Supabase | DB + Auth storage | Active (service_role key) |
| Resend | Welcome + Reset emails | Active |
| Upstash Redis | Rate limiting | Optional (fails open if missing) |
| Bunny.net | Video CDN + streaming | Active (via iframe embed) |

---

## 7. CODE QUALITY

### Top 10 Files Cần Refactor (by size + complexity)
| # | File | Lines | Vấn đề |
|---|------|-------|--------|
| 1 | `app/admin/courses/[id]/page.tsx` | 1703 | Quá lớn — cần tách components |
| 2 | `app/api/admin/import-sheet/route.ts` | 1196 | Quá lớn — tách validation, mapping, import logic |
| 3 | `app/admin/page.tsx` | 1145 | Quá lớn — đã có tabs nhưng file vẫn lớn |
| 4 | `app/learn/[courseId]/page.tsx` | 815 | Tách video player, sidebar, progress components |
| 5 | `app/courses/[id]/page.tsx` | 794 | Tách course detail sections |
| 6 | `app/community/page.tsx` | 645 | Static content — không cần phức tạp |
| 7 | `lib/types/index.ts` | 634 | Tách theo domain: auth.types, course.types, etc. |
| 8 | `components/layout/Header.tsx` | 517 | Tách navigation, mobile menu, user menu |
| 9 | `app/profile/page.tsx` | 509 | Tách profile sections |
| 10 | `app/admin/course-access/page.tsx` | 500 | Tách table + form components |

### console.log trong Production Code (149+ statements)
| File | Count | Severity | Action |
|------|-------|----------|--------|
| `app/api/admin/course-access/route.ts` | 5+ | HIGH — logs user IDs, emails | Remove debug logs immediately |
| `app/admin/page.tsx` | 4+ | HIGH — debug logs | Remove |
| `lib/email/send.ts` | 6 | MEDIUM — logs email recipients | Replace với logger |
| `lib/supabase/bootstrap.ts` | 2 | LOW | Replace với logger |
| `lib/supabase/users.ts` | 1 | LOW | Replace với logger |
| `app/api/chapters/[courseId]/route.ts` | 3 | LOW | Replace với logger |
| `scripts/*.ts` | 30+ | OK — scripts | Acceptable |

### TypeScript `any` Usage: 52 instances
Top offenders:
- `lib/supabase/courses.ts` — `as any[]`, `(row: any)`
- `app/api/chapters/[courseId]/route.ts` — `chapters: any[]`, `catch (error: any)`
- `lib/fallback-chapters.ts` — `any[]` cho chapter data
- `lib/utils/chapters.ts` — `any[]` input types
- `scripts/*.ts` — acceptable for scripts

### Dead Files (~643 lines removable)
| File | Lines | Reason |
|------|-------|--------|
| `hooks/useProfile.ts` | 46 | Not imported anywhere |
| `hooks/useCourseProgress.ts` | 79 | Not imported anywhere |
| `hooks/useLessonProgress.ts` | 134 | Not imported anywhere |
| `hooks/useToast.tsx` | 35 | Not imported anywhere |
| `lib/fallback-data.ts` | 276 | Not imported anywhere |
| `lib/validation.ts` | 73 | Not imported anywhere |
| `lib/supabase/profiles.ts` | 80 | Not imported anywhere |
| `lib/mockData.ts` | 4 | Deprecated re-export |
| `lib/googleSheets.ts` | 6 | Deprecated re-export |
| `lib/legacy/googleSheets-courses.ts.deprecated` | — | Deprecated |
| `lib/legacy/sheetSync.ts.deprecated` | — | Deprecated |
| `scripts/audit-course-access.ts` | — | One-time script, done |
| `scripts/execute-cleanup.ts` | — | One-time script, done |
| `scripts/fix-course-access.ts` | 369 | One-time script, done |
| `scripts/migrate-chapters-to-normalized.ts` | 643 | Migration script, done |
| `scripts/migrate-curl.ts` | 449 | Migration script, done |
| `public/login.html` | — | Static HTML — replaced by Next.js |

### Unnecessary Folders
| Folder | Content | Action |
|--------|---------|--------|
| `lib/legacy/` | 2 deprecated files | Delete |
| `lib/api/` | 1 file (47 lines) | Merge `response.ts` to `lib/utils/` |
| `lib/import/` | 1 file (116 lines) | Merge to `lib/supabase/` |
| `lib/progress/` | 1 file (165 lines) | Merge to `lib/supabase/` |
| `supabase/.temp/` | Empty CLI artifact | Delete |

### Unhandled Promises (16 instances)
| Pattern | File | Risk |
|---------|------|------|
| `.catch(() => {})` | `app/api/chapters/[courseId]/route.ts:141,156` | Migration errors silently swallowed |
| `.catch(() => {})` | `app/api/auth/register/route.ts:51` | Welcome email failure silent |
| Silent auth catch | `app/api/admin/import-sheet/route.ts:41-43` | JWT errors → `isAdmin: false` — potential auth bypass |

### Hardcoded Magic Numbers (35+ instances)
| Value | Files | Should be |
|-------|-------|-----------|
| `10000`, `20000` (timeout ms) | Multiple API routes | `TIMEOUTS.fetch`, `TIMEOUTS.sheet` |
| `10`, `5`, `100` (rate limits) | `lib/rate-limit.ts` | `RATE_LIMITS.login` etc. |
| `86400000` (24h ms) | Dashboard | `MS_PER_DAY` constant |
| `10000000`, `3000000` (price) | Course filters | Config constant |
| `'wedu.vn'` | 3 files | Single `APP_DOMAIN` constant |

### Hardcoded Secrets/URLs
| File:Line | Value | Fix |
|-----------|-------|-----|
| `app/api/auth/forgot-password/route.ts:5` | `'fallback-secret'` | Remove |
| `app/api/auth/reset-password/route.ts:5` | `'fallback-secret'` | Remove |
| `lib/email/send.ts:29` | `'https://wedu.vn'` as fallback | Move to config |
| `app/api/auth/login/route.ts:33` | `'@wedu.vn'` domain | Move to config constant |
| `lib/auth/jwt.ts:20` | `'7d'` expiration | Move to config |

### Duplicate Code
| Pattern | Locations | Fix |
|---------|-----------|-----|
| JWT admin verification | `import-sheet/route.ts`, `course-access/route.ts`, `middleware.ts` | Extract to `lib/auth/verify-admin.ts` |
| Supabase query building | `course-access/route.ts`, `videos/route.ts` | Extract shared query builder |
| Config getters | `lib/config.ts` — `getSheetId()/getSheetIdSafe()` duplicate pattern | Consolidate |

---

## 8. PRIORITY ACTION LIST

### P0 — Fix ngay (blocking/security)

| # | Issue | File:Line | Fix |
|---|-------|-----------|-----|
| P0-1 | Remove `'fallback-secret'` | `app/api/auth/forgot-password/route.ts:5` | Import `getSecret()` từ `lib/auth/jwt.ts` hoặc throw error |
| P0-2 | Remove `'fallback-secret'` | `app/api/auth/reset-password/route.ts:5` | Same |
| P0-3 | Remove plaintext password compare | `lib/auth/password.ts:22` | Remove `return plaintext === stored` line |
| P0-4 | Fix auto-create profile empty password | `app/api/auth/me/route.ts:32` | Use `LOCKED_PASSWORD_SENTINEL` |
| P0-5 | Add auth to /api/admin/bootstrap | `app/api/admin/bootstrap/route.ts` | Add requireAdmin() or disable in production |
| P0-6 | Add auth to /api/admin/seed-admin | `app/api/admin/seed-admin/route.ts` | Add requireAdmin() — account takeover risk |
| P0-7 | Add auth to /api/admin/setup-db | `app/api/admin/setup-db/route.ts` | Add requireAdmin() — info disclosure |

### P1 — Fix trong tuần (important)

| # | Issue | File | Fix |
|---|-------|------|-----|
| P1-1 | Implement one-time reset tokens | `app/api/auth/reset-password/route.ts` | Store token hash in DB, delete after use |
| P1-2 | Add pagination to admin endpoints | `lib/supabase/users.ts`, `orders.ts` | Add limit/offset params |
| P1-3 | Consolidate enrollment systems | `lib/supabase/enrollments.ts` | Migrate all refs to `course_access` |
| P1-4 | Implement proper RLS policies | `supabase/migrations/` | Per-user read policies, admin-only write |
| P1-5 | Reduce CoursesContext refetch | `contexts/CoursesContext.tsx:43` | Change 60s → 300s or use React Query |
| P1-6 | Tăng password min length | `app/api/auth/register/route.ts:25` | 6 → 8, add complexity check |
| P1-7 | Giảm JWT expiry | `lib/auth/jwt.ts:20` | 7d → 24h + refresh token |

### P2 — Fix trong tháng (nice to have)

| # | Issue | File | Fix |
|---|-------|------|-----|
| P2-1 | Migrate contexts to React Query | `contexts/*.tsx` | Already in package.json |
| P2-2 | Replace `select('*')` with specific columns | 26 locations | Reduce payload size |
| P2-3 | Enable courses cache | `lib/supabase/courses-cache.ts` | Implement TTL-based cache |
| P2-4 | Refactor large files | Top 10 list above | Extract components |
| P2-5 | Remove dead files | 10 files listed above | Delete |
| P2-6 | Add image format optimization | `next.config.js` | `formats: ['image/avif', 'image/webp']` |
| P2-7 | Batch insert in chapters POST | `app/api/chapters/[courseId]/route.ts` | Replace loop with batch |
| P2-8 | Drop unused tables | `course_chapters`, `course_sessions` | Migration to drop |
| P2-9 | Add FK constraint lesson_progress.lesson_id | `supabase/migrations/` | `lesson_id UUID REFERENCES lessons(id)` |
| P2-10 | Track migration status per course | `app/api/chapters/[courseId]/route.ts` | Add migrated flag or remove JSONB after migrate |

### P3 — Technical debt

| # | Issue | Fix |
|---|-------|-----|
| P3-1 | 52 `any` type instances | Add proper TypeScript types |
| P3-2 | console.log in production | Replace with logger or remove |
| P3-3 | Add nonce-based CSP | Replace `unsafe-inline`/`unsafe-eval` |
| P3-4 | Add email verification on register | Implement verify email flow |
| P3-5 | Implement payment gateway | Replace manual order approval |
| P3-6 | Add in-memory rate limit fallback | When Redis unavailable |
| P3-7 | Remove legacy `chapters` table usage | After confirming all data migrated |
| P3-8 | Add bundle analyzer | `next.config.js` webpack config |

---

---

## 9. LESSONS & CHAPTERS SYSTEM

### 9.1 Content Hierarchy — 3 Systems Song Song
| System | Tables | Status | Dùng ở đâu |
|--------|--------|--------|-------------|
| JSONB blob | `chapters` | Legacy | `lib/supabase/chapters.ts` — fallback #2 |
| Normalized | `course_sections` + `lessons` | Active (source of truth) | `lib/supabase/sections.ts`, chapters API |
| Phase 4 | `course_chapters` + `course_sessions` | Created but unused | Migration 004 only |

**Fallback chain** trong `app/api/chapters/[courseId]/route.ts`:
```
1. getSectionsByCourse() → normalized tables
2. getChaptersByCourse() → JSONB chapters table
3. FALLBACK_CHAPTERS → hardcoded in lib/fallback-chapters.ts
```
Background migration `migrateJsonbToNormalized()` chạy tự động khi fallback #2 hoặc #3 triggered.

### 9.2 Migration Status: INCOMPLETE
- Auto-migration chạy per-course khi user truy cập lần đầu
- Manual script `scripts/migrate-chapters-to-normalized.ts` chỉ xử lý course '1' và '6'
- **Không có tracking** course nào đã migrate vs chưa
- JSONB data không bị xoá sau migration (safe nhưng confusing)

### 9.3 Fallback Data Still Active
- `lib/fallback-chapters.ts`: Hardcoded chapters cho course '1' (14 lessons) và '6' (123+ lessons)
- `lib/fallback-data.ts`: 15 course definitions — **DEAD FILE** (not imported anywhere)
- Fallback data không tự update khi Supabase data thay đổi

### 9.4 Video Playback
| Provider | URL Formats Supported | Normalization |
|----------|----------------------|---------------|
| Bunny.net | `iframe.mediadelivery.net/embed/{lib}/{id}`, `player.mediadelivery.net`, `video.bunnycdn.com` | `normalizeBunnyEmbedUrl()` in `lib/utils/chapters.ts:48` |
| YouTube | `youtube.com/watch?v=`, `youtube.com/embed/`, `youtu.be/` | Parsed in migration script |

**Content URL routing** (`app/api/chapters/[courseId]/route.ts:279-283`):
- `video` → `directPlayUrl`
- `pdf` → `documentUrl` (fallback to `directPlayUrl`)
- `image` → `imageUrl` (fallback to `directPlayUrl`)
- `text` → `content` field
- Tất cả stored trong `direct_play_url` column — phân biệt bằng `lesson_type`

### 9.5 Progress Tracking
- `lesson_progress`: Per-lesson với optimistic concurrency (version field)
- Autosave mỗi 20s từ frontend (`hooks/useLessonProgress.ts:81`)
- `course_progress`: Aggregated, recalculated khi markLessonComplete()
- **Issue**: `lesson_id` là TEXT, không có FK → orphaned records nếu lesson bị xoá

### 9.6 Data Model Inconsistencies
| Issue | Chi tiết | Risk |
|-------|----------|------|
| Access tier naming | DB: `'free'/'premium'/'vip'` vs Legacy: `'Free'/'Premium'/'VIP'` | Case sensitivity bugs |
| `is_preview` vs `access_tier` | Hai field cùng control "free access" | Redundant logic |
| `lesson_id` no FK | `lesson_progress.lesson_id` TEXT, no constraint | Orphaned progress |
| Duration format | `lessons.duration` MM:SS string + `duration_seconds` INT | Parsing failures |
| `video_ref_id` unused | Migration 008 added FK to videos table, never populated | Dead column |

---

## STATS SUMMARY

| Metric | Value |
|--------|-------|
| Total files (excl. node_modules/.git/.next) | 193 |
| Total lines of code (TS/TSX/JS/CSS/SQL) | ~26,302 |
| Files > 500 lines | 10 |
| Dead files | 17 (~643 removable lines) |
| Security issues (Critical) | 7 |
| Security issues (Important) | 8 |
| Security issues (Minor) | 3 |
| Performance issues | 15+ |
| `select('*')` instances | 26 |
| `any` type instances | 52 |
| console.log in production | 12+ files |
| Legacy/duplicate tables | 5 |
| Duplicate enrollment systems | 3 |
