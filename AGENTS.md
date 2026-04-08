# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Important repository notes
- No existing `AGENTS.md`/`WARP.md`/`CLAUDE.md`/Cursor/Copilot instruction files were found in this repo.
- `README.md` and `SETUP_GUIDE.md` still reference an old local path (`/Users/kevinnguyen/Downloads/wedu-demo`). Run commands from this repository root instead.

## Core development commands
Run from repository root:

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run start
```

```bash
npm run lint
```

## Test commands
- Full test run:
```bash
npm run test
```
- Watch mode:
```bash
npm run test:watch
```
- Coverage:
```bash
npm run test:coverage
```
- Targeted suites defined in `package.json`:
```bash
npm run test:security
npm run test:data
npm run test:stability
npm run test:all
```
- Run a single test file:
```bash
npx vitest run tests/auth/jwt.test.ts
```
- Run a single test by name:
```bash
npx vitest run tests/auth/jwt.test.ts -t "token expires"
```

## High-level architecture

### Runtime model
- This is a Next.js App Router app (`app/`) with mixed server/client rendering.
- `app/layout.tsx` composes global providers in this order: `ErrorBoundary` → `QueryProvider` (React Query) → `ToastProvider` → auth/course/enrollment/cart contexts.

### Frontend data flow
- Client pages and components generally fetch through internal API routes (for example `contexts/CoursesContext.tsx` calls `/api/courses`).
- Contexts in `contexts/` are the primary client-side state layer for auth, courses, cart, and enrollments.
- React Query is available globally via `providers/QueryProvider.tsx`, with a 30s stale time default.

### API layer and response conventions
- API endpoints are organized under `app/api/**/route.ts` by domain (`auth`, `courses`, `enrollments`, `admin`, `quiz`, etc.).
- Standard success/error response helpers are centralized in `lib/api/response.ts` (`apiSuccess`, `apiError`, `ERR.*`) with a generated `requestId` in metadata.

### Auth, authorization, and security
- Session model uses JWT in cookie `wedu-token` (`lib/auth/session.ts`, `app/api/auth/login/route.ts`).
- Middleware (`middleware.ts`) applies:
  - route protection for authenticated/admin pages,
  - API/auth rate limiting (Upstash Redis via `lib/rate-limit.ts`),
  - security headers and CSP.
- Server-side permission checks live in `lib/auth/guards.ts` and `lib/auth/permissions.ts`.

### Data access and source of truth
- Supabase is treated as the runtime source of truth (see `app/api/courses/route.ts`, `app/api/health/route.ts`).
- Supabase access is wrapped in `lib/supabase/*`:
  - `client.ts`: server-side service-role client,
  - `browser.ts`: browser anon client,
  - domain modules (`courses.ts`, `users.ts`, `orders.ts`, etc.) encapsulate queries.
- DB schema evolution lives in `supabase/migrations/*.sql`; seed data is in `supabase/seed.sql`.

### Operational scripts
- Repository scripts in `scripts/` are focused on course-access cleanup/fixes and data migration tasks; check these before writing one-off migration logic.
