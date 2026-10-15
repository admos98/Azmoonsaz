# FRONTEND — remaining tasks

> Written 2026-10-15. Supersedes `docs/agent-audit/PRODUCT_CRAFT_TASKS.md`,
> `FRONTEND_POLISH_TASKS.md`, `MANUAL_RELEASE_QA.md`, `RELEASE_MANIFEST_DRAFT.md`,
> `docs/FRONTEND-REFACTOR-PLAN.md`, `docs/ui-audit-plan.md`, `docs/task-list.md`.
>
> Every checkbox below was re-verified against the tree; stale ones were dropped.
> What looked open but is **already done** is listed at the bottom so nobody
> re-does it.

---

## 1. Release gates (blocking a "final" release)

- [ ] **Viewport + browser matrix.**
      `playwright.config.ts` runs a single `Desktop Chrome` project and there are
      no viewport tests. Add projects/specs for **320 / 375 / 768 / 1024 / 1440**
      plus a real second engine (Firefox or WebKit) — the app uses
      `backdrop-filter`, `color-mix()` and `@container`, all of which diverge.
      Landscape CSS already exists at `src/styles/pages.css:269`; verify rather
      than write.
- [ ] **Manual keyboard-only pass** on the primary flows: teacher login →
      create exam → publish; student login → PIN → answer → submit. Automated
      coverage passes (`AccessibilitySmoke.test.tsx`), but custom drawers and
      route focus were never hand-verified.
- [ ] **Manual reduced-motion pass.** `prefers-reduced-motion` is honoured in
      `buttons.css` + `typography.css` and `MotionContext.test.tsx` passes;
      the end-to-end feel still needs a human check.
- [ ] **Manual forced-colors / high-contrast pass.** Rules exist in
      `base.css:101`, `glass.css:265`, `pages.css:254` — confirm they actually
      hold in a forced-colors environment.
- [ ] **200% zoom + zoomed-text resilience**, especially where exam-taking
      safety depends on layout.
- [ ] **Final contrast audit over translucent surfaces.** `check-contrast.mjs`
      is in the gate and green; the *measured page* audit over real glass
      surfaces (not just token pairs) is still outstanding.
- [ ] **Publish the release manifest**: what shipped, known limitations, and a
      recalculated visual/product score. `RELEASE_MANIFEST_DRAFT.md` said
      "implementation-complete draft" and was never promoted.

## 2. Visual regression

- [ ] **No visual-regression tooling exists** — no `pixelmatch`/`odiff`, no
      snapshots, no CI image diff. A single broken glass rule or missing art
      asset ships silently today. Pick one (Playwright's built-in
      `toHaveScreenshot` is the cheapest, since Playwright is already wired) and
      baseline the six panels + the empty-state set, light and dark.

## 3. Structural (maintainability, no behaviour change)

- [ ] **`src/pages/teacher/Questions.tsx` — 1968 lines.** `src/features/question-bank/`
      already holds `types.ts`, `useQuestionDelete.ts`, `useQuestionFilters.ts`,
      `useQuestionForm.ts`; extract the remaining view sections the same way.
- [ ] **`src/pages/teacher/ExamPreview.tsx` — 1887 lines.** Only
      `src/features/exam-preview/usePreviewDrawerHandlers.ts` is extracted so far.
- [ ] **`src/pages/teacher/Students.tsx` — 1238 lines.**
- [ ] **`src/pages/teacher/TeacherProfile.tsx` — 690 lines** (one sub-component
      only, `ProfileHeader`). Split schedule / schools / editor sections.
- [ ] **`src/pages/teacher/Dashboard.tsx` — 627 lines.** No `dashboard/` subdir
      and no extracted widgets. The old note claiming a `useDashboardData` hook
      exists is wrong — that name appears only inside a comment at
      `src/contexts/TeacherContext.tsx:214`.
- [ ] **`src/pages/student/SecureExamPortal.tsx` — 892 lines** — the remaining
      answer-renderer extraction called out in the old plan.

## 4. Small / hygiene

- [ ] **3 `any` casts left** in `src/`: `ExamPreview.tsx:428`,
      `src/ui/Card.tsx:44`, plus one in a comment. The polymorphic answer-value
      one is intentionally documented; check the other two.
- [ ] **10 files carry `eslint-disable` comments.** Most are justified with a
      trailing reason; audit the un-reasoned ones.
- [ ] **Art Round-2 implementation niceties** (Round-2 artwork itself is
      **shipped** — 49 PNGs in `public/empty-art/`, all gate bands PASS):
      - M3 **sweep-underline** wayfinding component — never built; only the
        `skeleton-sweep` and `seal-draw` keyframes exist.
      - D.6 **isometric physics on controls** (M4) — no tilt/iso rules in
        `buttons.css`.
      - D.9 **`optical.css`** (M6) — file never created; the optical
        `translateY(-2%)` correction may still be inline.
      Each is polish, not correctness. Do them only if the surfaces feel flat.

---

## Already done — do NOT redo

Verified present on 2026-10-15:

| Former "open" item | Reality |
| --- | --- |
| Audit image alt text | All 7 empty `alt=""` are on decorative art (`AbsenceArt`, `Cut`, `EmptyStateArt`, `Seal`, `Login`) — correct |
| WCAG contrast gate | `tools/check-contrast.mjs` exists, wired into `check` **and** `gate` |
| Normalize nested border-radius | Zero arbitrary `rounded-[…]` left in `src/` |
| A11y tests for dialogs/tabs/forms | `src/test/components/AxeGate.test.tsx` (121 lines) covers 12 primitives + Login |
| Remove `any` / stale suppressions | Down to 3 `any`, all reasoned |
| React compiler warnings | Moot — React compiler is not configured at all |
| F-1 focus ring | `--color-focus-ring` defined in both themes |
| F-4 `aria-invalid` wiring | Present in `Input`, `Textarea`, `Dropdown` |
| F-7 CSS split | `index.css` is now a 15-line `@import` shim over `src/styles/*` |
| F-8 contrast gate | Shipped and enforced |
| F-9 component a11y | `Toggle` `aria-labelledby`, `Tabs` `aria-controls`, `Table` `scope="col"`, `Modal` body-scroll lock — all present |
| P0-1 exam link | `randCode`/`gradeLetter`/`generatedLink` gone |
| P0-2 AI grading stub | `triggerAiAssistedGrading` + `Math.random()` gone |
| P1-1 fabrication sweep | Index-derived enrichment removed from `Questions.tsx` and `Students.tsx` |
| xlsx lazy-load | `StudentImportWizard.tsx:19` dynamic-imports the parser; `student-rows.ts:315` too |
| Library ratchet F-6 | Baseline already at `button: 72` (target was 130) |
| Art Round 2 | CUTS (12), ABSENCE (10), SEAL (2), hero (2), neutral (2) all shipped; `PanelCrest`, `Cut`, `BubbleLoader` in use |
