# Azmoonsaz product-craft implementation plan

Created: 2026-09-24  
Status legend: `[ ]` planned, `[-]` in progress, `[x]` complete

## Definition of done

- Every shipped preference has a clear default, persists safely, is keyboard/screen-reader operable, and behaves correctly on first paint.
- No useful behavior is removed; existing popup-origin and veil/halo behavior remains intact.
- Each implementation unit is checked with TypeScript, focused tests, ESLint, formatting, and a production build.
- Final release requires manual review at 320, 375, 768, 1024, and 1440 px, keyboard-only review, reduced-motion review, and light/dark/system-theme review.

## 1. Theme and personalization — P0

- [x] Add a first-class `light | dark | system` theme model.
- [x] Apply the resolved theme before React starts to prevent a flash of the wrong theme.
- [x] React live to operating-system theme changes while `system` is selected.
- [x] Persist the local preference and use a safe fallback when storage is unavailable.
- [x] Add an accessible three-way appearance control to Settings.
- [x] Add complete semantic dark tokens for page, surface, glass, text, borders, status colors, shadows, and artwork.
- [x] Audit hardcoded white/black/gray utility colors and migrate visible surfaces to semantic tokens; enforce with `npm run check:theme`.
- [x] Set native control `color-scheme` from the resolved theme.
- [x] Add theme initialization, persistence, and system-change tests.
- [x] Evaluate optional Supabase preference synchronization: intentionally deferred in `PRODUCT_ENGINEERING_DECISIONS.md` because current preferences are device-specific and non-sensitive.

## 2. Unified interaction-state system — P0

- [x] Define consistent default, hover, pressed, selected, focused, disabled, loading, success, and error states in `INTERACTION_STATE_STANDARD.md` with a shared CSS baseline.
- [-] Standardize button hierarchy: semantic solid/soft foreground channels and shared state signals are complete; remaining one-off hierarchy migration remains.
- [x] Standardize fields, selects, checkboxes, switches, segmented controls, and validation semantics through shared components, semantic channels, and global focus/invalid/disabled behavior.
- [-] Normalize nested radii using parent radius minus inset spacing: token ladder and rule are documented; remaining one-off arbitrary radii require migration.
- [-] Standardize surface elevation and remove accidental glass-on-glass stacking: elevation rule is documented and shared primitives comply; page-level one-off review remains.
- [x] Ensure every icon-only action has an accessible Persian name and tooltip where meaning is not obvious; enforce automatically with `npm run check:a11y-buttons`.
- [x] Review RTL directional icons, spacing, keyboard direction, mixed-direction islands, and trigger animation origins in `RTL_ACCESSIBILITY_AUDIT.md`.

## 3. Loading, empty, error, success, and offline states — P0

- [x] Inventory every asynchronous screen and mutation in `PRODUCT_ENGINEERING_DECISIONS.md`, including the required state policy for new work.
- [x] Replace abrupt content jumps with layout-matched skeletons; remaining spinners are confined to compact button/progress feedback where geometry does not change.
- [x] Give every shared table/dashboard empty state a useful explanation and direct recovery or creation action.
- [x] Give operation errors retry/recovery actions where actionable and preserve editor input on failure.
- [x] Make success feedback specific about the entity and change performed.
- [x] Add app-level offline/reconnected status without blocking local work.
- [x] Expose queued/offline exam-answer count, synchronization status, retry path, and submit-time protection clearly in Secure Exam Portal.
- [x] Remove simulated autosave language where no real persistence occurs; autosave wording is limited to the real student answer persistence/queue contract and persisted exam behavior setting.
- [x] Add regression coverage for loading/import transitions, error boundaries and retry, empty-state recovery, connectivity changes, and offline answer queues.

## 4. Data safety and editing confidence — P0

