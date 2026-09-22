# UI Audit & Theme Refactor Plan

## 1. Audit Summary — Critical Issues

### 1.1 Hardcoded Tailwind Colors — 347 USAGES ACROSS CODEBASE (MOST CRITICAL)

Pages and components use literal Tailwind color classes (`indigo-600`, `slate-300`, `rose-50`, `emerald-600`, `amber-150`, `teal-900`, `purple-500`, `blue-700`, `orange-600`, etc.) instead of CSS variables. This breaks theme switching, design unity, and makes maintenance impossible.

**347 hardcoded color class usages found.** These are spread across 14 pages + 4 components + 2 student portals.

**Key offenders per file:**
- `src/pages/teacher/Dashboard.tsx`: `text-indigo-600/700/900`, `text-emerald-600`, `bg-indigo-50`, `border-indigo-200`, `bg-orange-500/10`, `text-orange-600/800`, `bg-rose-500`, `border-rose-150/200/300/350`, `text-slate-805`, `text-slate-655`, `shadow-indigo-100`
- `src/pages/teacher/Exams.tsx`: `text-indigo-600`, `bg-indigo-105`, `border-indigo-150`, `bg-orange-500/10`, `text-orange-600`, `from-indigo-500 to-blue-500`, `from-emerald-500 to-teal-500`, `from-orange-500`
- `src/pages/teacher/ExamResults.tsx`: `text-indigo-600/755/800`, `bg-rose-50/500`, `text-rose-900`, `text-emerald-600/500`, `bg-emerald-600/10`, `shadow-emerald-600/10`, `text-slate-300/350/405/550/705/750/755/850/900`, `border-slate-50/100/205`, `text-amber-655/805`, `bg-amber-150`, `border-amber-150/250`, `text-indigo-600/755/805/900/950`, `bg-indigo-400/700`, `border-indigo-300/600/700/150/200`, `divide-slate-100/205`, `text-slate-300/350`
- `src/pages/teacher/ExamPreview.tsx`: 42 distinct hardcoded color classes including `text-teal-600/900/950`, `bg-teal-50/600`, `border-teal-100/150/500`, `text-indigo-400/950`, `text-rose-950`, `border-rose-150/200/300/350/500`, `text-slate-300/705/755`, `border-amber-150/250`, `text-amber-150/655/805`, `bg-gradient-to-br from-indigo-50 to-slate-50`, `border-indigo-150/200`, `bg-indigo-300/400/650`, `text-indigo-650/750`, `border-indigo-650`, `bg-rose-500/650`, `text-rose-650/950`
- `src/pages/teacher/Students.tsx`: `bg-rose-50/500`, `text-indigo-600`, `bg-white`, `divide-slate-100`, `text-slate-655`
- `src/pages/teacher/Questions.tsx`: `bg-purple-50/500/505`, `text-purple-700`, `border-purple-100/500`, `text-indigo-400`, `bg-teal-50/600`, `text-teal-700/900`, `border-teal-100/150`, `text-rose-950`, `bg-rose-100/50`, `border-rose-150/200`, `text-slate-300`, `bg-slate-50`
- `src/pages/teacher/ExamSettings.tsx`: `text-indigo-600/100/150/400/650/700/750/805/900/950`, `bg-indigo-300/400`, `bg-rose-350/500/650/950`, `border-rose-300/350/500`, `text-rose-955`, `text-amber-805`, `text-slate-400/450/705/850`, `border-slate-205/300/400`, `bg-blue-50/700`, `border-blue-200`, `text-blue-700`, `bg-orange-500/600`, `text-orange-600/800`, `border-orange-200/500`
- `src/pages/student/ExamPortal.tsx`: `bg-white`, `bg-white/3/4/6`, `text-slate-205/210/300/350/400/405/550/655/750/755/850`, `border-slate-205/250/300/350/400/405`, `bg-rose-50/150/200/220/300`, `border-rose-150/200/220/300`, `text-indigo-550/600/800/805/850/900`, `bg-indigo-105/400`, `border-indigo-150/300/400/600/700`, `text-emerald-500/600`, `bg-amber-100/150/200/300`, `border-amber-150/300`, `bg-teal-50`, `border-teal-100`, `bg-purple-50/505`, `border-purple-100/500`, `text-purple-700`, `border-red-150/200`, `bg-red-50`, `text-red-600`, `bg-blue-50`, `border-blue-200`, `text-blue-700`
- `src/pages/student/SecureExamPortal.tsx`: `bg-amber-200/300`, `bg-indigo-300`, `bg-rose-50`, `border-rose-200`, `text-emerald-500`, `text-indigo-600`, `bg-indigo-400`, `text-slate-800/900`, `border-indigo-300/600`, `bg-blue-50`, `border-blue-200`, `text-blue-700`
- `src/pages/teacher/Login.tsx`: `shadow-indigo-100/200` (non-standard shadow syntax), `shadow-indigo-200` implied
- `src/pages/teacher/Onboarding.tsx`: `bg-gradient-to-br from-indigo-50 via-white to-violet-50`, `text-slace-900`, `bg-indigo-100`, `text-indigo-600`, `shadow-indigo-100/200`, `text-red-600`, `bg-red-50`, `border-red-100`
- `src/pages/teacher/ResetPassword.tsx`: `bg-gradient-to-br from-indigo-50 via-white to-violet-50`, `bg-indigo-100/300`, `text-indigo-600`, `bg-amber-100/200/300`
- `src/components/UIComponents.tsx`: `placeholder-slate-400`, `border-rose-350/500`, `text-indigo-600`, `shadow-indigo-100/200`, `divide-slate-200`, `border-slate-50/100`, `bg-blue-50`, `bg-rose-50`, `border-rose-200`, `ring-rose-500`, `bg-white/20`, `bg-[var(--color-paper-warm)]/95`
- `src/components/ErrorBoundary.tsx`: `bg-blue-600`, `hover:bg-blue-700`, `border-red-200`, `bg-white`
- `src/components/Skeleton.tsx`: `bg-white/3/4/6`
- `src/components/QuestionRenderer.tsx`: `bg-rose-100/50`, `border-rose-150/200`, `text-indigo-400/950`, `text-rose-950`, `bg-teal-50/600`, `border-teal-150/500`, `text-teal-900`, `border-amber-150`, `bg-white`

