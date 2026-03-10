# WESPEAK (WePower) — Audit Overview

**Audit Date:** 2026-03-07
**Repo:** /home/user/Wepower-demo
**Branch:** claude/continue-project-work-sV7yd
**Mode:** READ-ONLY

---

## Executive Summary

WESPEAK (branded "WePower Academy" / "Wepower Elearning") is a **Vietnamese e-learning platform** built as a Next.js 14 single-page application. It uses **Google Sheets as its primary database** via Google Apps Script as a backend API, with Bunny CDN for video hosting.

The system is at **prototype/MVP stage** (~40-50% production readiness). The frontend is reasonably complete with 15+ pages and a polished dark-theme UI. The backend is fragile — it relies entirely on Google Sheets/Apps Script with no real database, no password hashing, no session management, and heavy localStorage usage for critical state (enrollments, orders, progress).

---

## Codebase Size

| Metric | Value |
|--------|-------|
| Total code files (excl. node_modules/.next) | 50 |
| TypeScript/TSX files | 48 |
| JavaScript files | 2 |
| CSS files | 1 |
| Total LOC | 11,738 |
| Largest file | `app/admin/courses/[id]/page.tsx` — 1,427 LOC |
| Files > 800 LOC | 4 |
| Test files | **0** |

## Languages

- **TypeScript/TSX:** 99% (48 files, ~11,500 LOC)
- **JavaScript:** 1% (next.config.js, postcss.config.js)
- **Google Apps Script:** 1 file (Code.gs, 638 LOC) — runs externally

## Top Folders

```
app/           — 25 files (pages + API routes)
  api/         — 8 API route files
  admin/       — 2 pages (admin panel, course editor)
components/    — 7 UI components
contexts/      — 4 React contexts
lib/           — 4 utility modules
hooks/         — 1 custom hook
providers/     — 1 provider
google-apps-script/ — 1 file (Code.gs)
public/        — static assets
```

## Entry Points

1. **Web app:** `app/layout.tsx` → `app/page.tsx` (Next.js App Router)
2. **API routes:** `app/api/auth/login/route.ts`, `app/api/courses/route.ts`, etc.
3. **Google Apps Script:** `google-apps-script/Code.gs` (deployed as Google Web App)
4. **Middleware:** `middleware.ts` (rate limiting + security headers + admin check)

## Key Findings

1. **NO DATABASE** — Google Sheets is the sole persistent store (Users, Orders, Courses, Chapters tabs)
2. **NO PASSWORD HASHING** — Passwords stored in plaintext in Google Sheets
3. **NO SESSION MANAGEMENT** — Auth via base64-encoded cookie + localStorage
4. **NO TESTS** — Zero test files in the project
5. **HEAVY localStorage DEPENDENCY** — Enrollments, orders, reviews, comments, community posts, cart, profile all stored in browser localStorage only
6. **CODE DUPLICATION** — CSV parser duplicated in 4+ files; `normalizeChapters`/`isEmbedUrl` duplicated in 3 files
7. **HARDCODED DEMO CREDENTIALS** — `admin@wepower.vn / 123456` in both client and server code
8. **SECRETS IN REPO** — `.env.local` and `.env.production` committed with Google Script URLs and Sheet IDs

## Audit Scope

- All 50 source files read and analyzed
- Google Apps Script backend analyzed
- Environment configuration analyzed
- No runtime testing performed (read-only audit)
- No database queries executed

## Unknowns

- Actual row counts in Google Sheets (requires runtime access)
- Google Apps Script execution quotas/limits status
- Bunny CDN configuration and video count
- Vercel deployment configuration details
- Actual user count and traffic patterns
