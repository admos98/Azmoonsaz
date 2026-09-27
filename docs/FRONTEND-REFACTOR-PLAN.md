# Azmoon — Frontend Refactor: Master Plan & Decisions

**Status:** Phase 1 in progress · **Revert point:** `c9d2016` (pushed, docs only)
**Audited at:** `818e415` · **Full audit:** `docs/frontend-audit-2026-09-26.md`
**Glass audit:** `docs/glass-audit-2026-09-26.md`

> **This is the source of truth for the entire frontend rework.** If context is
> compressed, read this file first. It holds the decisions, the measurements, the
> phase order, and the current position.

---

## The goal

Take the frontend from **5.5/10 to Apple-grade**, with a real component
library, one token system, honest glass physics, and a performance budget that
holds on old devices. The material is where taste decides; everything after it
is provable with typecheck, build, and DOM scripts.

---

## Review model

Every material change ships as a **test deploy**. The commit *before* each test
deploy is the main tree revert point. One phase at a time, deploy, user verifies
on Vercel, verdict, then next phase.

---

## Decisions (locked — user confirmed)

| # | Question | Decision |
|---|---|---|
| D1 | What sits behind the glass? | **Add a subtle depth field** — gradient + very low-contrast texture — so blur/refraction has something to work on |
| D2 | Quality tiers | **Floating chrome = full liquid glass** (hero, menu, topbar buttons, modals, sheets, toasts). **Ordinary panels = robust cheap frosted.** Plus a **Full / Light toggle in Settings** |
| D3 | Toggle default | **Auto-detect on first visit** via `navigator.deviceMemory` + `navigator.hardwareConcurrency`. User can override in Settings. Persisted like theme/motion. |
| D4 | Rim presence, light mode | **Bold but tight** — clear bright line with soft inward falloff, visible on a busy background |
| D5 | Cursor sheen | **Subtle, floating chrome ONLY.** Never on the 292 in-page cards |
| D6 | Component library | **Extend `src/components/UIComponents.tsx`** into the full surface set. One import path. |
| D7 | Palette | **Unchanged.** The Mark: ink `#221E4A`, gold `#F5B301`, cream ground. Only material, contrast, edge treatment. |
| D8 | Review cadence | Clean tree to revert to; test deploy per phase |

### Locked implementation notes

- **Quality toggle mirrors the theme/motion pattern exactly**: `localStorage` key
  → pre-paint script in `index.html:8-37` → Context → `data-glass-quality` on
  `<html>`. No flash of the wrong tier.
- **Depth field is CSS-only**: `background-image` on `<body>`, below all content.
  One composited layer, not per-panel work.

---

## Scorecard (at `818e415`)

**Overall 5.5/10 — strong bones, unbuilt.**

| Area | Score |
|---|---|
| Colour discipline | 9/10 |
| Architecture intent | 8/10 |
| Token coherence | 4/10 |
| Component library | 3/10 |
| Glass material | 3/10 |
| Typography | 6/10 |
| Motion | 4/10 |
| Accessibility | 5/10 |
| Performance | 4/10 |

**Verdict:** a well-architected design system that was never actually adopted.
The tokens are better than most production apps. The pages just don't use them.

---

## Key measurements (do not re-derive)

- **Rim is white on white.** `--glass-edge-color: 255 255 255` on
  `--glass-p-tint: 255 255 255`. Composited rim differs from panel by **4/255**;
  the 1px border by **49/255**. Rim is 12× less visible than the border. Light
  mode is showing the border.
- **"Size-relative" thickness is decorative.** `clamp(1.5px, 4.2%, 3.6px)`
  saturates at **86px wide**. The 1376px hero and a 40px avatar both get 3.6px.
- **The rim cannot fade inward — architecturally.** `mask-composite: exclude`
  confines the gradient to the ring; a ring has no interior. Measured top band
  alpha `0.5 → 0.496` on the hero. An `inset` box-shadow is required.
- **Panels ~1% different from page.** Light `251,250,247` on `250,248,245` =
  2/255. Dark = 4/255.
- **Nothing behind the glass.** Page bg = two radial tints at **1% opacity** over
  flat cream. `blur(7px)` on a flat field returns a flat field.
- **Library bypassed 92%.** `<Card>` 24 uses vs **292** hand-written `glx`
  surfaces. Only 50 (17%) carry the rim. 121 repeated className strings.
- **Two glass token systems, drifted.** `@theme --color-glass-*` (used **327×**
  directly in TSX) vs `:root --glass-*` (used **0×** in TSX, utilities only).
  Stroke `0.1` vs `0.22`; fill `0.45/0.78` vs `0.3/0.14`.
- **409 double-specified font weights** in markup + type utility.
- **353 KB** `vendor-import` (121 KB gzip) — PapaParse + SheetJS statically
  imported at `src/features/student-import/parseStudentFile.ts:1-2`.
- Two blur recipes, **opposite brightness**: `index.css:518` vs `:538`.
- Top glass-density files: `ExamPreview` 58, `Questions` 54, `ExamSettings` 38,
  `ExamResults` 26.
