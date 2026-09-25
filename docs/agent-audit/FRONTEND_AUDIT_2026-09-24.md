# Azmoonsaz frontend audit

**Revision:** `7a15420`  
**Audit date:** 2026-09-24  
**Scope:** all frontend source under `src/` (21,947 TS/TSX/CSS lines), public frontend assets, build output, routing/state architecture, and frontend-facing profile API behavior.

## Executive score

### Current frontend score: **72 / 100**

| Category | Weight | Score | Weighted |
|---|---:|---:|---:|
| Visual design and brand consistency | 20 | 7.3/10 | 14.6 |
| UX, information architecture, content | 20 | 7.7/10 | 15.4 |
| Responsive behavior | 15 | 7.2/10 | 10.8 |
| Accessibility | 15 | 4.8/10 | 7.2 |
| Frontend correctness and state integrity | 15 | 6.8/10 | 10.2 |
| Performance and delivery | 10 | 7.5/10 | 7.5 |
| Maintainability and consistency | 5 | 6.0/10 | 3.0 |
| Automated quality baseline | 5 | 6.6/10 | 3.3 |
| **Total** | **100** |  | **72.0** |

This is a meaningful improvement over the original information architecture. It is not yet “fully polished” because profile scheduling has user-facing state defects, the dashboard import is still a simulation, typography remains too small throughout the product, accessibility is incomplete, and the app shell/routing is still state-driven rather than robustly URL-driven.

## Automated baseline

- TypeScript: pass
- Production build: pass
- Vitest: 40/40 pass
- ESLint: 0 errors, 25 warnings
- Prettier check: fails on 13 files
- Main entry chunk: 706.15 kB / 199.06 kB gzip
- Frontend source: 21,947 lines
- Buttons: 208; 110 lack explicit `type`
- Form controls: 99; only 13 `aria-label`/`aria-labelledby` occurrences across TSX
- `focus-visible` occurrences: 1
- `text-micro` or explicit tiny-text usages: 472
- Hardcoded color occurrences in TSX/CSS: 128

## What is now good

1. Teacher Profile and Settings hubs significantly improve top-level information architecture.
2. Students/classes and question-bank settings remain available rather than being deleted.
3. The topbar profile click-through defect is fixed.
4. Profile save no longer clones/spreads `IncomingMessage`.
5. Bio and Friday support are now present.
6. The login art is relevant, visually coherent, and already only 80 kB.
7. Dashboard grouping is clearer, and the existing import popup animation was preserved.
8. The existing glass implementation remains centralized rather than being accidentally overridden.
9. Reduced-motion handling exists globally.
10. The code builds and all existing tests pass.

# Findings by priority

## P0 / release blockers

### 1. Dashboard Excel/CSV import is presented as functional but is still simulated

`Dashboard.tsx` explicitly contains `TODO: Implement real Excel parsing`, waits through fake progress states, reports three fake students, and then shows “ورود اکسل هنوز پیاده‌سازی نشده است.” This is a trust problem because the UI looks production-ready while the primary action cannot complete.

**Required:** either connect the dashboard action to the real Students import workflow or label it clearly as unavailable and disable confirmation. Do not maintain two import implementations.

### 2. Profile schedule only renders the first four entries

`TeacherProfile.tsx` uses `schedule.slice(0, 4)`. A fifth added entry immediately disappears from editing. Existing teachers with more than four entries cannot view/edit the rest, although hidden entries are still submitted.

**Required:** render every entry, optionally grouped by day; use scrolling/collapsible days instead of truncating state.

### 3. Avatar upload can overwrite unsaved profile edits

Uploading calls `updateTeacher({ avatarUrl })`. This creates a new teacher object. The render-time teacher synchronization then resets name, subject, bio, schools, and schedule from context. Unsaved edits can disappear.

**Required:** keep `avatarUrl` in the local profile draft, upload to storage, and update context only as part of a successful full save—or merge without triggering draft reinitialization. Track source revision, not object identity.

## P1 / high priority

