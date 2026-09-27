# Frontend Deep Audit — Azmoonsaz

**Date:** 2026-09-27 · **Commit:** `818e415` (chore: repair .gitignore encoding…) · **Auditor:** Frontend/visual-systems review
**Scope:** full `src/` (~21,250 LOC measured), `index.css`, glass system, component library, toolchain output, bundle.

**Method:** every design-system file read line-by-line; 3 parallel evidence-gathering passes over all 30 pages/components (library adoption, complexity/duplication, perf/a11y); toolchain run live (`typecheck` ✅ 0 errors · `lint` ✅ 0 errors · `vitest` ✅ 85/85 · `build` ✅ 4.5s). All findings carry `file:line` evidence and were re-verified by grep after the agents reported them.

---

## 0. Executive Summary

Azmoonsaz has something most projects never get: a **real, self-built visual language** — warm paper, deep ink, one gold accent, a genuinely researched liquid-glass material with an edge-light that tracks the pointer. The craft level in `index.css` and `useEdgeLight.ts` is far above average. The token layer is healthy: in ~20k LOC there are only ~9 off-token color usages in TSX.

The problem is not talent or direction. The problem is that the system **grew faster than it was enforced**, and it now suffers from four structural diseases:

1. **The library exists but a third of the app ignores it.** 8 of 18 production pages import zero components from `UIComponents`. There are ~201 raw `<button>`s, ~116 raw form fields, 11 hand-rolled modal overlays, 8 custom empty states — many of them *copy-pasting the correct glass utilities* instead of calling the component. Meanwhile 6 library components (Stepper, Drawer, FileDropzone, ExamTimer, ProgressBar, `indigo` Button) have **zero production usage** and `Skeleton.tsx` is 100% dead.
2. **The glass is optically beautiful but physically unbudgeted.** An idle Dashboard stacks ~27–30 simultaneous `backdrop-filter` surfaces; the ExamResults grading view reaches **~120–160**. The flagship refraction filter is applied to surfaces where it is invisible (hero panel sits on a 97%-opaque fill) or where it fights your own doc (every Dropdown trigger). Refraction-on-animation (hamburger panels) forces per-frame displacement recomputation. This is the single thing standing between you and "runs neatly on old devices."
3. **~2,950 LOC of dead code**, including a 2,185-LOC legacy portal that is **eagerly imported into the entry chunk**, plus xlsx+papaparse (121 KB gz) chained into the default landing route, plus 16 `animate-in …` classes that resolve to nothing (no plugin installed).
4. **Small correctness bugs that betray the system's own contracts:** the app-wide focus ring is styled by an **undefined token** (`--color-focus-ring`), framer-motion ignores your own reduced-motion system (no `MotionConfig`), the hero's code contradicts its own comment, dark-mode leaks into a handful of hardcoded-white inputs, and the two toast systems can double-fire.

**Overall score: 6.0 / 10.** The bones are 9/10; the enforcement and budgeting are 3–4/10. Every disease above is mechanically fixable without redesign. The full plan is §9 — six phases, roughly 10–13 working days, ending with a frontend that is genuinely Apple-grade *and* cheap enough for old hardware.

---

## 1. Scorecard

| # | Category | Score | One-line verdict |
|---|----------|------:|------------------|
| 1 | Visual language & brand coherence | **8.0** | Distinctive, warm, unified palette; hero slab and login page are the outliers |
| 2 | Theme system (tokens, light/dark) | **6.5** | Excellent token architecture; broken focus ring, dark-mode leaks, phantom tokens |
| 3 | Glass material — visual quality | **8.5** | The rim light, veil split and ghost-frame engineering are genuinely excellent |
| 4 | Glass material — performance architecture | **3.5** | Unbudgeted overdraw; invisible refraction; refraction on wrong surfaces |
| 5 | Component library — quality of primitives | **7.5** | Good coverage, real a11y in Modal; API inconsistencies and dead exports |
| 6 | Component library — adoption / consistency | **2.5** | 8/18 pages at zero imports; ~201 raw buttons; a second parallel CSS system |
| 7 | Code health (dead code, duplication, god-files) | **4.0** | ~2,950 dead LOC; 7 god-files = 52% of pages+components; 7 duplicate fetch sites |
| 8 | Loading & bundle performance | **5.5** | Good code-splitting skeleton undermined by eager legacy portal + xlsx-on-landing |
| 9 | Accessibility | **6.0** | Strong foundations (forced-colors, live regions, 44px targets); heading chaos, Dropdown a11y gap |
| 10 | Motion & delight | **6.5** | Rich, physical, well-tuned — but JS motion ignores reduced-motion; 16 dead animation classes |
| | **Overall (weighted)** | **6.0** | Bones of a 9+; needs enforcement, budgeting, and deletion, not redesign |

---

## 2. What Is Genuinely Good (keep, protect, never regress)

These are strengths the refactor must not destroy. They are listed first because they define the ceiling of the project.

- **The token architecture** (`@theme` in `index.css:20-121` + runtime `:root` glass tokens + dark override block `222-296`). Semantic, complete, dark-aware, with separate text/solid channels for status colors so both badges and filled buttons pass contrast. This is how design systems should start.
- **The edge light (`glass-edge` + `useEdgeLight`)** — `index.css:443-499`, `useEdgeLight.ts`. One delegated passive listener for 269+ surfaces, no React re-renders, rAF-eased, size-relative rim thickness via `clamp()`, per-theme material weighting ("light is a hard material, dark is a soft one" is a genuinely Apple-grade design thought). Pointer-jitter epsilon, mouse-only gating, self-stopping animation loop. This is the best code in the repo.
- **Compositor literacy.** The veil/scrim split (`index.css:672-683`), the "never animate opacity on a backdrop-filter element" ghost-frame discovery, the `@supports` split for Chromium-only refraction with Safari-safe blur floor (`index.css:560-582`), and the discovery that Tailwind v4 silently strips colliding plain selectors — all documented in comments at the exact place you need them. Whoever wrote this learned the compositor the hard way. That knowledge is an asset.
- **Accessibility foundations.** `forced-colors` support (`index.css:1237-1252`), focus-visible defaults, 44px coarse-pointer targets (`1310-1319`), safe-area insets, `aria-invalid` styling, live regions in most async surfaces, `tools/check-icon-buttons.mjs` in the pipeline, zero positive `tabIndex` in the codebase.
- **Zero-dependency glass.** No animation library beyond `motion`, no chart lib, no CSS framework beyond Tailwind. The material is yours.
- **The demo lab.** `/dev/fixtures` (FixtureGallery) is exactly how a design system should be maintained — it just needs an env guard (§6-F5) and to become the visual regression baseline.

