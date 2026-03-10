# WESPEAK — Runtime Architecture

**Audit Date:** 2026-03-07

---

## Boot Sequence

```
1. Next.js server starts (next dev / next start)
2. middleware.ts loaded → rate limiter Map initialized, setInterval cleanup
3. app/layout.tsx renders provider chain:
   ToastProvider → AuthProvider → CoursesProvider → EnrollmentProvider → CartProvider
4. AuthProvider: reads localStorage/cookie for saved user session
5. CoursesProvider: fetches /api/courses on mount
6. EnrollmentProvider: reads localStorage for enrollments/orders
7. CartProvider: reads localStorage for cart items
```

## Runtime Roles

| Role | Technology | Purpose |
|------|-----------|---------|
| Web Server | Next.js 14 on Vercel | SSR/SSG + API routes |
| Backend API | Google Apps Script | CRUD operations on Google Sheets |
| Database | Google Sheets | Users, Orders, Courses, Chapters |
| Video CDN | Bunny CDN (iframe.mediadelivery.net) | Video streaming |
| Client Store | Browser localStorage | Enrollments, cart, reviews, comments, profile |

## Main Request Flows

### 1. Page Load (Home)
```
Browser → Vercel/Next.js → middleware (rate limit + headers)
  → app/page.tsx renders
  → CoursesProvider fetches /api/courses
    → /api/courses/route.ts checks in-memory cache (2min TTL)
    → If stale: fetch Google Sheets CSV + Google Apps Script (getAllChapters for stats)
    → Parse CSV → return JSON
  → Render course cards
```

### 2. Login
```
Browser → POST /api/auth/login
  → Method 1: Google Apps Script ?action=login (15s timeout)
  → Method 2 (fallback): Read Users CSV from Google Sheets, compare plaintext passwords
  → Method 3 (fallback): Local demo user (admin@wepower.vn/123456)
  → Return user object → Client stores in localStorage + base64 cookie
```

### 3. Course Detail / Learn Page
```
Browser → app/courses/[id]/page.tsx or app/learn/[courseId]/page.tsx
  → Read chapters from localStorage (instant display)
  → Fetch /api/chapters/{courseId}
    → Google Apps Script ?action=getChapters
    → Complex chunked read system (_n/_p format, _chunks legacy format)
    → Parallel batch reads with retries
  → Render video player (Bunny CDN iframe or HTML5 video)
```

### 4. Order/Checkout
```
Browser → app/checkout/page.tsx
  → User fills form → POST /api/orders
    → Method 1: Google Apps Script ?action=appendOrder
    → Method 2: Google Sheets API (if GOOGLE_SHEETS_API_KEY set)
    → Method 3: Demo mode (order not persisted)
  → Client-side: EnrollmentContext.addOrder → auto-enroll courses → localStorage
```

### 5. Admin - Course Editor
```
Browser → app/admin/courses/[id]/page.tsx (1,427 LOC)
  → Load chapters from API
  → Rich editor for chapters/lessons (add, edit, delete, reorder, drag across chapters)
  → Auto-save every 60s
  → POST /api/chapters/{courseId}
    → Chunked save system (URL length limit ~7500 chars)
    → Lesson-level partitioning for large chapters
    → Integrity check (expectedLessons count)
    → Stats computation saved alongside
    → Old data cleanup (time-limited 8s)
```

## Scheduled Jobs / Workers

**NONE.** There are no:
- Cron jobs
- Background workers
- Queue consumers
- Scheduled tasks
- Email notifications

The `setInterval` in `middleware.ts` (line 21-28) runs every 60s to clean up the in-memory rate limiter map. This is the only recurring process.

## Active Surfaces

| Surface | Path | Status |
|---------|------|--------|
| Home | `/` | ACTIVE |
| Courses list | `/courses` | ACTIVE |
| Course detail | `/courses/[id]` | ACTIVE |
| Learn (video player) | `/learn/[courseId]` | ACTIVE |
| Login | `/login` | ACTIVE |
| Register | `/register` | ACTIVE |
| Dashboard | `/dashboard` | ACTIVE |
| Profile | `/profile` | ACTIVE |
| Cart | `/cart` | ACTIVE |
| Checkout | `/checkout` | ACTIVE |
| My Courses | `/my-courses` | ACTIVE |
| Community | `/community` | ACTIVE (localStorage only) |
| Certificates | `/certificates` | ACTIVE (localStorage only) |
| Pricing | `/pricing` | ACTIVE (static page) |
| Admin Panel | `/admin` | ACTIVE |
| Admin Course Editor | `/admin/courses/[id]` | ACTIVE |
| API: Login | `/api/auth/login` | ACTIVE |
| API: Register | `/api/auth/register` | ACTIVE |
| API: Courses | `/api/courses` | ACTIVE |
| API: Orders | `/api/orders` | ACTIVE |
| API: Chapters CRUD | `/api/chapters/[courseId]` | ACTIVE |
| API: Users list | `/api/auth/users` | ACTIVE (admin only) |
| API: Login form | `/api/auth/login-form` | ACTIVE (form POST) |
| API: Chapters test | `/api/chapters/test` | BLOCKED in production |

## State/Flow Summary

The system has **no server-side session state**. All user state lives in:
1. **Google Sheets** — Users, Courses, Orders, Chapters (persistent but slow)
2. **Browser localStorage** — Enrollments, cart, reviews, comments, community posts, profile, chapters cache, streak
3. **Cookie** — Base64-encoded user object (for middleware admin check)
4. **In-memory** — Rate limiter map (middleware), courses cache (API route)

This means: changing browsers or clearing localStorage = losing all enrollment progress, order history, reviews, and community posts.