- Repeated classNames that should be components: `area-blur` ×9,
  `scrim`+`veil-blur` ×7, stat-card block ×7.

---

## Phase history (done)

| Phase | Commit |
|---|---|
| Phase 0 — visual lab + guard rails | `a26d0f5` |
| Phase 1a — brand tokens & typography | `8421013` |
| Phase 1b — glass physics | `9a13b86` |
| Audit + docs (revert point) | `c9d2016` |

---

# THE PLAN

## 🔄 Phase 1 — Glass material + depth field *(current)*

Delivered as one test deploy. Audit phases 1 and 2 combined, because the material
is meaningless without something behind it to refract.

1. **Depth field** — CSS-only `background-image` on `<body>`. Subtle gradient,
   low contrast. Gives `backdrop-filter` real structure to sample.
2. **Radial body fill** — densest at rim, clearest at centre. Fixes the 2/255
   panel-page delta and restores dark-mode luminance range.
3. **Three-part rim** — (a) sub-pixel outer line, (b) band with genuine
   *cross-band* falloff, (c) `inset` box-shadow carrying glow inward. Part (c)
   is the one a masked ring cannot express.
4. **Rim thickness** — actually size-responsive, or the percentage comes out.
5. **Border removed** — the rim becomes the edge.
6. **Light-mode rim at full presence** per D4.
7. **Quality tier plumbing** — `data-glass-quality` on `<html>`, Full/Light
   resolved pre-paint, Settings toggle, auto-detect default per D2/D3.
8. **Cursor sheen on floating chrome only** per D5.

**Gate:** user inspects on Vercel. Only phase where taste decides.

## ⬜ Phase 2 — Component library, then migrate

1. Define the surface set once: `Panel`, `StatCard`, `MenuButton`, `Field`,
   `Badge`, `Sheet`, `HeroSurface` — each owning its glass recipe.
2. Promote copy-pasted wrappers: `GlassHalo` (×9), `Scrim` (×7), `StatCard` (×7).
3. Migrate high-density first: `ExamPreview` (58), `Questions` (54),
   `ExamSettings` (38), `ExamResults` (26).
4. Delete inline `glx …` class strings per migrated file.

**Gate:** rim + body live in the library, so one edit changes 292 surfaces.
This is where the material stops drifting again.

## ⬜ Phase 3 — Collapse the two token systems

Keep `--color-*` as the single vocabulary (TSX already speaks it 327×). Migrate
the `--glass-*` utilities onto it and delete the duplicates. Reconcile stroke
`0.1` vs `0.22`, fill `0.45/0.78` vs `0.3/0.14`. Unify the two blur recipes
that currently have opposite brightness (`index.css:518` vs `:538`).

## ⬜ Phase 4 — Typography, motion, radius

1. **One owner for weight** — strip the 409 `font-*` classes, or strip weight
   from the utilities. Not both. Currently CSS-order decides.
2. **Verify the woff2 is variable** and settle `font-weight: 650` on
   `text-micro`. If the file is a static instance it snaps to 700, making micro
   text heavier than label text (600) — an inverted hierarchy.
3. **Motion tokens** — define `--dur-fast/base/slow`, `--ease-standard/exit`.
   Replace 15 hardcoded `cubic-bezier` + 4 arbitrary easings + 36 mismatched
   `duration-N`. The app has no single "feel" today.
4. **One radius scale** — 6 radii across 270+ uses; halo at 28px vs panels at
   24/32px, so the halo behind every modal is on a different radius than the
   modal.

## ⬜ Phase 5 — Performance & accessibility

1. `await import('xlsx')` at `parseStudentFile.ts:1-2` — removes ~121 KB gzip
   from the critical path. Every user currently downloads a spreadsheet parser
   to reach the dashboard.
2. `will-change` / `contain` on the 9 blurred surfaces and 17 z-index layers.
3. **Focus-visible audit**; add `role`/`tabIndex` to `div`-as-button surfaces
   (e.g. the avatar pill in `Topbar.tsx`).
4. **Re-run contrast** — Phase 1 changes every panel edge, so the Phase 2
   (glass physics) measurements are stale.
5. Forced-colors pass.
6. Verify the light-mode rim meets contrast on a busy background (D4).

---

## Constraints & known limits

- **Refraction is Chromium-only.** Safari drops `backdrop-filter: url()`.
  The `@supports` split is correct → Safari gets frosted glass. The two will
  never match exactly.
- **Halos must stay STATIC.** Animating opacity on a `backdrop-filter` element
  kills its blur. Never animate a halo.
- **The agent cannot see the deployed page.** All perceptual judgement comes
  from source, computed values, and user screenshots. Phases 1 and 2 need the
  user's eyes. Phases 3–5 are provable via typecheck/build/DOM scripts.
- Verify with `npm run typecheck`, `npm run build`, `npm run test`,
  `npm run lint`. Do not use browser_exec — it times out in this environment.
- Revert point for the current test deploy: `c9d2016`.
