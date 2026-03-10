# WESPEAK — Subsystems Matrix

**Audit Date:** 2026-03-07

---

| Subsystem | Purpose | Main Files | Dependencies | Status | Evidence | Notes |
|-----------|---------|------------|-------------|--------|----------|-------|
| **Authentication** | Login/register users | `contexts/AuthContext.tsx`, `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts` | Google Apps Script, Google Sheets CSV | ACTIVE | 3 fallback methods (Apps Script → CSV → local demo) | No password hashing, no JWT, base64 cookie |
| **Course Catalog** | List and display courses | `contexts/CoursesContext.tsx`, `app/api/courses/route.ts`, `app/courses/` | Google Sheets CSV, Google Apps Script | ACTIVE | Fetches from Sheets, 2min in-memory cache | 15 seed courses in Code.gs |
| **Course Content (Chapters)** | Store/serve video lessons | `app/api/chapters/[courseId]/route.ts` | Google Apps Script (Chapters tab) | ACTIVE | Complex chunked save/read with partitioning | Most complex subsystem (454 LOC route) |
| **Video Player** | Play course videos | `app/learn/[courseId]/page.tsx`, `app/courses/[id]/page.tsx` | Bunny CDN (iframe.mediadelivery.net) | ACTIVE | iframe embed + HTML5 video fallback | Duplicated normalizeChapters in 3 files |
| **Admin Panel** | Manage courses, students, orders | `app/admin/page.tsx` (1,119 LOC) | CoursesContext, EnrollmentContext, Google Apps Script | ACTIVE | 4 tabs: overview, courses, students, orders | Students tab fetches from /api/auth/users |
| **Admin Course Editor** | CRUD chapters/lessons per course | `app/admin/courses/[id]/page.tsx` (1,427 LOC) | Chapters API, Google Apps Script | ACTIVE | Full editor with drag-drop, auto-save, thumbnail editing | God file at 1,427 LOC |
| **Cart** | Shopping cart for courses | `contexts/CartContext.tsx`, `app/cart/page.tsx` | localStorage | ACTIVE | Add/remove/quantity, persisted to localStorage | No server sync |
| **Checkout/Orders** | Process course purchases | `app/checkout/page.tsx`, `app/api/orders/route.ts`, `lib/googleSheets.ts` | Google Apps Script, Google Sheets | ACTIVE | 3 payment methods (bank, MoMo, VNPay) — all stub | No actual payment integration |
| **Enrollment Tracking** | Track enrolled courses, progress | `contexts/EnrollmentContext.tsx` | localStorage only | ACTIVE | Progress %, completed lessons, streak tracking | **localStorage only — no server persistence** |
| **User Profile** | View/edit profile | `app/profile/page.tsx` | localStorage, AuthContext | ACTIVE | Edit name, phone, bio, location, occupation | Extra fields saved to localStorage only |
| **Dashboard** | User learning dashboard | `app/dashboard/page.tsx` | AuthContext, EnrollmentContext, CoursesContext | ACTIVE | Stats, in-progress courses, achievements | Weekly activity chart is hardcoded (not real data) |
| **Community** | Forum-like posts/comments | `app/community/page.tsx` (641 LOC) | localStorage only | ACTIVE | Posts, comments, likes, tags, delete | **100% localStorage — no server persistence** |
| **Reviews** | Course reviews/ratings | `app/courses/[id]/page.tsx` (reviews section) | localStorage only | ACTIVE | Star rating + text review | localStorage only |
| **Lesson Comments** | Per-lesson comments | `app/learn/[courseId]/page.tsx` (comments section) | localStorage only | ACTIVE | Comments with like/reply UI | localStorage only |
| **Certificates** | Show completion certificates | `app/certificates/page.tsx` | EnrollmentContext (localStorage) | ACTIVE | Generated from enrollment progress data | Mock/visual only, no verification |
| **Pricing** | Membership pricing page | `app/pricing/page.tsx` | None | ACTIVE | Static pricing display | No actual payment/upgrade flow |
| **Notifications** | In-app notifications | `app/dashboard/page.tsx` (implied) | None | MISSING | No notification system found | — |
| **Search** | Search courses | `app/courses/page.tsx` | CoursesContext | PARTIAL | Client-side filter by category and text only | No dedicated search engine |
| **Password Change** | Change user password | `app/profile/page.tsx` | localStorage only | BUILT_INACTIVE | Saves new password to localStorage only | **Does NOT update Google Sheets** |
| **Rate Limiting** | Protect API endpoints | `middleware.ts` | In-memory Map | ACTIVE | Login: 10/min, Register: 5/min, API: 100/min | Resets on server restart |
| **Security Headers** | CSP, HSTS, etc. | `middleware.ts` | None | ACTIVE | 7 security headers including CSP | unsafe-inline/unsafe-eval in CSP |
| **Member Levels** | Free/Premium/VIP access control | `contexts/AuthContext.tsx`, multiple pages | Google Sheets (Level column) | ACTIVE | 3 tiers controlling lesson access | Level upgrade via admin only (no self-serve) |
| **User Management (Admin)** | List/manage users | `app/api/auth/users/route.ts`, `app/admin/page.tsx` | Google Apps Script, middleware | ACTIVE | Admin can view users, update levels, delete | Update/delete via Apps Script API |
| **Observability** | Logging, monitoring | None | None | MISSING | Only console.error in API routes | No structured logging, no metrics, no health check |
| **Caching** | Course data caching | `app/api/courses/route.ts` | In-memory variable | PARTIAL | 2min in-memory cache, stale-while-revalidate | No Redis/external cache |
| **Email/SMS** | Notifications to users | None | None | MISSING | No email sending code found | — |
| **Payment Gateway** | Actual payment processing | None | None | MISSING | Payment methods listed but all are manual/stub | Bank transfer info says "Liên hệ admin" |
| **Analytics** | User behavior tracking | None | None | MISSING | No analytics code found | — |
| **Audit Logging** | Track system changes | None | None | MISSING | No audit trail for data mutations | — |