---

## 3. Findings — Theme, Color & Typography Layer

### F1 · The app-wide focus ring runs on an undefined token 🔴 critical, 2-line fix
`index.css:1271` styles every focusable element with `outline: 2px solid var(--color-focus-ring)` — **that token is defined nowhere** (verified: only 2 usages, 0 definitions; also `UIComponents.tsx:1032`). Both rules use `:where()` (zero specificity), so the later one wins → the earlier brand rule at `index.css:358-361` (`3px` gold ring) is dead, and the live one resolves to the initial value per CSS custom-property rules. Keyboard focus is therefore inconsistent per-element (text-colored), not the gold ring you designed.
**Fix:** define `--color-focus-ring` in `@theme` (gold `rgba(245,179,1,0.72)`), delete the duplicate rule at `358-361`, keep one baseline.

### F2 · Phantom tokens
`index.css:338`: `font-size: var(--font-size-base, 0.9375rem)` — `--font-size-base` is never defined; the app body size silently lives in a fallback. Same pattern class as F1: tokens referenced but not declared. **Fix:** declare it in `@theme` or inline the value.

### F3 · The hero's code contradicts its own comment 🟠
`index.css:1063-1072` comment: *"Now it keeps the same warm-tinted body as every other panel and takes its colours from the theme."* The rule directly below (`:1073-1076`) hardcodes `linear-gradient(125deg, rgba(26,26,46,0.97), rgba(35,36,62,0.94)); color: white` — the exact "mismatched dark slab in light mode" the comment claims was fixed. The hero is still a hardcoded dark slab in both themes, overriding the `glx` utility via ID selector.
**Fix (design decision):** either make the hero actually token-driven (dark pane only in dark theme; warm ink-tinted glass in light), or update the comment to own the decision. Right now the docs are lying to future maintainers.

### F4 · Dark-mode leaks (hardcoded light values in global CSS) 🟠
- `.schedule-card input` / `select` — `index.css:1012-1022`: `background: rgba(255,255,255,0.82)`, no color property → in dark theme these inputs stay near-white while inheriting near-white text (`--color-text-primary: #f4f5f8`). Broken contrast in dark mode on the TeacherProfile schedule editor.
- `Stepper` — `UIComponents.tsx:794`: `ring-4 ring-white` — white halo breaks on dark background.
- `.login-shell` / `.login-art` hardcode `#f7f7f5`, `#f4f1e9`, `#765500` (`index.css:1115,1128,1156`) — acceptable for a light-only marketing page, but they are the only raw hexes in CSS; token-ize or comment them as deliberate.
**Fix:** sweep global CSS for literal `rgba(255,255,255,…)`/hex fills that sit on token surfaces; replace with `--color-*` tokens.

### F5 · Two grays that read as one; two competing active-state systems 🟡
- `--color-text-secondary: #5e5a68` vs `--color-text-tertiary: #716e78` are perceptually near-identical and are used interchangeably across pages. Collapse to one or widen the gap.
- Button has `active:scale-[0.98]` (`UIComponents.tsx:53`) while global CSS adds `:active { translateY(1px) }` (`index.css:1275-1277`) — two different press physics fighting on the same control.
- 16 dead `animate-in fade-in …` classes in 10 files (verified: no `tw-animate-css` plugin installed) — pages believe they animate in; nothing happens. Delete or implement.

### F6 · Typography: heavy weights + negative tracking on Persian 🟡
The type scale utilities are good (`index.css:782-822`), but pages routinely use `font-weight: 800/900` at 12–16px (`.profile-section-title h2` 900 at 16px, `.segmented-control button` 800 at 13px, Badge `font-bold`, etc.). Vazirmatn at 800–900 in small sizes goes muddy; Apple's equivalent is 600–700 for emphasis, reserving 800+ for display. Also `text-display` sets `letter-spacing: -0.02em` — negative tracking on Arabic-script text can visually cramp joins; verify on real Persian display strings or drop it for the RTL face. Meanwhile the page-level CSS uses arbitrary px sizes (13px, 12px, 11px, 19px) outside the scale — the scale exists but isn't enforced.

---

## 4. Findings — Liquid Glass: the material itself

This is the section you asked for most. Verdict up front: **the glass looks better than 95% of "liquid glass" web implementations, and it is engineered with more compositor knowledge than most design teams possess — but it has no performance budget, and it is being spent on surfaces where its most expensive layer is invisible.**

### 4.1 What the current implementation is

Every glass surface = gradient fill + hairline + lifted shadow + `backdrop-filter: blur() saturate() brightness() contrast()`; chrome adds `.glass-edge` rim (pointer-tracked); popups add `area-blur` halo + `bgfx`/veil; Chromium adds `.glx-refract` = `url(#lg-lens)` displacement (6-primitive SVG filter: 2× feImage, 2× feColorMatrix, feComposite, feDisplacementMap) per element. The recipe is token-parameterized (~40 runtime custom properties ported from `glass-lab.html`).

### 4.2 The costs, measured statically

| Surface | Simultaneous backdrop-filter elements | Refracting |
|---|---:|---:|
| Dashboard, idle (incl. chrome) | **~27–30** | 3 |
| Exams list (12 cards × ~5 BF each) | **~65–70** | 2–3 |
| NewExam wizard | ~28–35 | 2–6 |
| **ExamResults grading view** (5–7 BF per question × N) | **~120–160** | 2 |
| SecureExamPortal (student) | **0** (exemplary — solid fills) | 0 |
| Dashboard + hamburger + modal + open Dropdown (worst realistic) | **~40–44** | 7–9 |

Each BF surface forces the compositor to read back and re-filter the framebuffer every frame the backdrop changes (and on scroll, backdrop changes *constantly* — this is why heavy-glass pages feel worse while scrolling than at rest). `feDisplacementMap` on the backdrop is dramatically more expensive still, and Chromium computes it on demand per frame.

