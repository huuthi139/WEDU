# WESPEAK — Final Audit Report

**Audit Date:** 2026-03-07
**Auditor:** Claude Code (READ-ONLY mode)
**Scope:** Full codebase, architecture, data layer, integrations, risks, maturity

---

## 1. Codebase Overview

WESPEAK ("WePower Academy") is a Vietnamese e-learning platform built with:
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes → Google Apps Script → Google Sheets
- **Video:** Bunny CDN (iframe embeds)
- **Deployment:** Vercel

**Scale:** 50 source files, 11,738 LOC, 15 pages, 7 API routes, 4 React contexts

The codebase is a **monolithic single-developer project** with no tests, no CI/CD, and no documentation beyond setup guides.

---

## 2. Runtime Architecture

The system runs as a **serverless Next.js application on Vercel** with:
- No persistent server process (serverless functions)
- Google Sheets as the sole external database
- Google Apps Script as backend middleware (translates HTTP to Sheets operations)
- Heavy browser localStorage usage for user-facing features

**Boot sequence:** Provider chain (Toast → Auth → Courses → Enrollment → Cart) initializes from localStorage on mount, then fetches courses from API.

**Key flow pattern:** Browser → Next.js API route → Google Apps Script → Google Sheets → Response

---

## 3. Active Subsystems

| Subsystem | Quality | Notes |
|-----------|---------|-------|
| Course Catalog | Good | Functional with caching, stats computation |
| Video Player | Good | Bunny CDN integration, level-based access control |
| Authentication | Functional but insecure | 3-layer fallback, but plaintext passwords |
| Admin Panel | Functional | Full CRUD for courses, view students/orders |
| Course Editor | Good | Complex chunked save system, auto-save, drag-drop |
| Cart/Checkout | Functional | Full flow but no real payment integration |
| Community | Functional | Posts, comments, likes — localStorage only |
| Dashboard | Functional | Stats display, enrolled courses |
| Security Headers/Rate Limiting | Partial | Headers good, rate limiter non-functional on Vercel |

---

## 4. Built but Inactive / Problematic Subsystems

| Subsystem | Issue |
|-----------|-------|
| Password Change | Saves to localStorage only, never syncs to Google Sheets |
| Google Sheets API v4 writes | Code exists but `GOOGLE_SHEETS_API_KEY` not configured |
| Chapters test endpoint | Blocked in production by middleware |
| Login form POST handler | `/api/auth/login-form` — redirects to `login.html` which doesn't exist |
| Weekly activity chart | Dashboard shows hardcoded data, not real activity |
| Community stats (members count) | Hardcoded `15,847` — not real data |

---

## 5. Data Layer

### Google Sheets (4 tabs)
- **Users:** Auth data with plaintext passwords
- **Courses:** 15 seed courses with metadata
- **Orders:** Append-only order log
- **Chapters:** JSON blobs with complex chunking scheme

### Browser localStorage (12+ keys)
- **Critical data without server backup:** enrollments, orders, reviews, comments, community posts
- **Risk:** All user progress and content is device-bound

### In-Memory (2 stores)
- Rate limiter map (middleware) — ineffective on Vercel
- Course cache (2min TTL) — per-instance, not shared

---

## 6. Integrations

| Integration | Status | Reliability |
|-------------|--------|------------|
| Google Apps Script | ACTIVE | Moderate — cold start delays, URL length limits |
| Google Sheets CSV | ACTIVE | Good — used as read fallback |
| Bunny CDN | ACTIVE | Good — standard iframe embed |
| Unsplash | ACTIVE | Low risk — image CDN |
| Google Fonts | ACTIVE | Low risk |
| MoMo/VNPay/Bank Transfer | STUB | Listed in UI but no actual integration |
| Google Sheets API v4 | STUB | Code exists but API key not configured |

---

## 7. Tests & Coverage View

**Test files:** 0
**Test framework:** None configured
**Coverage:** 0%

There are no unit tests, integration tests, or end-to-end tests. The `package.json` has no test dependencies or scripts beyond `next lint`.

**Critical untested paths:**
- Login/register flows (3-method fallback chains)
- Chapter save/read (complex chunking logic with partitioning)
- Order submission
- CSV parsing (duplicated in 4 files)
- Admin operations

---

## 8. Risk Hotspots

### Critical (must fix before production)
1. **Plaintext passwords** in Google Sheets
2. **Secrets committed** to git (.env files)
3. **Zero tests**

### High (should fix soon)
4. **Enrollment/order data loss** — localStorage only
5. **No session management** — forgeable admin cookie
6. **No health monitoring**
7. **No rollback/backup mechanism**
8. **Google Apps Script as sole backend** — single point of failure

### Medium (improve when possible)
9. **God files** (4 files > 800 LOC)
10. **Code duplication** (CSV parser 4x, normalizeChapters 3x)
11. **Race conditions** in concurrent saves
12. **Silent exception swallowing**
13. **In-memory rate limiter** ineffective on serverless

---

## 9. System Maturity Assessment

| Layer | Score | Level | Justification |
|-------|-------|-------|---------------|
| **Core Application (Frontend)** | 55% | Partial Working | All pages functional, good UI, but god files and duplication |
| **Core Application (API)** | 40% | Prototype | Working but fragile, no proper error handling, no auth on API |
| **Data Layer** | 15% | Concept | Google Sheets is not a database. No hashing, no transactions, no indexing |
| **Authentication/Security** | 20% | Concept | Plaintext passwords, no JWT, forgeable cookies, secrets in repo |
| **Integrations** | 45% | Partial Working | Google ecosystem works with fallbacks, video works, payments stub |
| **Observability** | 5% | Concept | Only console.error, no monitoring, no health check |
| **Testing** | 0% | None | Zero tests |
| **Automation/CI** | 10% | Concept | Vercel auto-deploy exists, no CI pipeline, no linting in CI |
| **Admin/Operations** | 50% | Partial Working | Admin panel functional, course editor sophisticated |

**Overall System Maturity: ~30% (Prototype)**

---

## 10. Recommended Next Steps

### Immediate (Week 1-2)
1. **Hash passwords** — Add bcrypt to registration and migrate existing passwords
2. **Remove .env files from git** — Add to .gitignore, rotate Google credentials
3. **Add Vitest** — Write tests for login flow, CSV parser, chapters save/read
4. **Add health check endpoint** — `/api/health` checking Google connectivity

### Short-term (Week 3-4)
5. **Server-side enrollment persistence** — Add "Enrollments" tab to Google Sheets or migrate to a real database
6. **Implement JWT auth** — Replace base64 cookie with signed tokens
7. **Extract shared utilities** — Move CSV parser, normalizeChapters, fetchWithTimeout to shared modules
8. **Break up god files** — Split admin page into tab components

### Medium-term (Month 2)
9. **Migrate to a real database** — Supabase, PlanetScale, or similar (free tier available)
10. **Add payment integration** — Implement actual MoMo/VNPay webhook flow
11. **Add monitoring** — Sentry or similar for error tracking
12. **Server-side community/reviews** — Move from localStorage to database

### Long-term
13. **Add CI/CD pipeline** — Automated tests on PR
14. **Implement proper caching** — Redis or Vercel KV
15. **Add email notifications** — Order confirmation, password reset
16. **Content protection** — Signed URLs for video access
