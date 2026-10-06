# AGENTS.md

## Project

**Azmoonsaz** (آزمون‌ساز) — Persian/Farsi online exam management system. Teacher creates exams, students take them securely. RTL UI.

## Stack

- React 19 + TypeScript + Vite 6 + Tailwind CSS v4 (via `@tailwindcss/vite` plugin, not PostCSS)
- Supabase (database, auth) + Vercel (hosting, serverless API)
- Vitest (unit, jsdom) + Playwright (E2E)
- ESLint (`eslint.config.mjs`) + Prettier (`.prettierrc`)

## Architecture

This is a **single-page app + one serverless entry function**. Not a monorepo.

- **Frontend**: `src/` — React SPA. Entry: `src/main.tsx` → `src/App.tsx`
- **API**: `api/index.js` — ONE Vercel serverless entry. The `routes` map (line ~25) dispatches to handlers **in `api/routes/*.js`** (`public.js`, `student.js`, `teacher.js`, `auth.js`). Add new routes there, not in `api/index.js` itself.
- **Shared API helpers**: `api/_lib/` — `auth`/`teacherAuth` (Supabase Auth), `studentSession` (HMAC-SHA256 JWT, hand-rolled via `node:crypto`), `crypto`, `env`, `examSecurity`, `http`, `rateLimit`, `supabaseAdmin`, `utils`
- **Frontend services**: `src/services/` — one mode only: every service calls the real API through `src/lib/apiClient.ts`. `isSecureTeacherModeAvailable()` (`src/services/teacherApi.ts`) and `isSecureBackendMode()` (`src/config/runtimeMode.ts`) are `return true` stubs kept for call-site compatibility; there is NO mock/localStorage data path (see `docs/mock-cleanup-plan.md`, `docs/route-migration-and-mock-lockdown.md`).
- **One real localStorage use**: `src/services/offlineAnswerQueue.ts` — queues student answers when a save fails and retries later. Not mock data.
- **Routing**: path-based inside `App.tsx` (`window.location.pathname`), not a router library. `vercel.json` rewrites `/api/:path*` → `/api?path=:path*`.

## Commands

```bash
npm run dev          # Vite dev server on :3000, API proxy to :3001
npm run dev:api      # Vercel dev server for API on :3001
npm run dev:vercel   # Full Vercel dev (frontend + API)
npm run lint         # eslint src/
npm run typecheck    # tsc --noEmit (tests/ and src/test are EXCLUDED — type errors in tests do not fail this)
npm run format       # prettier --write src/
npm run test         # vitest run (unit, jsdom — config in vite.config.ts, setup src/test/setup.ts)
npm run test:e2e     # playwright test (tests/e2e/)
npm run build        # vite build
npm run check        # typecheck + lint + content gates + build
npm run gate         # check + tests + bundle budget — RUN THIS BEFORE EVERY PUSH
npm run check:contrast|check:tokens|check:theme|check:glass|check:library|check:typography|check:a11y-buttons|check:bundle
npm run check:env    # validate .env.local has all required vars
npm run verify:prod  # scan src/api docs for leaked secret markers
npm run predeploy    # lint → build → verify:prod → deploy:check (sequential)
```

Quality gates live in `tools/check-*.mjs`: WCAG contrast (both themes), theme-token purity, dead-token ratchet (baseline 43, only down), glass discipline, library adoption (raw-button ratchet), typography, icon buttons, bundle budget (incl. no dev-harness/deploy cruft in `dist/`).

## Dev Server Quirks

- Vite dev server proxies `/api` → `http://localhost:3001` (configured in `vite.config.ts`). For full-stack local dev, run both `npm run dev` and `npm run dev:api`.
- `DISABLE_HMR=true` disables HMR and file watching — used during AI Studio agent edits to prevent flickering. Do not modify this behavior.
- Path alias `@/*` maps to project root (both `tsconfig.json` paths and Vite resolve alias).
- `import.meta.env.DEV` gates the `/dev/fixtures` + `/dev/topbar` lab routes AND their lazy imports — production builds drop the chunks entirely (bundle gate asserts this). Don't un-gate them.

## Environment Variables

See `.env.example`. Two categories:

**Public (VITE\_ prefix, safe in browser bundle):**

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required (read via `src/config/env.ts`)
- `VITE_APP_URL`
- `VITE_ENABLE_MOCK_MODE` — listed in `.env.example` but **not read anywhere**; no mock mode exists. Leave it.

**Server-only (NEVER prefix with VITE\_, NEVER use in src/):**

- `SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_ID_PEPPER` (min 32 chars)
- `GEMINI_API_KEY` — reserved; no code path consumes it (there is no AI grading endpoint)
- `APP_URL`

The `api/_lib/env.js` auto-loads `.env.local` from cwd upward for Vercel functions. The `tools/env.mjs` does the same for CLI tools.

## Security Rules

These are enforced by `verify:prod` and are critical:

- **Never** put `SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_ID_PEPPER`, or `GEMINI_API_KEY` in `src/` or any `VITE_`-prefixed variable
- **Never** store plain national IDs — only hashes (`nationalIdHash`) and last-4 digits
- **Never** expose answer keys (`isCorrect`, `correctAnswer`, `rubrics`, `explanation`, `sampleAnswer`) in student-facing API responses — `examSecurity.js` `stripTeacherOnlyFields` strips them
- Student exam access goes through HMAC-signed session tokens (`studentSession.js`), not Supabase client auth
- Exports (CSV/XLSX) carry **masked** national IDs; CSV cells are quote-escaped and formula-injection-guarded (`src/pages/teacher/exam-results/student-rows.ts`)