### 1.2 Non-Existent Tailwind Classes (Silent Failures)

Several classes reference Tailwind shades that **don't exist** in the default palette or in the project's custom config:

- `rose-350` — **non-standard**, Tailwind rose goes `50, 100, 200, 300, 400, 500, 600, 700, 800, 900` (no 350)
  - `UIComponents.tsx:224,279,353` — `border-rose-350 focus:border-rose-500`
  - `ExamSettings.tsx:1018` — `border-rose-350`
  - `ExamSettings.tsx:1028` — `border-rose-300 focus:ring-rose-500`
  - `ExamResults.tsx:1010` — `border-amber-150/250` (also non-standard)
- `amber-150/250/350/650/805` — **non-standard** (Tailwind amber: 50,100,200,...,900)
  - `ExamResults.tsx:975` — `text-amber-655`
  - `ExamResults.tsx:1678` — `text-amber-805`
  - `ExamResults.tsx:1618` — `border-indigo-150/80`
  - `ExamPreview.tsx:756` — `border-amber-250`
- `indigo-105/150/300/350/400/550/650/700/750/755/805/850/900/950` — many non-standard
- `slate-50/100/150/205/210/250/300/350/400/405/450/500/550/600/655/700/705/755/800/850/900` — extensive non-standard shades
- `teal-100/150/300/500/900/950` — `teal-150` and `teal-950` don't exist
- `purple-505` — doesn't exist
- `orange-100` — doesn't exist (orange starts at 50)
- `bg-white/4/60` — `bg-white/4/60` in ExamPortal.tsx:1649 is a malformed class (double opacity)
- `border-[var(--color-success)]/10/60` — malformed opacity syntax in ExamResults.tsx:1435, ExamPreview.tsx:756

### 1.3 Radius Inconsistency — 695 `rounded-*` usages

CSS defines 7 radius tokens (`--radius-sm: 8px` through `--radius-3xl: 32px`) but 695 element occurrences use raw Tailwind `rounded-*` classes. No file uses the CSS tokens consistently.

**Apple signature radius should be `--radius-lg: 16px` (standard) or `--radius-xl: 20px`.** Currently components use:
- `rounded-xl` (80%) — should be `lg` (16px)
- `rounded-2xl` — should be `xl` (20px) for cards, `3xl` (32px) for modals
- `rounded-3xl` — should be `3xl` (32px) for modals/hero
- `rounded-lg` — should be `md` (12px) for small elements
- `rounded-full` — fine for avatars/bubbles

### 1.4 Glass Layer Inconsistency

CSS defines 4 layers (`.glx`, `.glx-strong`, `.glx-dark`, `.glx-inset`) + legacy aliases (`.glass-1`, `.glass-2`, `.glass-3`). **Both old and new naming systems are used simultaneously:**