- [x] Inventory all editors and forms for draft-loss paths in `DATA_SAFETY_AUDIT.md`.
- [x] Add unsaved-change protection to editor actions, outer-shell navigation, browser close, and destructive replacement paths through the shared application navigation guard.
- [x] Restrict autosave to the real student answer persistence/offline-queue contract; teacher editors retain explicit save/publish actions and dirty-state protection.
- [x] Show shared `saving`, `saved`, `failed`, and Persian last-saved states without distracting animation across primary profile, question, and student editors.
- [x] Add safe optimistic updates with rollback for reversible mutations; class deletion now removes immediately and restores with explicit feedback on server failure.
- [x] Add user-invoked undo for suitable destructive actions, optimistic rollback on failure, and confirmation for irreversible deletions; class deletion now has a five-second undo window.
- [x] Preserve form drafts through avatar/file uploads, guarded tab/navigation changes, retries, validation failures, and transient save errors across primary teacher editors.

## 5. Persian localization quality — P1

- [x] Centralize Persian numeral conversion and remove one-off implementations.
- [x] Standardize Jalali dates, relative dates, times, Persian digits, and deterministic Tehran timezone behavior.
- [x] Verify Persian punctuation, half-spaces, pluralization, character variants, and concise terminology; decisions and normalized source findings are recorded in `PERSIAN_COPY_AUDIT.md`.
- [x] Define reusable LTR islands for codes, email, URLs, IDs, and numeric input.
- [x] Normalize Arabic/Persian character and digit variants for search in Questions and Students.
- [x] Add tests for date, number, normalized search text, and mixed numeral formatting.

## 6. Remembered workspace preferences — P1

- [x] Persist safe table filters, sort order, page size, and last useful view for Questions and Students.
- [x] Add comfortable/compact density for data-heavy teacher screens.
- [x] Remember non-sensitive display preferences per browser with validated storage, malformed-data fallback, and cross-tab updates.
- [x] Add clear per-list and global “reset preferences” behavior.
- [x] Ensure URL-backed Questions and Students filter/sort/page-size state remains shareable and takes precedence over remembered browser defaults.

## 7. Productivity features — P1

- [x] Add a global accessible search/command palette for live exams, students, classes, destinations, and common actions.
- [x] Add discoverable keyboard shortcuts for frequent teacher operations: Ctrl/Cmd+K opens search and G-sequences navigate to dashboard, exams, new exam, students, and classes.
- [x] Add shortcut help and avoid collisions with browser/screen-reader commands: navigation sequences are disabled inside editors, expire quickly, use no browser modifiers, and are documented in the palette.
- [x] Improve large-list search, filtering, Persian-aware sorting, persisted page size, pagination, and no-result recovery on key teacher lists.
- [x] Add recent destinations/actions only when based on real activity; the command palette promotes the four most recently used destinations.

## 8. Onboarding and contextual guidance — P1

- [x] Design a resumable first-run checklist: school and subject progress reflects actual form state, drafts persist safely, and are cleared only after successful completion.
- [x] Add concise, technically honest contextual help near complex exam, security, and import settings.
- [x] Add a downloadable UTF-8 CSV import template and concise required/optional field guidance without cluttering the default interface.
- [x] Avoid repeated coach marks by allowing import guidance dismissal and remembering it in validated browser preferences.
- [x] Make advanced settings progressive rather than permanently dense; exam behavior and security controls now use a keyboard-accessible native disclosure.

## 9. Notifications and user control — P1

- [x] Define in-app notification categories and persisted read/unread behavior.
- [x] Add browser-persisted notification preferences with meaningful defaults.
- [x] Separate urgent active-exam events from informational student/submission updates.
- [x] Ensure toasts are deduplicated, support recovery actions, use safe-area-aware mobile placement, and do not hide critical desktop controls.
- [x] Respect reduced motion and screen-reader announcement priorities: nonessential motion is suppressed globally; errors/warnings announce assertively while success/info uses polite atomic status.

## 10. Responsive and touch craft — P0