## API Route Pattern

1. Write the handler in the matching `api/routes/*.js` file
2. Register it in the `routes` object in `api/index.js` (line ~25), e.g. `'teacher/my-route': handleTeacherMyRoute`
3. The route path maps to `/api/teacher/my-route`

Teacher routes use `requireTeacher()` for Supabase Auth verification. Student routes use JWT session tokens from `studentSession.js`.

## Testing

- **Unit**: Vitest, colocated under `src/test/` (jsdom, `globals: true`, setup `src/test/setup.ts`, config block in `vite.config.ts`). Run: `npm run test`
- **E2E**: Playwright, `tests/e2e/exam-flow.spec.ts`. Playwright config auto-starts `npm run dev`. Run: `npm run test:e2e`
- `tsconfig.json` excludes `tests/`, `playwright.config.ts`, and `src/test/` — `npm run typecheck` does NOT type-check tests

## UI Conventions

- All UI text is in **Persian/Farsi** — do not add English strings to components
- Layout is RTL (`dir="rtl"`); prefer logical utilities (`ms-*`/`me-*`/`ps-*`/`pe-*`)
- Tailwind v4 — uses `@tailwindcss/vite` plugin, not the PostCSS plugin. No `tailwind.config.js` needed.
- Icons from `lucide-react`, animations from `motion` (framer-motion successor)
- **There is no sidebar.** Navigation = sticky Topbar (`sticky top-0`, `h-14`, RTL `flex-row-reverse`) + hamburger menu panels + CommandPalette.

## Design System — Liquid Glass + The Mark

Reference spec: `docs/brand-the-mark.md`. Tokens defined in `src/index.css` `@theme`.

### Brand

- **The Mark (علامت)**: four answer bubbles, one gold-filled. Logo = product action. Use `<TheMark variant="row|grid|palette|core" />` from `src/components/TheMark.tsx`.
- **Never**: gold rings (gold is always filled), two golds in a row, rotation, mixed stroke widths, non-gold fill colors.

### Color tokens (use these, not raw hex)

- `--color-ink` #1a1a2e light / #f5f6fa dark — dark surfaces, hero
- `--color-gold` #f5b301 light / #f8c542 dark — answered state, active indicators only
- `--color-gold-ink` #765500 light / #f8c542 dark — gold AS CONTENT (icons/text); plain `--color-gold` fails contrast on cream
- `--color-accent` #343242 light / #dcd9e6 dark — primary actions (theme-split)
- `--color-focus-ring` ink light / gold dark — never hardcode focus outlines
- `--color-success/warning/danger` + `-soft`/`-solid` variants — status
- `--color-text-primary/secondary/tertiary` — text hierarchy (tertiary: ≥14px or non-text only, gate-enforced)

### Glass surfaces (CSS classes, not utilities)

Real class names in `src/index.css` — there is no `glass-1/2/3`:

- `.lens` — main panels (full material chain)
- `.pane` — floating panels/cards
- `.drop` — small drops/badges
- `.field` — inputs/selects
- `.glx-inset` — inset wells
- `.btn-glass` (+ `--primary/quiet/bare/gold/...` variants) — every button
- `.skeleton` — shimmer placeholder (CSS class, no Skeleton component)
- Backdrop-filter lives ONLY in `index.css` chains — inline `backdrop-filter` fails `check:glass`.

### Components

- Cards/modals/buttons/badges + primitives (`TextLink`, `IconButton`, `PillButton`, `Dropdown`, `Tabs`, `Toggle`, `Table`, `Modal`, `ConfirmDialog`, `EmptyState`, `EmptyStateArt`, `DifficultyBadge`, `StatusBadge`): `src/components/UIComponents.tsx` — extend, don't recreate. Raw `<button>`s are ratchet-gated (`check:library`).
- **Toasts**: `useToast()` hook → `showToast(msg, 'success'|'error'|'warning'|'info')` + render `{toastElement}`. Never use `alert()`.
- **Confirmations**: `<ConfirmDialog isOpen title message confirmText onConfirm onCancel />`. Never use `window.confirm()`.
- **Teacher data**: `useTeacher()` / `useTeacherCollections()` from `src/contexts/TeacherContext.tsx` — single fetch cache, don't call `authService.getCurrentTeacher()` directly in components.
- **Accessibility**: forms wire `aria-invalid` + `aria-describedby`; Tabs consumers pass `idPrefix` and render the matching `role="tabpanel"`; Toggle is named by its visible label; Modal locks body scroll. Gates: `check:a11y-buttons` + LibraryV2 tests.

### Layout

- Content padding: `p-4 lg:p-8`; topbar height `pt-14`
- Radius: `rounded-xl` (components), `rounded-2xl` (sections), `rounded-3xl` (modals/panels)
- Mobile-first required — test every component at 375px width before shipping

## Supabase Migrations

Located in `supabase/migrations/`. Schema draft in `supabase/schema-security-draft.sql`. Read `docs/supabase-hardening.md` and `docs/supabase-first-run.md` before working with the database.

## Docs

The `docs/` folder has detailed architecture docs. Most relevant for agents:

- `docs/backend-fixes-needed.md` — open backend work (bulk import, exam-code, scheduling, AI grading decision)
- `docs/security-architecture.md` — security model overview
- `docs/supabase-hardening.md` — RLS policies and database security
- `docs/local-api-testing.md` — how to test API locally
- `docs/brand-the-mark.md` — brand/design source of truth