- `Dashboard.tsx`, `Classes.tsx`, `Exams.tsx`, `Students.tsx` → use `glass-1` (legacy alias)
- `Sidebar.tsx` → uses `glx-dark` (desktop) but `glx-strong` (mobile) — **inconsistent**
- `UIComponents.tsx` → uses `glx-strong` (Modal), `glx` (Card, Select, Dropdown), `glass-1` (legacy)
- `ExamResults.tsx` → uses `glx`, `glx-inset`, `glx-strong` mixed with `glass-1`
- `ExamPreview.tsx` → uses `glx`, `glx-inset`, `glx-strong` mixed with `glass-1`
- `Login.tsx` → `glx`, `glx-dark`, `glx-inset` (no legacy, but inconsistent with rest)
- `Onboarding.tsx` → `glx-strong`, `glx-inset` only (but uses `bg-gradient-to-br` for bg!)

**`bg-white/3`, `bg-white/4`, `bg-white/6` hardcoded** (113+1 in ExamPortal, 74 white-opacity usages app-wide) — should use `--color-glass-light-fill` or `--color-glass-ink-fill`.

### 1.5 Color-mix() Browser Compatibility

`index.css` uses `color-mix(in srgb, ...)` in:
- `.glx` — box-shadow inset colors (4 lines)
- `.glx-strong` — background + 3 inset box-shadow lines
- `.glx-inset` — background + 2 inset box-shadow lines
- `body` — background-image radial gradients (2 lines)
- `::selection` — background (1 line)
- `::-webkit-scrollbar-thumb` — background (2 lines)

`color-mix()` is **not supported in Firefox** (~20% market share) or Safari < 16.5. For Firefox users, the glass effects silently degrade to no box-shadow insets and no scrollbars.

### 1.6 Duplicated Helper Functions

Same functions copy-pasted across 7 files:

| Function | Files duplicating it |
|---|---|
| `toPersianDigits()` | Students (1x), ExamResults (wraps helper from persianHelpers), ExamPreview (1x), Questions (1x), ExamPortal (1x), ExamSettings (1x), QuestionRenderer (1x) |
| `getDifficultyLabel()` | Questions, ExamPreview, QuestionRenderer (3x) |
| `getDifficultyColor()` | Questions, ExamPreview, QuestionRenderer (3x) |
| `getTypeNameInPersian()` | Questions, ExamPreview, QuestionRenderer (3x, different variants each) |
| `getPersianDateStr()` (Gregorian→Jalali) | ExamPortal (inline, 50 lines) — ExamSettings.tsx has its own version |

Meanwhile `src/services/persianHelpers.ts` exists and re-exports from `src/utils/persian.ts` but **6 of 7 files don't use it** (except Dashboard and UIComponents which import `formatPersianNumber`).

### 1.7 Color Variable Name Mismatches

**`--color-surface-secondary`** referenced in `App.tsx:290` but **never declared** in `index.css`. This means the dark mode background layer renders as `transparent` instead of a dark surface.

**`--color-success-soft`** referenced in multiple files and declared in CSS — OK.
**`--color-warning-soft`** referenced and declared — OK.
**`--color-danger-soft`** referenced and declared — OK.
**`--color-accent-soft`** referenced and declared — OK.

But: `--color-glass-light-bottom` is declared but `--color-glass-ink-bottom` is declared and used only in `.glx-dark` — inconsistent naming.

### 1.8 Non-Standard CSS / Tailwind Hacks

- `bg-white/4/60` (ExamPortal.tsx:1649) — double opacity modifier, invalid, renders transparent
- `border-[var(--color-success)]/10/60` (ExamResults.tsx:1435, ExamPreview.tsx:756) — invalid Tailwind opacity on CSS variable
- `shadow-indigo-100` (Login.tsx:70, Onboarding.tsx:70) — non-standard shadow class syntax
- `shadow-emerald-600/10` (ExamResults.tsx:636, 1707) — non-standard
- `shadow-indigo-200` (Onboarding.tsx:143, ExamSettings.tsx:481) — non-standard

### 1.9 Custom Cursor Accessibility Risk

`CustomCursor.tsx:45` uses `mix-blend-difference` on a `fixed` div with `z-[9999]`. This:
1. Forces GPU composite layer for the entire page
2. Can cause invisible cursor on dark backgrounds (difference blend with black)
3. `max-md:hidden` — fine for mobile, but the 16px cursor is too small on desktop 4K
4. Uses `cursor-pointer` detection via `closest('.cursor-pointer')` — misses `[role="button"]` on some elements, misses keyboard focus