### 4. Weekly schedule editor is incomplete

- No delete-row action.
- No end time despite backend support.
- `school` is not editable per row.
- The “کلاس / مدرسه” field updates only `className`, not school.
- Per-row subject is not editable.
- Seven day labels use 10px text and two-character abbreviations without accessible full names.
- School deletion does not explain what happens to associated schedule rows.

**Required:** day, start/end time, school select, class, subject, and delete action for every row; group by day and validate time ranges.

### 5. “Deep links” are not actual URL deep links

Keys correctly remount the hubs, but `currentTab` is local React state and top-level navigation resets the URL to `/`. Refreshing a profile/questions location does not restore that section. Browser back/forward is mostly meaningful only for exam results.

**Required:** use URL routes such as `/teacher/profile/students`, `/teacher/settings/questions`, and derive active tabs from the URL.

### 6. Authentication/session restoration appears incomplete

`isTeacherLoggedIn` initializes to `false`; current-user loading runs only after a successful login action. A valid Supabase session may still see the login page after refresh.

**Required:** initialize auth state from `supabase.auth.getSession()` and subscribe to auth-state changes; show an auth bootstrap skeleton rather than flashing login.

### 7. Accessibility foundation is insufficient

- 110/208 buttons omit explicit `type`; buttons inside future forms can accidentally submit.
- Almost no consistent `focus-visible` treatment.
- Login labels are visually present but not associated with inputs using `htmlFor`/`id`.
- Password visibility buttons have no accessible label.
- Status/error/success messages are not `aria-live`.
- Segmented controls are visually tabs but have no `tablist`, `tab`, `aria-selected`, or keyboard-arrow behavior.
- Dashboard modal lacks robust `role="dialog"`, `aria-modal`, labelled title, focus trap, and verified focus restoration.
- Several drag/drop surfaces are not keyboard-operable.

**Required:** complete an accessibility pass targeting WCAG 2.2 AA.

### 8. Typography is still too small for Persian UI

`text-micro` is 10px and appears hundreds of times. Caption is 12px. Important metadata, actions, warnings, schedule days, and navigation support text are frequently 10px.

**Required:** raise micro to 11.5–12px and caption to 13px, then selectively reduce density. Do not globally scale without checking crowded tables; introduce `text-meta` and `text-overline` roles.

### 9. The interface remains bluer than the requested direction

The page tokens are `#f0f6fd`, secondary surface is `#eef5fc`, inset glass is blue-tinted, and primary accent remains indigo. Custom profile styles are neutral, but the global stage is still visibly cool blue.

**Required:** move page/surface tokens toward neutral paper white (for example `#f7f7f4` / `#f1f1ed`), reserve indigo for links/selection, and use ink/gold as brand emphasis.

## P2 / medium priority

### 10. Glass elevation is still excessively global

Regular `.glx` cards use a 70px shadow at alpha 0.42. Nested glass cards multiply haze and can reduce perceived sharpness.

**Required:** define explicit elevations (`glx-surface`, `glx-float`, `glx-modal`) using the same centralized recipe. Regular content needs a much lighter shadow; only overlays should use strong elevation.

### 11. Dashboard wording and data semantics need correction

- Hero says total exams are “جاری فعال”; it should use `activeExams`.
- “آزمون‌های زمان‌بندی‌شده مابعد و پیش‌رو” is verbose/unnatural.
- Upcoming panel maps all exams rather than a filtered future/active subset.
- Statistic cards are `hoverable` but not interactive, implying clickability.
- “برگذاری” should be “برگزاری”.

### 12. Dashboard CSS is structurally brittle

Hero positioning relies on selectors such as `> div:nth-child(3) > div:last-child`. Minor JSX changes can silently break layout. The `contents` wrapper is also a layout workaround rather than a clear component structure.

**Required:** use named classes/components for hero copy, mark, actions, widget grid, and operational panels.

### 13. Loading/error/empty states are inconsistent

