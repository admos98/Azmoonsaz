# AGENTS.md

## Project

**Azmoonsaz** (آزمون‌ساز) — Persian/Farsi online exam management system. Teacher creates exams, students take them securely. RTL UI.

## Stack

- React 19 + TypeScript + Vite 6 + Tailwind CSS v4 (via `@tailwindcss/vite` plugin, not PostCSS)
- Supabase (database, auth) + Vercel (hosting, serverless API)
- Playwright for E2E tests

## Architecture

This is a **single-page app + single serverless function**. Not a monorepo.

- **Frontend**: `src/` — React SPA. Entry: `src/main.tsx` → `src/App.tsx`
- **API**: `api/index.js` — ONE catch-all Vercel serverless function. All `/api/*` routes are dispatched internally via a `routes` map (line ~718). There are no separate API files per route.
- **Shared API helpers**: `api/_lib/` — auth, crypto, rate limiting, Supabase admin client, exam security
- **Frontend services**: `src/services/` — dual-mode layer. Each service (students, questions, exams, grading) checks `isSecureTeacherModeAvailable()` and either calls the real API or falls back to localStorage mock data.
- **Mock data**: `src/mock/` and `src/mockData.ts` — used when Supabase is not configured or `VITE_ENABLE_MOCK_MODE=true`

## Runtime Modes

Controlled by `src/config/runtimeMode.ts`:
- **Secure backend mode**: Supabase configured + mock mode off → real API calls
- **Mock/offline mode**: `VITE_ENABLE_MOCK_MODE=true` or no Supabase env → localStorage fallback

The `apiClient.ts` (`src/lib/apiClient.ts`) also has inline mock fallbacks for student exam endpoints when the API is unreachable.

## Commands

```bash
npm run dev          # Vite dev server on :3000, API proxy to :3001
npm run dev:api      # Vercel dev server for API on :3001
npm run dev:vercel   # Full Vercel dev (frontend + API)
npm run lint         # tsc --noEmit (type-check only, no ESLint)
npm run build        # vite build
npm run predeploy    # lint → build → verify:prod → deploy:check (sequential)
npm run test:e2e     # Playwright tests (starts dev server automatically)
npm run check:env    # Validate .env.local has all required vars
npm run verify:prod  # Scan src/api docs for leaked secret markers
```

**`lint` and `typecheck` are the same command** (`tsc --noEmit`). There is no ESLint or Prettier configured.

## Dev Server Quirks

- Vite dev server proxies `/api` → `http://localhost:3001` (configured in `vite.config.ts`). For full-stack local dev, run both `npm run dev` and `npm run dev:api`.
- `DISABLE_HMR=true` disables HMR and file watching — used during AI Studio agent edits to prevent flickering. Do not modify this behavior.
- Path alias `@/*` maps to project root (both `tsconfig.json` paths and Vite resolve alias).

## Environment Variables

See `.env.example`. Two categories:

**Public (VITE_ prefix, safe in browser bundle):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required for secure backend mode
- `VITE_ENABLE_MOCK_MODE` — force mock/offline mode

**Server-only (NEVER prefix with VITE_, NEVER use in src/):**
- `SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_ID_PEPPER` (min 32 chars), `GEMINI_API_KEY`

The `api/_lib/env.js` auto-loads `.env.local` from cwd upward for Vercel functions. The `tools/env.mjs` does the same for CLI tools.

## Security Rules

These are enforced by `verify:prod` and are critical:

- **Never** put `SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_ID_PEPPER`, or `GEMINI_API_KEY` in `src/` or any `VITE_`-prefixed variable
- **Never** store plain national IDs — only hashes (`nationalIdHash`) and last-4 digits
- **Never** expose answer keys (`isCorrect`, `correctAnswer`) in student-facing API responses — `examSecurity.js` strips them
- Student exam access goes through JWT session tokens, not Supabase client auth

## API Route Pattern

All routes live in `api/index.js`. To add a new route:
1. Write the handler function in `api/index.js`
2. Add it to the `routes` object (e.g., `'my/route': handleMyRoute`)
3. The route path maps to `/api/my/route`

Teacher routes use `requireTeacher()` for Supabase Auth verification. Student routes use JWT session tokens from `studentSession.js`.

## Testing

- E2E only: `tests/e2e/exam-flow.spec.ts` via Playwright
- Test dir is excluded from `tsconfig.json` (`"exclude": ["tests"]`)
- Playwright config auto-starts `npm run dev` as the webServer
- No unit test framework is configured

## UI Conventions

- All UI text is in **Persian/Farsi** — do not add English strings to components
- Layout is RTL (`dir="rtl"`) — use `mr-*` for sidebar offset, not `ml-*`
- Tailwind v4 — uses `@tailwindcss/vite` plugin, not the PostCSS plugin. No `tailwind.config.js` needed.
- Icons from `lucide-react`, animations from `motion` (framer-motion successor)

## Supabase Migrations

Located in `supabase/migrations/`. Schema draft in `supabase/schema-security-draft.sql`. Read `docs/supabase-hardening.md` and `docs/supabase-first-run.md` before working with the database.

## Docs

The `docs/` folder has detailed architecture docs. Most relevant for agents:
- `docs/security-architecture.md` — security model overview
- `docs/supabase-hardening.md` — RLS policies and database security
- `docs/local-api-testing.md` — how to test API locally