### 1.10 Custom Input IDs Use Date.now()

`UIComponents.tsx` Input (L222) and Select (L277) generate `input-${Date.now()}` / `select-${Date.now()}` for `id` attributes. React 18+ has `useId()` — this avoids collisions and is SSR-safe.

### 1.11 ExamTimer Stale Closure Bug (Confirmed)

`ExamPortal.tsx` timer logic at L909+ creates an interval with `warningMinutes` as the only dependency. If the exam duration changes or the component re-renders with a new `durationMinutes`, the interval callback captures the stale value. The `secondsLeft` is updated via `setSecondsLeft` but the initial value isn't recomputed.

### 1.12 Onboarding & ResetPassword: Entirely Different Visual Language

- `Onboarding.tsx:66`: `bg-gradient-to-br from-indigo-50 via-white to-violet-50` — entire page background is a Tailwind gradient, not the brand's sky-white `var(--color-paper-warm)`
- `ResetPassword.tsx:76/89/121/146`: Same gradient backgrounds on all views
- `Onboarding.tsx:70`: `shadow-indigo-100` — non-existent shadow class
- `Onboarding.tsx:73`: `text-slate-900` — hardcoded instead of `var(--color-text-primary)`

These pages visually scream "generic signup form" instead of fitting the app's premium glass aesthetic.

### 1.13 Students.tsx: 1705-line Monolith with Baked-in Wizards

The entire Students page (1705 lines) contains both the student management UI and a massive wizard-mode import tool. The "Add/Edit Student" flow uses an inline custom modal (not the shared `Modal` component). The import wizard is another custom modal. **Two duplicated modal patterns** where one shared `Modal` + `Drawer` would suffice.

### 1.14 Skeleton Hardcoded White Opacity

`Skeleton.tsx` uses `bg-white/3`, `bg-white/4`, `bg-white/6` hardcoded. `App.tsx:318-325` also hardcodes `bg-white/3 skeleton rounded-xl` / `rounded-3xl`. Should use `var(--color-glass-light-fill)`.

### 1.15 Error Boundary Uses Raw Tailwind Colors

`ErrorBoundary.tsx:37`: `bg-white rounded-xl shadow-lg border border-red-200` — completely unthemed. This is the error page users see when everything breaks — it should still feel like the app.

### 1.16 CustomCursor: mix-blend-difference Performance Impact

`CustomCursor.tsx:45`: `mix-blend-difference` forces a separate composite layer and can cause jank on scroll. Additionally, the cursor detects hoverable elements via DOM `closest()` on every `mousemove` event — unthrottled, this fires ~100+ times/sec.

### 1.17 Dashboard's CalendarIcon — Not a Bug, It's a Local Definition

Line 1063: Dashboard defines its own `function CalendarIcon(props)` — it's self-contained, not an import bug. But the function returns `undefined` instead of an SVG (it's a placeholder stub). **The icon renders nothing.**

### 1.18 Missing `useId()` Across Form Components

`UIComponents.tsx` Input/Select/Dropdown all generate IDs with `Date.now()`. Under React 18 concurrent rendering this can cause hydration mismatches.

### 1.19 Custom Scrollbar Only Defined for WebKit

`index.css` defines `::-webkit-scrollbar` but not the Firefox equivalent `scrollbar-width` / `scrollbar-color`. Firefox users get default ugly scrollbars.

### 1.20 No CSS Utility for Typography Scale

No semantic text style classes exist. Every element uses raw `text-xs`/`text-sm`/`text-[10px]`/`text-[9.5px]`/`text-[11px]` etc. — 6+ different sub-14px sizes with no hierarchy.

---

## 2. Transformation Plan

### Phase 1: Create the Theme Library — `src/theme/`

**New files:**
1. `src/theme/tokens.ts` — TypeScript constants mirroring CSS variables (hex/rgba values)
2. `src/theme/glass.ts` — Glass layer system as TS objects with computed rgba values (replaces color-mix)
3. `src/theme/colors.ts` — Semantic color mapping (status → CSS var)
4. `src/theme/index.ts` — Re-exports + `cx()` helper + `ThemeRadius` type
5. `src/theme/typography.ts` — Typography scale tokens

### Phase 2: Rewrite Core CSS — `src/index.css`

- Replace `color-mix()` with pre-computed `rgba()` values
- Add `scrollbar-color` / `scrollbar-width` for Firefox
- Add `@utility` typography classes (text-display, text-heading-1, text-body, text-caption, text-micro)
- Add `--color-surface-secondary` token (was missing)
- Align ink color: `#1a1a2e` everywhere, update `docs/brand-the-mark.md`

