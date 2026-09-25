# Azmoonsaz frontend polish implementation plan

## Rules
- Never remove a working feature; relocate or refactor it.
- Every task must pass TypeScript and relevant tests before being checked.
- Preserve popup-origin and veil/halo animation behavior.
- Avoid unrelated formatting churn.
- Keep database migrations replay-safe.

## Phase 1 — correctness and trust (P0)

### Profile editor
- [x] Remove four-entry schedule truncation; every saved entry must remain visible/editable.
- [x] Add schedule-row deletion.
- [x] Add end time with start/end validation.
- [x] Add per-row school selector.
- [x] Add per-row class and subject fields.
- [x] Prevent avatar uploads from resetting unsaved profile changes.
- [x] Keep uploaded avatar in the local draft until a successful profile save.
- [x] Add typed save/upload status and accessible feedback.
- [x] Prevent duplicate/blank schools and use stable local keys.
- [x] Confirm Friday persists as day index 6.

### Import workflow
- [x] Inventory Students CSV/XLSX parsing and import behavior.
- [x] Extract one shared import workflow/component.
- [x] Make Dashboard import open the shared real workflow.
- [x] Remove fake progress, fake records, and misleading success copy.
- [x] Preserve trigger-origin opening/closing animation.
- [x] Add file validation, parse-error feedback, preview, and partial-import reporting.

### Data panels
- [x] Add loading/error/retry/empty states to Question Bank Health.
- [x] Correct dashboard hero active-exam count and wording.
- [x] Filter “upcoming exams” to active/scheduled future-relevant exams.
- [x] Remove misleading hover affordance from noninteractive stat cards or make them navigable.

## Phase 2 — routing and session integrity (P1)

### Authentication
- [x] Bootstrap teacher authentication from the existing Supabase session.
- [x] Subscribe to Supabase auth-state changes.
- [x] Add an auth initialization skeleton and prevent login-page flashing.
- [x] Verify logout clears session and UI state.

### URL routing
- [x] Add canonical routes for dashboard/profile/students/classes/settings/questions/exams.
- [x] Derive active hub tabs from URL rather than remount keys.
- [x] Preserve browser back/forward behavior.
- [x] Preserve current exam-result deep links.
- [x] Redirect legacy internal tab states safely.

## Phase 3 — accessibility foundation (P1)

- [x] Add global, high-contrast `:focus-visible` treatment.
- [x] Give every button an explicit `type` where relevant.
- [x] Associate labels and form controls with `id`/`htmlFor`.
- [x] Add accessible labels to icon-only buttons.
- [x] Add `aria-live`/alert semantics for errors, status, and successful saves.
- [x] Implement semantic tablists with arrow-key navigation.
- [x] Add dialog role, labelled title, focus trap, Escape handling, and focus restoration.
- [x] Make drag/drop upload surfaces keyboard-operable.
- [ ] Audit image alt text and decorative icon treatment.
- [x] Verify minimum 44px touch targets for primary mobile controls.

## Phase 4 — typography, copy, and visual system (P1/P2)

### Typography and copy
- [x] Replace functional 10px text with readable metadata tokens.
- [x] Raise default metadata/caption sizes for Persian.
- [x] Correct Persian wording and spelling (`برگزاری`, concise headings).
- [x] Reduce overly formal or verbose empty-state copy.
- [x] Self-host a subsetted Vazirmatn WOFF2 with `font-display: swap`.

### Color and glass
- [x] Move page/surface tokens from cool blue to neutral paper white.
- [x] Keep ink/gold as brand emphasis; reserve indigo for functional selection/links.
- [ ] Verify WCAG contrast over translucent surfaces.
- [x] Define explicit surface/float/modal glass elevation tiers in the original glass system.
- [x] Reduce regular-card shadow haze without duplicate utility declarations.
- [x] Complete dark-theme tokens for new components or explicitly disable unfinished dark mode.
- [ ] Normalize nested border-radius relationships.

### Dashboard/login polish
- [x] Replace hero `nth-child` selectors with named classes.
- [x] Ensure Mark upper-left and actions lower-left at all breakpoints.
- [ ] Validate dashboard at 320, 375, 768, 1024, and 1440px.
- [x] Add AVIF/WebP login art sources with JPEG fallback.
- [x] Remove continuous decorative motion where it does not communicate state.

## Phase 5 — maintainability and performance (P2)

- [ ] Split Dashboard import, hero, widgets, and activity panels into components.
- [ ] Split TeacherProfile schedule/schools/editor sections into components.
- [ ] Split oversized teacher/student pages incrementally without behavioral changes.
- [ ] Remove unsafe `any` usage and stale lint suppressions.
- [ ] Resolve React compiler warnings in touched files.
- [x] Establish one dedicated formatting baseline commit.
- [x] Add bundle chunking for large shared dependencies.
- [x] Add bundle-size budget and report.
- [x] Add tests for profile draft preservation, routes, schedule, tabs, and imports.
- [ ] Add accessibility tests for dialogs, tabs, forms, and keyboard flows.

## Phase 6 — release verification

- [x] TypeScript passes.
- [x] ESLint passes with no new warnings and reduced baseline warnings (20 warnings, down from 24; zero errors).
- [x] All unit tests pass (58/58 across 13 files).
- [x] Production build passes.
- [x] Prettier check passes after formatting-baseline task.
- [x] No TODO/fake production action remains in user-facing flows.
- [ ] Manual keyboard flow passes.
- [ ] Reduced-motion flow passes.
- [ ] Mobile and desktop visual regression review passes.
- [x] Recalculate frontend score and publish change manifest (`FRONTEND_CHANGE_MANIFEST_2026-09-24.md`, 90/100).