- [-] Review every primary flow at 320, 375, 768, 1024, and 1440 px: shared-state gallery inspected at 375 and 1440 in Chromium; production flows and remaining breakpoints are pending.
- [x] Use safe-area-aware mobile bottom sheets for shared modal actions while retaining trigger-origin desktop dialogs.
- [x] Maintain at least 44×44 px targets for interactive controls on coarse-pointer devices without inflating desktop density.
- [x] Harden safe areas, dynamic viewport/virtual-keyboard sizing, fixed command placement, overflow, and long Persian-string wrapping.
- [x] Make tables usable on narrow screens through mobile cards where supplied and keyboard-focusable, labeled horizontal scrolling otherwise.
- [ ] Test landscape and zoomed text where exam-taking safety depends on layout.

## 11. Accessibility and motion — P0

- [-] Complete keyboard traversal and focus-return review: shared modals now trap focus, close with Escape, and restore triggers with regression coverage; custom legacy drawers and route focus remain.
- [x] Add RTL-aware arrow-key behavior for all semantic tablists, segmented controls, and shared preference radios, including Home and End where applicable.
- [-] Verify labels, descriptions, live regions, errors, and heading structure: shared primitives, icon buttons, timer, save/error feedback, and primary editors are covered; final screen-reader/page-outline traversal remains.
- [-] Verify WCAG AA contrast in light and dark themes, including translucent surfaces: shared primitives were visually inspected and the dark inset-control defect fixed; complete measured page audit remains.
- [x] Add an in-app motion preference (`system | reduced | full`) without overriding OS safety defaults.
- [x] Ensure reduced motion removes nonessential transitions, smooth scrolling, shimmer, and sheen while preserving state comprehension.
- [-] Add 200% zoom resilience and forced-colors/high-contrast CSS fallbacks for boundaries, focus, overlays, and landscape dialogs; manual browser verification remains.

## 12. Performance and perceived performance — P1

- [x] Keep the existing bundle budget and add per-chunk regression visibility with size and budget utilization in CI output.
- [x] Preload only genuinely likely next routes after explicit hover/focus intent in the command palette; startup remains free of speculative route loading.
- [x] Prevent primary-route and data-list layout shifts with stable shell dimensions, route skeletons, list skeletons, and explicit image loading/decoding policy.
- [x] Audit image decode/loading priority and dark/light artwork variants in `IMAGE_LOADING_AUDIT.md`; shell imagery is eager and content imagery lazy/async-decoded.
- [x] Virtualize only proven large-list bottlenecks; profiling threshold and accessibility rationale are documented, with no current bottleneck justifying virtualization.
- [-] Profile high-frequency exam flows and remove unnecessary rerenders: the one-second full `ExamPortal` rerender is isolated to a timer leaf and documented; representative low-end-device traces remain a release gate.

## 13. Maintainability needed for consistent polish — P1

- [-] Split oversized pages by responsibility: Dashboard data loading now lives in `useDashboardData`, Profile delegates student/class domains, and the student countdown is isolated; Exam Preview and remaining portal answer renderers still need safe domain extraction.
- [-] Consolidate duplicated formatting, state, modal, and feedback patterns: appearance/motion selectors now share one typed accessible primitive; broader page migration remains.
- [-] Remove unsafe `any`, stale suppressions, and remaining React compiler warnings: generic Table no longer uses `any` and compiler/lint baseline is zero; heterogeneous polymorphic answer values remain intentionally documented.
- [x] Document tokens and component usage with compact examples (`DESIGN_SYSTEM.md`) and enforce neutral-token usage automatically.
- [-] Add automated accessibility smoke coverage for announcement priority, keyboard-reachable overflow tables, and empty-state recovery; screenshot regression baselines remain.

## 14. Final product-quality verification — release gate

- [x] TypeScript passes.
- [x] Unit/integration tests pass (75/75 across 21 files).
- [x] ESLint has zero errors and zero warnings.
- [x] Prettier and `git diff --check` pass.
- [x] Production build and bundle budget pass.
- [-] Light, dark, and system theme logic passes automated first-paint and live-change checks; final visual browser matrix remains.
- [-] Keyboard semantics, reduced-motion behavior, connectivity, and offline answer queues pass automated coverage; complete keyboard-only and real-network traversal remains.
- [ ] Target viewport and browser matrix passes.
- [ ] Publish final change manifest, known limitations, and recalculated visual/product score.