### 4.3 Specific defects

- **G1 · Refraction is optically dead on the hero.** `Dashboard.tsx:83` applies `glx glx-refract glass-edge`, but `#dashboard-hero-banner` (`index.css:1073-1076`) paints a **97%-opaque** fill on top of the filtered backdrop. The lens bends pixels you can't see. Maximum GPU cost, zero visual return. Either make the hero fill translucent enough to see the bend (~0.55–0.7) or drop `glx-refract` from it.
- **G2 · Refraction on every Dropdown trigger + every open list** (`UIComponents.tsx:381,415`) contradicts your own doc (`GlassSystem.tsx:15-18`: refraction "only where a lens reads correctly… not under body text") and your own perf intent. A form control bending the background behind it is noise, not polish. Two refracting surfaces *per open dropdown*.
- **G3 · Refraction + animation together.** The 4 hamburger panels (`Topbar.tsx:564,595,645,700`) are `glx-strong glx-refract` **and** animate (`growFromHamburger`) — per-frame displacement recomputation of an animating backdrop, ×4, plus veil + halo. This is the most expensive moment in the app, and it happens on a routine menu open.
- **G4 · Glass-on-glass nesting.** Dashboard wraps a `glx` stats grid *inside* the refracting hero (`:141` in `:83`); the library `Table` puts `glx-inset` on `<table>` **and** on the header `<tr>` (`UIComponents.tsx:1034,1036`); exam rows are `glx` cards containing `glx-inset` badges and icon buttons (Exams ×12). Nested BF multiplies cost and muddies the material — real glass doesn't refract inside itself.
- **G5 · Four filter functions on every surface.** `blur() saturate() brightness() contrast()` on every `glx`/`glx-inset`/`veil` — brightness 0.97 and contrast 0.92 are near-identity corrections that could be baked into the scrim/fill for most surfaces. Every function removed is real time on every surface, every frame.
- **G6 · The token rig is over-parameterized.** ~40 `--glass-*` vars, several consumed once or not at all (`--glass-h-mid` is defined at `index.css:156` and never used; `--glass-shn-b` is 0 and exists only to be zero; the h-fo/h-bias chain feeds one derived value). It's a lab bench bolted into production. Freeze the recipe into ~12 meaningful knobs and move the lab values into a comment.
- **G7 · Stale comment block.** `index.css:397-404` says the displacement filter is "NOT currently referenced… delete <GlassFilters/>" — written before `.glx-refract` was wired to `#lg-lens`. Wrong now; delete it (the authoritative doc lives on the utility itself).
- **G8 · `useEdgeLight` hit-tests on every qualifying pointermove** (`useEdgeLight.ts:109` — `document.elementFromPoint` + `getBoundingClientRect`, synchronous, not rAF-batched; only the *easing* is rAF'd). On 300-glass-surface pages this is measurable. Batch it into the existing rAF loop.

### 4.4 The path to "real Apple liquid glass, but light" — the tiered material system

Apple's Liquid Glass is cheap on-device because it's a GPU-composited, resolution-aware material with the OS in control of budgets. On the web we can't match the renderer, so we must do what Apple actually does on old hardware: **degrade the material, not the design.** A 2016 laptop doesn't get flat ugly — it gets the same design with the expensive *layers* removed, keeping silhouette, rim, fill and shadow. The rim light and the geometry sell "glass" far more than the blur does; the blur is the substrate (your own doc says this).

**Proposal — one material, three quality tiers, selected once at boot:**

| Tier | Who gets it | What renders | Visual loss |
|---|---|---|---|
| **T2 full** | Modern desktop/mobile GPUs (probe: `hardwareConcurrency ≥ 4`, no `prefers-reduced-transparency`, no low-memory device signal) | blur + saturate + rim + halo + refraction on chrome | — |
| **T1 lite** | Older laptops, mid phones, `prefers-reduced-transparency` | Static **blur-free** translucent fill (slightly raised alpha to compensate) + rim light + shadows. Blur only on ≤2 chrome elements (topbar). | Frosted→tinted; design identical |
| **T0 off** | `forced-colors`, `data-glass="off"` user override, device-memory ≤ 2GB | Solid token fills + borders + shadows (exactly what SecureExamPortal already does) | Material reads solid; hierarchy intact |

Implementation is small: one inline boot script (same place as the theme script in `index.html`) sets `<html data-glass="full|lite|off">`; the glass utilities read it (`:root[data-glass='lite'] .glx { backdrop-filter: none; background: … }`); no JS per component. Add a manual override in Settings next to the motion preference — Apple always gives the user the switch (Reduce Transparency).

**Surface discipline rules (the actual budget):**
1. **BF is a property of containers, not controls.** Allowed: topbar, sidebar field, page panels, modals/drawers/halos. Forbidden: badges, chips, table header rows, list rows, inputs, icon buttons, per-exam cards in lists (they sit inside a panel that already glasses). This one rule takes ExamResults from ~120–160 to **≤ 10** and Exams from ~65 to **≤ 12**.
2. **Budget: ≤ 8 BF surfaces at rest, ≤ 12 in a transient overlay.** Enforce in review via the FixtureGallery.
3. **Refraction whitelist:** topbar pills and (optionally) the primary CTA. Not dropdowns, not form controls, not anything that animates its size. If it moves, it doesn't refract.
4. **No glass inside glass.** One BF per visual stack line; inner elements get solid token fills.
5. **Reduce the chain to `blur() saturate()`** for standard surfaces; bake brightness/contrast corrections into scrim/fill tokens.
6. **De-parameterize:** ~12 glass knobs, not ~40.

Expected outcome: the glass *looks the same* on your machine (T2), looks nearly identical on mid hardware (T1 — honestly, fill+rim+shadow is 80% of the read), and never dies on old devices. This is the "much much lighter" version of the perfect glass, done the way Apple actually ships it.

---
## 5. Findings — Component Library & Adoption

### 5.1 The matrix (evidence-verified)

| Verdict | Files |
|---|---|
| **CLEAN** | FixtureGallery (dev-only), Skeleton, SaveStatusIndicator, CustomCursor (itself dead) |
| **MOSTLY-CLEAN** | Settings, Topbar, Sidebar (itself dead), ExamCountdown, ConnectivityStatus, ErrorBoundary, QuestionRenderer (token drift only) |
| **DRIFTED** | Dashboard (exemplary library use + 9 raw hero buttons), ExamResults, Students, Questions, Onboarding, CommandPalette |
| **OFF-SYSTEM (zero library imports)** | ExamSettings, ExamPreview, ExamPortal, Login, TeacherProfile, SecureExamPortal, NewExam, Exams, ResetPassword, SettingsHub |

Totals: **~201 raw `<button>`**, **~116 raw `<input>/<select>/<textarea>`**, 3 raw `<table>`s (one in ExamResults *beside* an imported library Table), **11 hand-rolled modal overlays** (most copy the correct `scrim`/`veil-blur`/`area-blur` utilities — i.e., the library's own internals, pasted), 8 custom empty states, 6 duplicated local helper components, 5 duplicated whole components (ExamCountdown≈ExamTimer, BackendModeBadge≈Badge, HealthBar≈ProgressBar, Onboarding bar≈ProgressBar, local toasts≈Toast).

**The key insight:** pages are not *rebelling* against the library — they are *copying* it. The scrim+veil+halo modal appears 10+ times, hand-pasted with the right utilities. That means adoption failure is an **API/coverage problem, not a discipline problem**: the library doesn't offer the shapes pages actually need (page header, filter bar, field row, toggle, textarea, search input), so engineers grew them in place.

### 5.2 Library API defects found (line-level)

- `Card` `hoverable` silently ignores `glassLayer` (`UIComponents.tsx:119-133` — always renders `glx`).
- `Button` `indigo` variant is a byte-identical clone of `primary` and used 0 times (`:58-59`).
- `Table`'s default empty-state action is `window.location.reload()` (`:1016`) — a full page reload baked into the design system.
- `Table` double-glasses (`glx-inset` on table and on header row) and uses the undefined focus token (F1).
- `Dropdown` trigger lacks `aria-expanded/haspopup/controls`, list has no `role="listbox"`/`option`, no arrow-key navigation, no focus restore — the app's primary select is keyboard-incomplete (contrast: CommandPalette is exemplary).
- `Toast` is self-positioning `fixed` — two concurrent toasts overlap at the same coordinates (the App container's flex layout cannot stack fixed children).
- Section numbering in the file has drifted (`6B. DROPDOWN` with no 6A) — cosmetic, but a marker of organic growth.
- Re-exporting `ChevronLeft/Right` from a UI kit (`:1245-1246`) — pages should import icons from lucide directly.

### 5.3 The parallel CSS system 🟠

`index.css:881-1234` is a **second, undocumented component library**: `.profile-panel`, `.panel-shell`, `.profile-input`, `.field-label`, `.btn-brand`, `.btn-soft`, `.segmented-control`, `.schedule-card`, `.empty-quiet`, `.section-title`, `.login-*`, `.dashboard-hero-*`, plus ID-selector layout hooks (`#stats-grid-layouts`, `#quick-action-btns`, `#dashboard-core-split`, `#dashboard-hero-banner`). Used ~34× across 7 files (TeacherProfile alone 18×). It contains the only non-token hexes in CSS (F4) and it's where dark-mode leaks live. Either absorb into the library as components or promote to a documented layer — but one system, not two.

### 5.4 Library v2 — what to add (then adoption becomes mechanical)

1. `PageHeader` (title, subtitle, actions, optional tabs) — replaces ~250 LOC across 6+ files, including the near-identical tab implementations in SettingsHub/TeacherProfile.
2. `StatCard` (label, icon, value, unit, tone) — Dashboard's 5 hand-rolled cards collapse from ~95 LOC to ~15; delete the local `CalendarIcon` SVG (duplicates lucide `CalendarDays`).
3. `FilterBar` (search + N compact dropdowns) — 3 different hand-rolled treatments converge for free.
4. `Textarea`, `Toggle/Checkbox`, `SearchInput` — the missing field shapes behind most of the 116 raw fields.
5. Fix the API defects in 5.2; make `EmptyState` the only empty state; make `ConfirmDialog` the only confirm (4 flows currently use `window.confirm` — including the **irreversible student exam submit** in SecureExamPortal:203-222, which should be a designed dialog, not a browser chrome dialog).

---

## 6. Findings — Dead Code, Bundle & Loading

### 6.1 Dead code inventory (~2,950 LOC, zero behavior change)

| Item | LOC | Evidence |
|---|---:|---|
| `pages/student/ExamPortal.tsx` (legacy) | 2,185 | Reachable only via demo role-switch buttons; hardcoded code `8AF39` (`App.tsx:335`); no URL route; **eagerly imported at `App.tsx:13` → in the entry chunk of every visit** |
| `components/Sidebar.tsx` | 266 | Zero imports (Topbar is the nav). Irony: it is `glx-dark`'s main consumer |
| `components/CustomCursor.tsx` | 64 | Zero imports (and it would have been an a11y/perf liability if mounted) |
| Library: Stepper, Drawer, FileDropzone, ExamTimer, ProgressBar, `indigo` | ~380 | Zero production usages (Drawer: both real drawers are hand-rolled; ExamTimer: pages keep their own timers) |
| `components/BackendModeBadge.tsx` + test | ~40 | Imported only by its own test |
| `components/Skeleton.tsx` | 75 | Zero imports — while `App.tsx:414-429` hand-rolls a near-copy of its `DashboardSkeleton` |
| App.tsx `customExams` state + duplicated `onSubViewChange` closures | ~40 | Exists to compute a fallback id; two identical closures at `:241-249` and `:259-267` |

### 6.2 Bundle reality (verified from `dist/`)

Entry `index` chunk: **44.7 KB gz** (includes eager Login + Onboarding + ResetPassword + **legacy ExamPortal** + SecureExamPortal). `vendor-import` (xlsx+papaparse): **121.2 KB gz** — and the Dashboard chunk (the default landing) references it via the static chain `Dashboard.tsx:26 → StudentImportWizard → parseStudentFile.ts:2 → xlsx` (verified in the built chunk). Teachers pay 121 KB for an import dialog they haven't opened. Also `Exams.tsx:24-26` statically imports ExamSettings+ExamPreview+ExamResults → one ~166 KB chunk for all exam sub-views; `SettingsHub.tsx:3-4` statically imports Questions (2,391 LOC) even for the settings-only tab. CSS: 116 KB raw / 19.2 KB gz.

**Fixes (6 lines each):** `lazy()` ExamPortal/SecureExamPortal in App; dynamic-import `parseStudentFile` inside the wizard's parse step; `lazy()` the three exam sub-views and Questions. Expected: entry chunk roughly halves; landing route drops ~121 KB.

### 6.3 Loading & fonts

- **No font preloads at all** (`index.html`): Vazirmatn — the font for 100% of text — is discovered only after CSS parse; with `font-display: swap` every page load flashes. Two `<link rel="preload" as="font" type="font/woff2" crossorigin>` + preload of the login AVIF (the LCP element on /login). This is the cheapest perceptual-speed win in the entire audit.
- ✅ The pre-hydration theme script exists (`index.html:8-39`) — dark-mode FOUC is already prevented. Good.

### 6.4 `/dev/fixtures` ships to production 🟠

`App.tsx:311` routes `/dev/` with **no env guard** — the material lab (and its bypass-auth design) is reachable in production. Gate with `import.meta.env.DEV`.

### 6.5 Two toast systems

`showAppToast` emitter in `App.tsx:64-88` (used exactly once) vs `useToast` hook (used by 5 pages). **Double-fire seam confirmed:** `NewExam.tsx:155-158` shows its own success toast *and* calls `onAddExam` → `App.tsx:194` shows the identical message; today the page unmounts before both render — an accident, not a design. Kill `showAppToast`; make `useToast` the single system (module emitter or context). Also fix Dashboard's dead `toastElement` wiring (destructures but never shows).

---

## 7. Findings — Motion, Accessibility, Architecture

### 7.1 Motion

- 🔴 **framer-motion ignores your own reduced-motion system.** `MotionContext` sets `data-motion=reduce` and the CSS kills CSS animations — but the 12 files / ~89 `motion.*` elements / ~20 `AnimatePresence` usages are JS-driven and run regardless. Your own contract ("OS accessibility preference is always a safety ceiling", `MotionContext.tsx:31-33`) is violated by every spring in the app. **One-line fix:** wrap the provider tree in `<MotionConfig reducedMotion="user">` from `motion/react`.
- 🔴 **EdgeLightDriver uses the raw preference, not the resolved one** (`App.tsx:48-49`: `motionPreference !== 'reduced'`). A `system` user whose OS requests reduced motion still gets the animated rim flare (JS custom-property writes that CSS overrides can't stop). Use `resolvedMotion !== 'reduce'`.
- 16 `animate-in …` classes resolve to nothing (F5) — pages that believe they animate don't.
- Minor: `Sidebar`'s `whileHover={{ x: -2 }}` nudges leftward in an RTL layout (moot if Sidebar is deleted); `ExamTimer` uses drifting `setInterval` rather than a timestamp anchor (relevant if you adopt it instead of page-local timers).

### 7.2 Accessibility (top 5, ranked)

1. **SecureExamPortal — the highest-stakes surface — is the least annotated:** error banner (`:268`) and sync status (`:397-402`) are mute (no `role`/`aria-live`); answer options convey selection by color only — no `aria-pressed`/`radiogroup` (`:447-471`); irreversible submit via `window.confirm`; no focus management between login → exam → submitted phases.
2. **Heading hierarchy is broken app-wide:** the only `h1` lives in the (dead) Sidebar — on mobile no page has an `h1`; Dashboard starts at `h2` (`:94`); NewExam starts at `h3` (`:186`); ExamResults order is h1→h4→h3→h2 (`:601/:646/:796/:1153`); TeacherProfile has two `h1`s.
3. **Dropdown keyboard gap** (§5.2) — the primary select is incomplete for keyboard/AT users.
4. `div role="button"` clusters in Topbar menus (8 instances, `:440-841`) instead of `<button>`; `MarkBubble` clickable `<svg>` has no `tabIndex`/`onKeyDown` (`TheMark.tsx:162-163`).
5. Unlabeled search input in ExamResults (`:818-827` — `<label>` without `htmlFor`); `div role="status"` loaders in App render empty boxes with no visible fallback text.
(Strengths worth keeping: `forced-colors` block, live regions in most async surfaces, icon-button check tool, zero positive tabIndex.)

### 7.3 RTL

176 physical-direction classes across 25 files (`text-right`, `mr-/ml-`, `right-3`, `pr-11`…). They are *correct today* (the app is permanently RTL) but fragile; the worst offenders are ExamPreview (21), UIComponents (17 — including the Input icon positioning and Toast centering, which is safe but physical), Students, ExamPortal, ExamResults. `useOriginFromTrigger` was checked line-by-line: **RTL-safe** (pure `getBoundingClientRect` visual math, transform neutralized before measuring). Recommendation: don't mass-rewrite; convert opportunistically as files are touched, and make logical properties (`ps-/pe-/start-/end-`) a library-v2 standard so new code is born safe.

### 7.4 Architecture & state

- **7 duplicate fetch sites**: `useDashboardData` (used only by Dashboard) vs. identical `useState+useEffect+try/catch` boilerplate in Exams, Students, Classes, Questions, ExamResults, CommandPalette, Topbar. Navigating Dashboard→Students refetches what Dashboard already holds. Promote to a `TeacherDataContext` mounted in the shell → deletes ~150 LOC and gives you one cache.
- `App.tsx` fetches `getCurrentTeacher` twice at boot (`:118` and `:181`) plus TeacherContext's own fetch — 3 profile round-trips per login.
- Hand-rolled history router in App (regex + `pushState`) — *fine* at this scale; do not introduce react-router now, but consolidate the duplicated route-match/sub-view logic.
- `TeacherContext.updateTeacher` writes localStorage as a second source of truth beside Supabase (mock-era leftover).
- Topbar (895 LOC) mixes brand animation (TheMarkHamburger), notifications fetching, search, avatar expansion — 8 `useState` + 4 effects in a header. Extract the notification panel after the library pass.
- God-files: 7 files > 800 LOC (Questions 2,391; ExamPortal 2,185; ExamPreview 2,183; ExamResults 1,720; ExamSettings 1,509; Students 1,371; UIComponents 1,247) = **52% of all measured LOC**. Don't split by reflex: Phase 1 deletion + Phase 3 extraction will mechanically shrink most of them; split what remains after.

---
## 8. What "Apple-grade" means for Azmoonsaz (the taste notes)

Perfection here is not more effects — it is **fewer, better-enforced effects**. The Apple feel comes from five disciplines, and the current codebase already has the talent for all five:

1. **Material discipline.** One glass material, three weights (standard/strong/inset), used on *containers only*. Today the material appears on badges, table header rows, icon buttons and inputs — which is why it reads busy at times. When glass is rare, glass is premium.
2. **Type restraint.** Two or three sizes per screen, weights 400/600/700 (800 reserved for the hero), one text-secondary gray, and the type scale enforced by the library instead of re-declared per page. Persian deserves lighter weights than the current 800/900 habit — verify on device.
3. **State consistency.** One focus ring (gold, defined), one press physics, one hover behavior per component class — currently three hover treatments for filter bars and two press systems. These are invisible until they're inconsistent, and then they're the whole impression.
4. **Motion honesty.** Every animation respects the OS ceiling (`MotionConfig`), entrance animations actually run (delete or implement the dead classes), and the most expensive effect (refraction) never co-occurs with movement.
5. **The switched-on-feel of *bounded* delight.** The edge light, the mark pop, the rim flare — these are the moments users remember. They survive the tiering system untouched because they're cheap. Protect them; budget everything else.

---

## 9. The Refactor Plan — systematic, robust, six phases

Order matters: delete → budget → converge → harden → polish. Each phase ends in a shippable, verified state (`npm run check` + FixtureGallery visual pass).

### Phase 0 — Correctness fixes (½–1 day, zero visual risk)
| # | Fix | Where |
|---|---|---|
| 0.1 | Define `--color-focus-ring`; delete the duplicate focus rule; keep one gold baseline | `index.css:358,1261-1273` |
| 0.2 | Declare or inline `--font-size-base` | `index.css:338` |
| 0.3 | `<MotionConfig reducedMotion="user">` at provider root | `main.tsx` |
| 0.4 | EdgeLightDriver uses `resolvedMotion` | `App.tsx:48-49` |
| 0.5 | Font preloads (2× Vazirmatn + login AVIF) | `index.html` |
| 0.6 | Env-guard `/dev/` route | `App.tsx:311` |
| 0.7 | Delete stale filter comment; delete unused `--glass-h-mid` | `index.css:397-404,156` |
| 0.8 | Fix dark-mode leaks: schedule-card inputs, Stepper ring-white | `index.css:1012`, `UIComponents:794` |
| 0.9 | Remove/replace 16 dead `animate-in` classes | 10 files |
| 0.10 | Fix Exams' two off-token palette classes (`to-teal-500`, `from-slate-400…`) and QuestionRenderer's malformed opacity compounds | `Exams:280,283`, `QuestionRenderer:301,405,433,488` |

### Phase 1 — Delete dead weight (1 day, zero visual change, entry chunk shrinks)
Delete: ExamPortal + role-switch demo wiring + `customExams`; Sidebar; CustomCursor; BackendModeBadge(+test); Stepper, Drawer, FileDropzone, ExamTimer, ProgressBar, `indigo` (or, where a Phase-3 need exists — Drawer for the question editors, ExamTimer for the student portal — *adopt* the library one instead of the hand-rolled copy; decide per component once, in the library); Skeleton.tsx (or make App use it — one of the two); `showAppToast` (one toast system). `lazy()` SecureExamPortal; dynamic-import xlsx/papaparse inside the wizard; `lazy()` exam sub-views + Questions in SettingsHub. **Target: −2,900 LOC, entry −~20 KB, landing route −121 KB gz.**

### Phase 2 — Glass budget & tiered material (2–3 days, visual-neutral on T2)
1. Add the boot capability probe → `data-glass="full|lite|off"` + Settings override (§4.4 table).
2. Enforce surface discipline: strip BF from badges/chips/rows/table-headers/icon-buttons/inputs → solid token fills (ExamResults 120-160 → ≤10; Exams 65 → ≤12).
3. De-refract Dropdown trigger+list; de-refract or de-opacify the hero (G1); hamburger panels lose `glx-refract` while animating.
4. De-nest glass (hero inner wrapper, Table header, card-in-panel stacks).
5. Reduce the filter chain to `blur() saturate()` for standard surfaces; fold brightness/contrast into scrim/fill tokens.
6. Freeze the glass knobs to the meaningful ~12; document each in one line.
7. Re-verify every surface in FixtureGallery at all three tiers — that's what it's for. **Budget rule going forward: ≤8 BF at rest / ≤12 overlay / refraction whitelist = topbar pills + primary CTA.**

### Phase 3 — Library v2 + mechanical adoption (3–5 days, the big one)
1. Fix the API defects (§5.2). Add `PageHeader`, `StatCard`, `FilterBar`, `SearchInput`, `Textarea`, `Toggle`, `FieldRow`.
2. Migrate in this order (worst-first, most-copied-pattern-first): modal overlays → `Modal`/`ConfirmDialog` (11 sites, copy-paste-shaped already); page headers (6 sites); filter bars (3 sites); form fields in Questions/ExamSettings/NewExam/Login/TeacherProfile (~60 of the 116 raw fields); stat cards; empty states (8 sites); status badges (Exams' local map → `StatusBadge`); converge ExamCountdown↔ExamTimer and BackendModeBadge↔Badge.
3. Absorb the `.profile-*`/`.btn-brand`/`.segmented-control` second CSS system into components; delete it from `index.css`.
4. Split the remaining god-files *after* extraction (Questions, ExamPreview, ExamResults) — by then they'll be hundreds of lines lighter.
**Acceptance: 0 raw `<button>` outside the library; 0 raw fields outside `Input`/`Textarea`/`Select`; 0 hand-rolled overlays; `index.css` back under ~600 lines.**

### Phase 4 — Accessibility hardening (1–2 days)
Headings per page (one `h1`); Dropdown a11y (roles, `aria-expanded`, arrow keys, focus restore — copy CommandPalette's pattern); SecureExamPortal live regions + `aria-pressed` answers + `ConfirmDialog` for submit + phase focus management; Topbar `div[role=button]` → `<button>`; label/id pairs; MarkBubble keyboard support. Re-run the icon-button + a11y checks.

### Phase 5 — Data layer & state (1–2 days)
`TeacherDataContext` (the 5 collections + teacher) mounted in the shell; delete 7 fetch sites; single `getCurrentTeacher` boot path; remove localStorage dual-write; consolidate App's duplicated sub-view closures.

### Phase 6 — The polish pass (1–2 days, where "made by God" lives)
Type-weight sweep (800/900 → 700 max in UI chrome); collapse the two grays; one press physics; hero gets its real token-driven identity (fix the F3 lie); login page joins the token system; spacing rhythm audit on the 4 highest-traffic screens against the FixtureGallery; final FixtureGallery visual sign-off at both themes, three glass tiers, RTL, and 320px width.

**Total: ~10–13 working days to a frontend that scores 9+ on this same rubric** — with a smaller bundle, a hard performance budget, one component library, and a material that survives old devices.

---

## 10. Top-10 priorities (if you only do ten things)

1. Define `--color-focus-ring` (F1) — 2 lines, fixes keyboard focus everywhere.
2. `<MotionConfig reducedMotion="user">` + EdgeLightDriver resolved-motion (§7.1).
3. Font preloads (§6.3) — the cheapest perceptual win.
4. Delete dead code & lazy-load the rest (§6.1-6.2) — −2,900 LOC, −121 KB on landing.
5. Glass surface discipline: BF on containers only (§4.4) — ExamResults 120→≤10.
6. Refraction whitelist + hero decision (G1/G2/G3).
7. Extract `PageHeader`/`StatCard`/`FilterBar`/field primitives, then migrate the 8 OFF-SYSTEM pages (§5).
8. One toast system, one confirm system (§5.4, §6.5).
9. SecureExamPortal a11y pass (§7.2-1) — the highest-stakes surface.
10. One data context, seven fetch sites deleted (§7.4).

---

*Verification artifacts: `npm run typecheck` 0 errors · `npm run lint` 0 errors · `vitest` 85/85 · `vite build` 4.53s, 17 chunks. All file:line references re-verified by grep on commit `818e415`.*

---

## Appendix — Implementation status (updated same day)

Phases ship one at a time; each commit passed the full gate (`npm run gate` = typecheck + lint + vitest + theme + token-integrity + glass-discipline + typography + a11y-buttons + build + bundle budget).

| Phase | Status | Commit focus |
|---|---|---|
| 0 — Correctness | ✅ shipped | F1, F2, F4, 0.3–0.10; **plus 7 phantom tokens the new gate caught beyond the audit** (`--color-surface-primary`, `--color-overlay`, `--lg-sheen-x/y`, …) |
| 1 — Dead weight | ✅ shipped | −~2,900 LOC; entry chunk 177.6 → 101.3 KB (−43%); xlsx off the landing route |
| 2 — Glass budget & tiers | ✅ shipped | `data-glass` three-tier material + Settings switch; glx-inset blur-free (87 sites); chains → blur+saturate; de-nesting; refraction whitelist-only; **plus new `check-glass-discipline` gate** |
| 3 — Library v2 + adoption | ✅ shipped (3a) | API defects fixed (dead 5 + `indigo` deleted, Table onRetry, Dropdown ARIA, ToastStack); new PageHeader/StatCard/SearchInput/Textarea/Toggle/FilterBar/DifficultyBadge with adoption + tests; window.confirm ×5 → ConfirmDialog, alert ×9 → useToast, btn-soft/btn-brand deleted; **plus new `check-library-adoption` gate** (dialogs, button system, raw-element ratchet). Remaining for 3b: 11 hand-rolled overlays → Modal, mega-form raw fields, second CSS system (.profile-*), god-file splits |
| 4 — Accessibility | ⬜ | per §9 |
| 5 — Data layer | ⬜ | per §9 |
| 6 — Polish pass | ⬜ | per §9 |

New gates added during implementation: `tools/check-css-tokens.mjs` (phantom-token detector — would have caught F1/F2 mechanically), `tools/check-glass-discipline.mjs` (refraction whitelist, no inline backdrop-filter, inset stays blur-free).

---

## Appendix B — Execution status (updated 2026-09-27, commit 3f05ea1)

| Phase | Status | Evidence |
|---|---|---|
| 0 Correctness | ✅ shipped | `b82c8aa` |
| 1 Dead weight | ✅ shipped | `4f50254` — −2,900 LOC, xlsx off landing route |
| 2 Glass tiers | ✅ shipped | `80bab5f` |
| 3a Library v2 | ✅ shipped | `f6882da` |
| 3b1 Overlays | ✅ shipped | `4645286` — all 7 hand-rolled overlays → library Modal (−435 net LOC); Modal v2.1: `3xl`/`5xl`, `variant="side"`, header icon, `bodyClassName`/`footerClassName` |
| 3b2 Fields | ✅ shipped | `a32a792` — Login/ResetPassword/Onboarding/NewExam/ExamSettings/Questions/ExamPreview → Input/Textarea/Toggle (trailing slot, size=sm, maxCount); dirty-guard now covers Escape/scrim/X on student editor |
| 3b3 Second CSS | ✅ shipped | `8263460` — `.profile-*`/`.segmented-control`/`.schedule-card`/`.empty-quiet` deleted (~138 LOC); Tabs gains tablist a11y; TeacherProfile/SettingsHub/QuestionBankHealth fully on-library |
| 3b4 God-file logic | ✅ shipped | `99e70c6` — `src/utils/question-type-labels.ts` (dedup), `exam-results/student-rows.ts` (rows/stats/filters/CSV, 7 unit tests); ratchet 153/73/2/9 → 140/40/2/1 |
| 4 A11y | ✅ shipped | `e01e5f7` — Topbar div[role=button]→button ×6, Dropdown listbox arrow-keys + focus model, SecureExamPortal aria-pressed + aria-live |
| 5 Data context | ⏳ next | TeacherDataContext (5 collections), delete fetch sites, single boot path |
| 6 Polish | ⏳ next | type-weight sweep, gray collapse, press physics, hero identity — requires FixtureGallery visual sign-off |

**Full gate at `3f05ea1` (exit 0):** typecheck 0 · lint 0 errors (2 advisory) · vitest 111/111 · theme ✓ · tokens ✓ · glass ✓ · library ratchet ✓ · typography ✓ · a11y-buttons ✓ · build 4.5s · bundle budget ✓ (22 chunks).

**Net repo delta vs origin/main:** 47 files, +3,975 / −6,271 (−2,296 net lines) with more features under test than at audit time.

Paradigm exceptions (documented, deliberate): Topbar anchored popovers + CommandPalette combobox stay custom until a Popover/Menu primitive exists; native file/date/time/radio/schedule pickers stay native; Topbar semantic-button allowance documented in the ratchet.

## Appendix C — Phases 5 & 6 shipped (final)

| Phase | Status | Evidence |
|---|---|---|
| 5 Data context | ✅ shipped | `d901ed2` |
| 6 Polish + sign-off | ✅ shipped | `791a8f8` |

### Phase 5 — what changed (d901ed2)

- **One profile boot path.** App's `bootstrap()` is the only `/api/teacher/me`
  caller at session entry; Login hands its already-fetched profile to
  `TeacherProvider` via `initialTeacher` (zero extra round-trips), and the
  provider self-fetches only on the post-onboarding/self-heal paths.
  2–3 duplicate `/me` calls per session entry → **1**.
- **`TeacherContext` = teacher + 5 collections.** `exams`, `students`,
  `questions`, `classGroups`, `submissions` load in parallel on shell mount —
  the exact cost Dashboard's `useDashboardData` used to pay alone. Two nested
  React contexts inside one provider so identity consumers don't re-render on
  collection writes. Per-collection `status` + `reload` + cache-patch helpers
  (`upsert*` / `remove*` / `addStudents`).
- **All 12 private fetch sites deleted** (audit's 7 + NewExam, ExamSettings,
  ExamPreview, QuestionBankHealth, Dashboard/useDashboardData). `get*`
  services gained `throwOnError` so the context can distinguish error vs
  empty (Classes' unreachable `.catch` error UI now actually works).
- **Mutations patch the shared cache.** No page refetches; cross-page
  coherence for free (a question created in Questions appears in NewExam's
  bank and QuestionBankHealth without remounts).
- **Grading waste killed.** `updateManualGrade`/`finalizeGrade` no longer
  refetch ALL submissions per call (they ran inside per-answer loops!);
  `finalizeGrade` is wired into the finalize flow so graded sheets stop
  reappearing as "needs grading" after reload; `gradedBy` uses the real
  teacher's name (was a hardcoded string).
- **ExamResults cohort ledger fixed** — dead `allStudents`/`classGroups`
  state (always `[]`) now rides the shared cache, so absent students appear
  in the results ledger as designed.
- **Write-only localStorage teacher mirror deleted.**
- **Glass-tier override bug fixed:** Settings wrote
  `azmoonsaz:preference:azmoonsaz-glass` (prefixed + JSON) while the pre-paint
  boot probe reads the raw `azmoonsaz-glass` — user choice never survived
  reload. New `useGlassTierPreference` owns the exact raw key.
- **App.tsx:** three verbatim copies of the exam sub-view closure collapsed
  into `handleExamSubViewChange`; TeacherProfile/Exams mounts merged; default
  tab keeps full props (was silently dropping `onSelectExamForResults`).

### Phase 6 — what changed (791a8f8)

- **Type-weight ramp (F6):** `@theme` clamps `--font-weight-extrabold/black`
  to 700 — every `font-black`/`font-extrabold` usage (110 sites) resolves
  through the two tokens (verified in built CSS: `.font-black{font-weight:
  var(--font-weight-black)}`). Display sizes keep 800. `text-display` drops
  `letter-spacing: -0.02em` (negative tracking cramps Persian cursive joins).
- **Gray hierarchy (F5):** tertiary widened from secondary — light
  `#716e78 → #8a8694`, dark `#a19eac → #8c8998` — the hint tier now reads as
  a distinct step in both themes.
- **One press physics:** global `:active` = `scale(0.98)` (was
  `translateY(1px)` fighting the library Button's `active:scale`); the
  library's duplicate class removed. One definition, components may override
  stronger deliberately (Dashboard CTA `active:scale-95`).
- **Hero identity (F3):** the hardcoded ink slab is gone. Light mode = plain
  warm glass via `glx`; dark mode = `--color-hero-pane` token (defined in the
  dark block). Hero text rides `--color-text-*`; The Mark watermark's
  per-theme filter moved from JSX classes into `.dashboard-hero-mark` CSS.
- **Login joins the tokens:** `#f7f7f5`/`#f4f1e9`/`#765500` and the copy-card
  hairline → `--color-login-paper` / `--color-login-art-paper` /
  `--color-login-gold-ink` / `--color-glass-light-stroke` (deliberately
  light-only, documented at the token site).

### Visual sign-off (rendered, headless Chromium)

Captured from `/dev/fixtures` + login on a live dev server
(`download/signoff/*.png`): light×full, dark×full, dark×lite, dark×off,
320px mobile (light+dark), login page. All tiers distinct, no overflow at
320px, weights crisp, dark hierarchy readable.

**Full gate at `791a8f8` (exit 0):** typecheck 0 · lint 0 errors (1
pre-existing advisory) · vitest **120/120** · theme ✓ · tokens ✓ · glass ✓ ·
library ratchet ✓ (140/40/2/1) · typography ✓ · a11y-buttons ✓ · build ~4.6s ·
bundle budget ✓ (22 chunks).

**Plan complete — all six phases shipped behind the gate.**

Remaining known follow-ups (deliberately out of scope, flagged for the
maintainer): fake-data enrichment by index (Students status, Questions
difficulty/section/tags) is demo-grade and should eventually move to real
backend fields; `examService` dead methods (`generateExamDraft`,
`publishExam`, `getExamByCode`, `getExamForStudent`, `importStudents`,
`autoGradeSubmission`) are candidates for deletion; a Popover/Menu primitive
would let Topbar popovers and CommandPalette join the library; cache is
session-scoped — a future `refetchOnFocus`/SWR layer could replace the
Topbar's 60s panel poll.