`QuestionBankHealth` silently converts fetch errors into an empty array, which then displays a “not enough questions” warning. Users cannot distinguish loading, an empty bank, and network failure.

**Required:** explicit loading, error with retry, and empty states across all data panels.

### 14. Profile save feedback is not robust

A single untyped message string handles uploading, upload failure, save failure, and success. It is small, not announced, and error detail is discarded.

**Required:** typed status (`idle/loading/success/error`), inline alert semantics, toast, and actionable backend messages.

### 15. Profile school management needs identity-safe keys and validation

Schools use array index keys, allow duplicates client-side, and do not trim/validate until addition. The API replaces all schools/schedule rows, changing IDs every save.

**Required:** stable local IDs, duplicate prevention, primary-school control, and non-destructive backend upserts.

### 16. Theme coverage is incomplete

Dark-theme tokens exist, but newly added profile/login CSS hardcodes white backgrounds and dark ink values. The result will be inconsistent if dark mode is activated.

**Required:** either complete dark-mode component tokens or remove/disable an unfinished theme path.

### 17. External font delivery is fragile

CSS imports Vazirmatn from Google. This adds a render dependency and may be unavailable or slow for the target audience.

**Required:** self-host a subsetted WOFF2 (Persian + Latin ranges), preload the primary weight, and use `font-display: swap`.

### 18. Motion is overused in status content

Pulse/bounce/spin appears 40 times. Active exam text pulses continuously and the upload icon bounces, which adds visual noise.

**Required:** reserve continuous motion for true live state, stop after a short duration, and retain reduced-motion handling.

### 19. Source architecture is too monolithic

Nine frontend files exceed 700 lines; several exceed 1,700–2,200 lines. This makes regression-safe UI work difficult.

**Required:** extract drawers, dialogs, forms, tables, and mobile cards into feature components/hooks. Dashboard import should be a shared feature component.

### 20. Formatting baseline is not clean

Prettier fails on 13 files, including most touched frontend files. This increases review noise and permits inconsistent JSX/CSS formatting.

**Required:** make one dedicated formatting commit, then enforce format check in CI.

## Image optimization

Current login image:

- JPEG: 1280×853, **80,298 bytes**
- WebP quality 82: **~62 kB**
- WebP quality 75: **~45 kB**
- AVIF quality 55: **~41 kB**

The existing JPEG is already small. The best practical optimization is a `<picture>` element or CSS `image-set()` with AVIF/WebP plus JPEG fallback. Expected transfer saving is only 18–39 kB, so image optimization is not a major performance bottleneck. Do not recompress the 1.4 MB dark PNG unless it is actually used; if used, export it as WebP/AVIF and remove the original.

## Recommended polish roadmap

### Phase 1 — correctness and trust
1. Replace fake dashboard import with the shared real import workflow.
2. Fix schedule truncation, row editing/deletion, and avatar draft reset.
3. Restore Supabase session on reload.
4. Add URL-driven routes for hubs.
5. Add loading/error states.

### Phase 2 — accessibility and typography
1. Associate every label/control and label icon buttons.
2. Add semantic tabs and dialogs with focus management.
3. Add global `focus-visible` styling.
4. Increase Persian metadata sizes.
5. Verify contrast against glass surfaces.

### Phase 3 — visual polish
1. Neutralize global page/surface blues.
2. Introduce explicit glass elevation tiers.
3. Replace brittle nth-child CSS with named component classes.
4. Tighten Persian copy.
5. Reduce continuous animation.

### Phase 4 — maintainability/performance
1. Split monolithic feature pages.
2. Share import/profile/schedule components.
3. Self-host/subset the font.
4. Add route-level and component-level tests.
5. Establish Prettier/CI baseline and bundle budgets.

## Projected score

- After P0/P1 corrections: **84–87/100**
- After full accessibility, typography, neutral palette, and component refactor: **91–94/100**
- A credible 95+ requires visual regression tests, browser/device QA, complete keyboard/screen-reader verification, real-user testing, and performance budgets—not only code cleanup.