### Phase 3: Refactor UIComponents.tsx (17 components)

- Replace all 347 hardcoded color classes with CSS variables
- Fix `Button.size` — remove broken `'glx'`, add `'lg'`
- Fix `Modal.maxWidth` — remove broken `'glx'`
- Add `glassLayer` prop to `Card`
- Add `width` prop to `Drawer`
- Replace `Date.now()` IDs with `useId()`
- Fix `border-rose-350` → `var(--color-danger-soft)`

### Phase 4: Refactor Shared Components

- `GlassSystem.tsx` — add touch support to GlassSheen
- `Skeleton.tsx` — use glass tokens
- `Sidebar.tsx` — use tokens, fix profile bg-white/4
- `Topbar.tsx` — use tokens
- `TheMark.tsx` — fix ink color fallback to `#1a1a2e`
- `ErrorBoundary.tsx` — theme the error page
- `CustomCursor.tsx` — add throttling, fix blend mode
- `QuestionRenderer.tsx` — use tokens

### Phase 5: Consolidate Helpers

- `src/services/persianHelpers.ts` — add `getDifficultyLabel`, `getDifficultyColor`, `getTypeNameInPersian`, `getPersianDateStr`
- Update all 7 files to import from single source

### Phase 6: Refactor Pages (largest visual impact)

**Teacher pages:** Dashboard → Classes → Students → Exams → ExamResults → ExamPreview → ExamSettings → NewExam → Questions → Settings → Login → Onboarding → ResetPassword

**Student portals:** ExamPortal → SecureExamPortal

For each page: replace all literal Tailwind colors with `var(--color-*)`, replace `rounded-*` with consistent `rounded-xl`/`rounded-2xl`/`rounded-3xl` per element type, use shared `Modal`/`Drawer`, replace `bg-gradient-to-br` with brand surface.

### Phase 7: Typography System

Replace all scattered `text-xs`/`text-sm`/`text-[10px]` with semantic classes:
- `text-display` / `text-heading-1` / `text-heading-2` / `text-heading-3`
- `text-body` / `text-label` / `text-caption` / `text-micro`

### Phase 8: Cleanup

- Delete `public/color-palette-test.html` + `public/lg-test.html` (if unused)
- Remove `glass-1/2/3` legacy aliases after all usages converted

---

## 3. Execution Order (Chunked)

### ✅ Phase 1 Complete (Sep 21, 2026)

**Files created:**
- `src/theme/tokens.ts` — colors (28 keys), radius (7 keys), spacing (13 keys) as `as const` objects with `ColorKey`/`RadiusKey`/`SpacingKey` types
- `src/theme/glass.ts` — `getGlassStyle(layer)` returning computed `CSSProperties` with pre-computed rgba values (replaces `color-mix()`), plus `glassVar` for CSS var references
- `src/theme/colors.ts` — `statusColors` map for 5 variants (success, warning, danger, info, accent), each with `{bg, text, border, ring}`, plus `statusColorVar()` helper
- `src/theme/typography.ts` — 8 semantic text styles (display, heading1-3, body, label, caption, micro)
- `src/theme/index.ts` — barrel re-export + `cssVar()` + `cx()` utility

**Verification:** `npx tsc --noEmit` passes with zero errors. Phase 1 introduced zero new type errors.

**Key decisions:**
- Colors stored as hex/rgba strings (not CSS var strings) so they work in both `style={{}}` and `className="bg-[...]"` contexts
- Glass layer functions return `CSSProperties` (not className strings) — the inline style approach you validated in the tuners
- `as const` on all token objects for full type safety
- `statusColorVar()` returns CSS var strings (`var(--color-success)`) for className usage

## 3. Execution Order (Chunked)

1. **Foundation**: `src/theme/` files + `src/index.css` rewrite (no logic changes)
2. **Components**: UIComponents → GlassSystem → Skeleton → Sidebar → Topbar → TheMark → ErrorBoundary → CustomCursor → QuestionRenderer
3. **Helpers**: `persianHelpers.ts` consolidation
4. **Teacher pages**: Dashboard → Classes → Students → Exams → Questions → ExamSettings → NewExam → Settings → ExamResults → ExamPreview → Login → Onboarding → ResetPassword
5. **Student portals**: ExamPortal → SecureExamPortal
6. **Typography**: CSS utilities + page-by-page replacement
7. **Cleanup**: delete test HTML, remove legacy aliases
8. **Verify**: `npm run typecheck && npm run lint && npm run build`
