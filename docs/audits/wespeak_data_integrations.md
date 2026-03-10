# WESPEAK — Data Layer & Integrations

**Audit Date:** 2026-03-07

---

## Data Layer

### Primary Database: Google Sheets

**Sheet ID:** `1KOuhPurnWcHOayeRn7r-hNgVl13Zf7Q0z0r4d1-K0JY`

| Tab | Columns | Used By | Read/Write | Risk Notes |
|-----|---------|---------|------------|------------|
| **Users** | Email, Password, Role, Tên, Level, Enrolled, Completed, Phone | Auth (login/register), Admin (user management) | R/W | **Plaintext passwords**, no hashing |
| **Orders** | Thời gian, Mã đơn hàng, Tên, Email, SĐT, Khóa học, Mã khóa học, Tổng tiền, PTTT, Trạng thái, Mã GD | Checkout, Admin orders tab | Write (append only) | No idempotency key — duplicate orders possible |
| **Courses** | ID, Title, Description, Thumbnail, Instructor, Price, OriginalPrice, Rating, ReviewsCount, EnrollmentsCount, Duration, LessonsCount, Badge, Category, MemberLevel | Course catalog API | Read only (from Next.js) | Seed data in Code.gs (15 courses) |
| **Chapters** | CourseId, ChaptersJSON | Chapters API (CRUD) | R/W | JSON blob per course, complex chunking system |

**Access methods:**
1. Google Apps Script doGet/doPost (primary)
2. Google Sheets CSV export URL (fallback for reads)
3. Google Sheets API v4 (fallback for writes, requires GOOGLE_SHEETS_API_KEY — not currently set)

**Row counts:** UNKNOWN (requires runtime access)

### Secondary Store: Browser localStorage

| Key | Purpose | Written By | Risk |
|-----|---------|-----------|------|
| `wepower-user` | Current user session | AuthContext | Lost on browser change |
| `wepower-cart` | Shopping cart items | CartContext | Lost on browser change |
| `wepower-enrollments` | Course enrollment records | EnrollmentContext | **Critical data lost on browser change** |
| `wepower-orders` | Order history | EnrollmentContext | **Critical data lost on browser change** |
| `wepower-streak` | Learning streak counter | EnrollmentContext | Non-critical |
| `wepower-reviews` | Course reviews | CourseDetail page | **User content lost on browser change** |
| `wepower-comments` | Lesson comments | LearnPage | **User content lost on browser change** |
| `wepower-community-posts` | Community forum posts | Community page | **User content lost on browser change** |
| `wepower-profile` | Extra profile fields | Profile page | Non-critical |
| `wepower-passwords` | Changed passwords | Profile page | **Security risk — plaintext in localStorage** |
| `wepower-chapters-{id}` | Cached chapter data per course | CourseDetail, LearnPage | Cache, acceptable |
| `wepower-notifications` | Notification state | (implied) | Unknown |

### In-Memory Stores (Server)

| Store | Location | Purpose | Risk |
|-------|----------|---------|------|
| `rateLimitMap` | middleware.ts | Rate limiting per IP | Resets on cold start, not shared across instances |
| `cachedCourses` | app/api/courses/route.ts | 2min course cache | Not shared across Vercel serverless instances |

---

## Data Flow Issues

### Missing Idempotency
- **Orders:** `generateOrderId()` uses `Date.now()` — two rapid submissions create duplicates
- **Registration:** No double-submit protection — user can register twice with the same email if Apps Script is slow
- Evidence: `lib/googleSheets.ts:70`, `app/api/orders/route.ts`

### Missing Audit Trail
- No logging of who changed what, when
- User level changes via Apps Script leave no trace
- Order status changes have no history
- No created_at/updated_at fields on User records

### Orphan/Stale Data Risk
- Chapters tab accumulates chunked data (`courseId__0`, `courseId__0__0`, etc.)
- Cleanup is "best-effort, time-limited" (8s max) — stale chunks may persist
- Evidence: `app/api/chapters/[courseId]/route.ts:317-359`

### Data Inconsistency
- Enrollment data in localStorage is completely disconnected from Google Sheets
- A user enrolling on one device will not see enrollment on another
- Password changes in localStorage are not synced to Google Sheets
- Evidence: `contexts/EnrollmentContext.tsx`, `app/profile/page.tsx:96-99`

---

## Integrations

### 1. Google Apps Script (ACTIVE)
- **Type:** HTTP API (GET-based with query params)
- **URL:** `https://script.google.com/macros/s/AKfycby.../exec`
- **Actions:** login, register, appendOrder, getUsers, updateUserLevel, deleteUser, saveChapters, getChapters, getAllChapters
- **File:** `google-apps-script/Code.gs`, `lib/config.ts`
- **Risk:** Single point of failure. Cold start latency. URL length limit (~8192). No authentication on the Apps Script endpoint itself. 15s timeout.
- **Error handling:** Timeout + retry for chapters (2 retries). Login/register have fallback chain.

### 2. Google Sheets CSV Export (ACTIVE — Fallback)
- **Type:** HTTP GET (CSV format)
- **URL:** `https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={name}`
- **Used for:** Login fallback (read Users CSV), Register (check duplicate email), Courses (main data source)
- **File:** `lib/config.ts:24-27`, `lib/googleSheets.ts`
- **Risk:** Public URL — anyone with Sheet ID can read CSV. No auth required.

### 3. Google Sheets API v4 (STUB/INACTIVE)
- **Type:** REST API
- **Purpose:** Write fallback for register and orders
- **File:** `app/api/auth/register/route.ts:133-145`, `app/api/orders/route.ts:48-59`
- **Status:** Requires `GOOGLE_SHEETS_API_KEY` env var — **not currently set**
- **Risk:** Would need proper OAuth2 for write access; API key alone insufficient for writes

### 4. Bunny CDN / Bunny Stream (ACTIVE)
- **Type:** iframe embed
- **Domains:** `iframe.mediadelivery.net`, `player.mediadelivery.net`, `video.bunnycdn.com`
- **File:** `app/learn/[courseId]/page.tsx:11-17`, `app/courses/[id]/page.tsx:19-30`, CSP in `middleware.ts:118`
- **Used for:** Video lesson playback
- **Risk:** If Bunny CDN is down, videos fail silently. No fallback. No DRM/content protection beyond URL obfuscation.

### 5. Unsplash (ACTIVE)
- **Type:** Image CDN
- **Domain:** `images.unsplash.com`
- **Used for:** Course thumbnails
- **File:** `next.config.js:4-8`, CSP in `middleware.ts:117`
- **Risk:** Low — decorative images only

### 6. Google Fonts (ACTIVE)
- **Type:** Font CDN
- **Domains:** `fonts.googleapis.com`, `fonts.gstatic.com`
- **File:** `app/layout.tsx:23-24`, CSP in `middleware.ts:115-116`
- **Risk:** Low

### Integration Risk Summary

| Integration | Status | Has Timeout | Has Retry | Has Fallback | Error Handling |
|-------------|--------|-------------|-----------|--------------|----------------|
| Google Apps Script | ACTIVE | Yes (15-25s) | Chapters: Yes (2x) | Login: Yes (3 methods) | Moderate |
| Google Sheets CSV | ACTIVE | Yes (10-15s) | No | N/A (is itself a fallback) | Basic |
| Google Sheets API v4 | STUB | Yes (10s) | No | Yes (demo mode) | Basic |
| Bunny CDN | ACTIVE | No | No | No | Silent fail |
| Unsplash | ACTIVE | No | No | No | Broken image |
