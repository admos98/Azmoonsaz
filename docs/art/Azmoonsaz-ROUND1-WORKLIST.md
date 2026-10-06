# Azmoonsaz — Worklist: "Give it life" (Round 1) + full backlog

**Ref:** `430875f`. Every Round-1 item has an exact before → after value so you can work straight down the list.
Companion docs: `Azmoonsaz-FRONTEND-DESIGN-AUDIT.md` (F-ids), `Azmoonsaz-SCORE-AND-AI-ASSESSMENT.md`, `Azmoonsaz-FRONTEND-AUDIT.md` (P-ids).

---

# Why dark currently wins (read this once, then the edits make sense)

Three numbers explain your screenshots:

1. **Contour perceptual contrast.** Both plates draw 9 isolines, but light runs ink `#221E4A` at `line_a=0.10` on cream `#f2efe8`, while dark runs cream `#F7F1E4` at `line_a=0.14` on `#131220`. Same-ish absolute delta, **~2.5× different perceived contrast** — at cream's high luminance the eye needs a much bigger delta to see the same line (Weber's law). Dark's 0.14 *feels like* light's ~0.20.
2. **The fade mask kills the edges.** Builder D's `fade` mask is `1 → 0.7 (70%) → 0.25 (100%)`. Your dashboard is a wide grid; the plate area users actually see is the gutters and edges — exactly where the mask has faded the lines to a quarter. In dark the lines start strong enough to survive it; in light they don't.
3. **Panel-over-page delta.** Light panel fill is white at **0.45** over cream = `#f7f5ef` vs page `#f2efe8` — a ~4/255 delta. Dark is `rgba(52,49,66,0.72)` over `#131220` — a much wider step. So light panels barely separate, and with the contours gone the glass has nothing to bend → the material reads as flat beige.

**So: you don't need a new background. You need the light plate drawn at dark's *perceived* strength, and the light value range widened by ~one stop.** Everything below follows from that.

---

# ROUND 1 — Give it life (light-theme parity + hierarchy)

## 1A · The plate — `tools/gen-backgrounds.py` → `THEMES["light"]`

```python
# before
"light": dict(page="#f2efe8", line=INK, grain=INK, bloom=GOLD,
              line_a=0.10, gold_a=0.42, grain_a=0.05, lift="#FFFDF8"),
# after
"light": dict(page="#f2efe8", line=INK, grain=INK, bloom=GOLD,
              line_a=0.18, gold_a=0.55, grain_a=0.07, lift="#FFFDF8"),
```

| knob | before | after | why |
|---|---|---|---|
| `line_a` | 0.10 | **0.18** | matches dark's *perceived* line weight, not its alpha. Don't exceed ~0.20 or the plate gets noisy under text-free gutters. |
| `gold_a` | 0.42 | **0.55** | equals dark. The gold pass-mark contour is your best depth cue — in your light screenshot it's the one thing that survives, and it's at half strength. |
| `grain_a` | 0.05 | **0.07** | equals dark. Gives the cream surface tooth so large empty areas don't read as flat paper. |

**Also in builder D's defs** (the generated `<defs>` block — same edit in the builder, then regenerate):

| element | before | after | why |
|---|---|---|---|
| `fade` mask stops | `1 / 0.7 / 0.25` | `1 / 0.8 / 0.45` | keeps contours alive at viewport edges, which is where your grid shows the plate |
| `bloom` (gold radial) | `0.16 / 0.05 / 0` | `0.20 / 0.07 / 0` | the warm top-right glow dark gets from its violet bloom; light currently has almost none |
| `pool` (ink radial, bottom corner) | `0.11 / 0` | `0.15 / 0` | corner depth — stops the page reading as one uniform sheet |

Then: `python3 tools/gen-backgrounds.py`.

**Do not** darken `page`. `#f2efe8` is the brand paper from `brand-the-mark.md`; the fix is line strength, not page value.

## 1B · Light glass tokens — `src/index.css` light `@theme` block

| token | line | before | after | why |
|---|---|---|---|---|
| `--color-glass-light-fill` | 82 | `rgba(255,255,255,0.45)` | `rgba(255,255,255,0.52)` | panel-over-page delta ~4 → ~8/255. Stop at 0.55 or the plate dies under panels again |
| `--color-glass-light-stroke` | 83 | `rgba(26,26,46,0.10)` | `rgba(26,26,46,0.14)` | the hairline becomes an actual edge in light; dark is already 0.12 |
| `--color-glass-shadow` | 97 | `rgba(26,28,34,0.12)` | `rgba(26,28,34,0.16)` | light panels float on shadow as much as on fill |
| `--color-glass-shadow-strong` | 98 | `rgba(26,28,34,0.18)` | `rgba(26,28,34,0.24)` | modals/hero separation |
| `--color-inset-fill` | 87 | `rgba(250,248,245,0.58)` | `rgba(250,248,245,0.70)` | wells read as wells; right now inputs are nearly the same value as their host panel |
| `--color-surface-secondary` | 74 | `#f3f1ec` | `#efece4` | skeletons, hover rows and chips get one more step of depth (optional but cheap) |

**Verify with the engine in mind:** `--lens-dim` light stays `0.10` (`:264`). The dim is filter output; widening the *painted* range is what makes the bend visible.

## 1C · Focal point — the primary CTA must win

`src/index.css` `.btn-glass--primary` (`:1733-1736`):

```css
/* before */
.btn-glass--primary { --btn-tint: var(--color-ink); --btn-tint-mix: 24%; }
/* after */
.btn-glass--primary {
  --btn-tint: transparent;
  --btn-tint-mix: 0%;
  background: var(--color-accent-solid);
  color: var(--color-text-on-solid);
  border-color: transparent;
}
.btn-glass--primary:hover { filter: brightness(1.06); }
```

Your own brand doc says *"Ink carries solid fills."* A 24% wash doesn't. Contrast is already proven: light `#343242`+white = **12.49:1**, dark `#5b5880`+white = **6.66:1** — both pass without new tokens. This one change gives the dashboard (and every page header) a focal point in both themes.

## 1D · Hero Mark: `opacity: 0.1` is why the brand whispers

`src/index.css:1185-1190` — `.dashboard-hero-mark { opacity: 0.1 }`, dark `0.16`.

- [ ] light `0.1` → **`0.22`**, dark `0.16` → **`0.20`**. Keep the `blur(0.5px)`. At 0.22 it reads as a confident watermark instead of four pale donuts; at 0.1 it's below the threshold where the eye registers it as an object.

## 1E · Designed zeros (the first-run problem)

Persian `۰` is a dot; at `text-heading-1` your five stat cards read as broken, not empty.

- [ ] In `Dashboard.tsx` (or `StatCard`), when a count is `0`: the value zone shows the panel's **empty-state motif** at 56–72px (worklist 1K / prompt pack) instead of the dot-zero, with the footnote carrying the call to action. If a motif isn't ready yet, fall back to `—` in `text-heading-2 text-[var(--color-text-tertiary)]` — never the bare `۰`, which at 28px reads as a speck, i.e. as a bug.
- [ ] Same treatment for the two bottom panels' empty states is fine as-is (they already have icon + copy + action) — but move the action button **above** the description, not below the fold line. In your screenshot the «همین الان آزمون نو بسازید» button is clipped at the viewport bottom.

## 1F · The grading tile is a traffic light (state-driven tone + copy)

Green when there is nothing to grade, red when there is. Correct inbox-zero semantics — green = all clear, red = action needed — and better than tone-only, because the **copy changes with the state** too.

- [ ] `Dashboard.tsx` «تصحیح تشریحی» tile, two states:
  - **0 papers:** `btn-glass--success` tint, label «تصحیح تشریحی — موردی در انتظار نیست», icon chip `success-soft`. Calm green: the tint, never a solid slab.
  - **>0 papers:** `btn-glass--danger` tint, label **with the count**: «۳ پاسخ‌برگ در انتظار تصحیح». Red now means something because it only appears when there is work.
  - Both states stay *tinted glass* (the family rule). Solid fills remain reserved for the primary CTA after 1C.
- [ ] Same rule for the stat footnote «پاسخ‌های تشریحی در انتظار نمره»: success tone + «در انتظار تصحیح: هیچ» at 0; danger tone + count at >0.
- [ ] Why this works: an alarm colour that is always on trains users to ignore it; a colour that changes with state is information. Green-at-zero also gives the empty dashboard one calm positive focal point instead of five grey holes.

## 1G · Quick actions need a resting body in light

- [ ] The five tiles are `btn-glass--bare` (no body at rest). In light that's five outlines on cream — invisible. Switch the Dashboard quick-action tiles to **`btn-glass--quiet`** (`--btn-tint-mix: 0%; --btn-edge-a: 0.16` plus the sheen/blur body) so they read as *buttons at rest* and still materialize gold on hover. One className change at the call site; don't touch `--bare` globally (menus depend on it).
- [ ] Grid balance: the 5th tile spans two columns and reads as an afterthought. Either make it a 2×2 + move «تصحیح تشریحی» into the stats column as a 5th StatCard, or add a 6th action («پروفایل و کلاس‌ها»). Your call — just don't leave the 1-span-2 orphan.

## 1H · Menu bleed: keep it — tune its amplitude, not its existence

The bleed is the material; iOS liquid glass bleeds too. The distinction that decides whether it reads as glass or as a bug is **what** bleeds:

- **Colour, contour, shape bleeding through = glass.** Keep at any amplitude.
- **Readable glyphs bleeding through = collision.** In screenshot 3 the hero h1 is legible *through* the menu and competes with the menu's own labels. iOS prevents exactly this with vibrancy + variable blur: background text drops below the legibility threshold while colour still flows.

Goal, stated as a testable rule: **with the menu open, you should perceive that something is behind it without being able to read it.**

- [ ] `index.css:270` light `--lens-menu-dim: 0.14 → 0.20`; pin dark with `:root[data-theme='dark'] { --lens-menu-dim: 0.14; }` so dark menus don't move. At 0.20 the contour, gold and panel colour still show through — bleed intact — but 28px glyphs fall under the reading threshold.
- [ ] Acceptance test (by eye at 1440 and 375, or assert in `glassMaterial.test.ts`): hamburger open over the hero h1 — the ghost must be *perceivable but unreadable*; menu labels still ≥4.5:1 against the panel.
- [ ] If 0.20 isn't enough on a bright panel, second lever is dim again (0.24), **not** a scrim and **not** an opaque header band — you retired the veil for a reason and the bleed is the identity. Blur stays at its perf-tuned value.
- [ ] While in there: the menu header repeats the app name **and** the date the hero already shows (`۱۲ مهر ۱۴۰۵` twice on screen). Drop one.

## 1I · Greeting is a fallback value

- [ ] `Dashboard.tsx` hero: «سلام، استاد moslem.adib2019 عزیز» — raw Latin email handle as display name. Use `teacher.name`, and until onboarding captures one, fall back to the handle **without the domain** (`moslem.adib2019` → split at `@`), or just «سلام، استاد عزیز». This is the first sentence every teacher reads every day.

## 1J · Auth pages still wear the pre-brand gradient

- [ ] `Onboarding.tsx:77` — `bg-gradient-to-br from-[var(--color-accent)] via-white to-violet-50` → reuse the login surface: `className="login-shell min-h-screen p-4 sm:p-6"` (same as `Login.tsx:103`) or at minimum `bg-[var(--color-page-bg)]`. `violet-50` is the exact aesthetic `brand-the-mark.md` deleted.
- [ ] `ResetPassword.tsx:75, 88, 123, 151` — four branches of `bg-gradient-to-br from-[var(--color-accent-soft)] via-[var(--color-surface)] to-[var(--color-info-soft)]` (`#dbeafe` = blue) → same `login-shell` treatment.
- [ ] `ExamSettings.tsx:427` — `bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]` (same colour both stops) → `bg-[var(--color-accent-solid)]` with `text-[var(--color-text-on-solid)]`.
- [ ] **Gate it:** extend `tools/check-theme-tokens.mjs` `forbidden` (`:10-14`) from neutrals-only to the full palette + gradient stops:
  `/\b(?:bg|text|border|from|via|to|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?\b/g`
  Catches `violet-50`, `emerald-500` (Questions:1680), `slate-800` (ExamPreview:801), `amber-150` (QuestionRenderer:43 — not even a real Tailwind step) in one move.

## 1K · Empty-state art — isometric, but brand-derived (never stock)

Replace the 20px-icons-in-48px-circles with real empty-state illustrations. Empty panels are half of the first-run screen; art is the cheapest way to make "nothing here yet" read as designed. **One hard constraint:** generic isometric clip-art is itself an AI/template signature (the undraw / stock-vector look) — you would be trading one generic tell for another. The art must be derived from The Mark so it reads as the same hand that drew the logo and the plate:

- **Language:** line-only isometric at ~30°; stroke weight from the Mark's own proportion family (`0.22 × D`); strokes in `--color-ink` (already theme-aware); **exactly one gold filled element per illustration** — the answered bubble; no other fills except optional `--color-accent-soft` washes; contour lines from the page plate allowed as a ground motif.
- **Implementation:** one inline-SVG component `src/components/EmptyStateArt.tsx`, `kind: 'students' | 'exams' | 'submissions' | 'questions' | 'results' | 'classes'`, size prop (`compact` 96px / `panel` 160px). Inline SVG, not PNG — theming comes free via CSS vars and it stays crisp at any DPR. No per-theme files.
- **A11y & motion:** `aria-hidden="true"` (the existing title/description carry the meaning). If animated: one-time draw-in on mount only — no loops; the pulse-discipline rule applies to illustrations too; `data-motion='reduce'` renders static.
- **Two signs only, and never swap them (v1 render proved why):** papers/exams speak in the **BUBBLE ROW** (four circles, third = solid gold); people speak in the **PERSON GLYPH** (circle head + one open shoulder arc, no features; third head = gold disc). A card stack with rule lines reads as "forms/database", never as students — any motif *about people* must contain person glyphs.
- **Motifs, one per state — the delivered set, in panel order:**
  - `students` — crowd of four person glyphs on an iso ground plane; third head is the gold disc; one open contour sweep behind, never a closed ring.
  - `questions` — open index-card box, three cards rising; front card carries the bubble row (third gold) plus two outline rule lines.
  - `exams` (active exams) — floating answer sheet with a digit-less outline clock, bubble row (third gold), open contour sweep under the desk plane.
  - `grading` — inbox tray with a ruled sheet inside, line-only pen lying beside it, gold stamp disc on the sheet.
  - `scheduled` — upright 3×3 calendar pane, gold center day, open sweep passing behind.
  - `classes` — ONE contained upright pane with a corner tab holding a row of four person glyphs (third head gold): contained group vs. the students crowd — that contrast is what keeps the two people-motifs apart.
- **Delivered asset set (ready to ship):** `empty-art/light/*.png` + `empty-art/dark/*.png` — the six motifs as transparent RGBA squares, pre-themed in pairs (light: plum `#221E4A` strokes / gold `#F5B301`; dark: cream `#F7F1E4` strokes / gold `#F8C542` / plum wash `#322F47`). Contact sheet: `empty-art/preview.png`; the keying/recolor pipeline that made them: `empty-art/process.py` (coverage-fit matte — re-run it if you regen any motif). Two ways to ship: (a) serve the pair and pick by theme attribute — no runtime theming needed; or (b) hand-trace them into the inline-SVG component above with the PNGs as line reference. Acceptance met: all six lined at 72px, both themes, read as one system.
- **Where:** the two dashboard bottom panels, `Students`, `Questions`, `Classes`, `Exams`, the `ExamResults` list, the notifications dropdown. **Not** the stat cards — those keep the designed zero from 1E; art inside a 132px card is noise.
- **Filled-state crest — the art lives in the panel permanently, not only when it's empty:** the panel body becomes a two-column grid: content column + a fixed crest rail at the **inline-end edge** — under `dir=rtl` that is the physical **left**, exactly the fixed left slot you asked for. Anchor it by DOM order / logical properties, never a physical `left:`, so it mirrors correctly if an LTR locale ever exists. Rail = **136px** (112px art + 12px padding each side), art vertically centered, and the rail sits **outside any scroll container** — rows scroll, the crest stays put. Same slot and same size in both states: the empty↔filled swap changes only the content column (message + CTA ↔ one-liner rows) and the crest's opacity — zero layout shift, and the motif becomes the panel's permanent identity instead of an apology for "nothing here". Presence tiers: empty = `1.0`, filled = `0.60` light / `0.75` dark via a `--panel-crest-dim` token; 160ms opacity transition, skipped under reduced motion. Layout mock: `empty-art/panel-mock.png`. Stat cards stay crest-free (1E) — a 132px card has no room for a rail.
- **Wire into the library:** two hosts. (1) Panels: a `PanelCrest` wrapper renders the rail + content-column grid and owns the opacity tier; both the row list and the empty message render into the content column. (2) Everything else: `EmptyState` (`UIComponents.tsx:876-910`) gains an optional `art?: React.ReactNode` rendered above the title for page-level empty states; `compact` stays icon-only. One prop, every empty state upgrades at once.

## 1L · Verify like you mean it

- [ ] `node tools/visual-shot.mjs` (yours) or `tools/shot-audit.mjs` (mine, works on your machine) at **1440 / 1024 / 768 / 375 × light + dark**, dashboard + `/dev/fixtures`.
- [ ] Compare before/after against exactly five questions:
  1. Do panels separate from the page at arm's length, in light?
  2. Are contours visible in the gutters *and* near the edges?
  3. Does the primary CTA win its row in both themes?
  4. Do quick actions read as buttons at rest in light?
  5. With the menu open over the hero, can you read the menu without seeing the h1 through it?
- [ ] Re-run `npm run gate` — every Round-1 item is token/CSS-level, so all seven checks must stay green. If `check:glass` complains about a fill change, that's the gate doing its job: adjust within the range given, don't delete the check.

**Round 1 is ~a day of token tuning and zero architecture changes.** It moves the light screenshot from "washed out" to "warm and confident."

---

# ROUND 2 — Measured accessibility (the F-series that gates can't see)

- [ ] **F-1 Focus ring (2 lines).** `index.css:141` → light: `--color-focus-ring: #343242;` · add to dark block: `--color-focus-ring: rgba(245,179,1,0.9);`. Gold-on-cream measures **1.43:1** (WCAG 2.2 SC 2.4.11 needs 3:1); your `Button` already uses accent at 10.88:1 — make everything else match.
- [ ] **F-4 Wire form errors to AT (~15 lines).** `UIComponents.tsx` `Input`/`Textarea`/`Dropdown`: add `id` to the error/helper `<p>`, set `aria-invalid={error ? true : undefined}` + `aria-describedby` + `aria-required` on the control. Zero `aria-invalid` exists today, and `index.css:1417-1420` already styles `[aria-invalid='true']` — dead CSS waiting for its half.
- [ ] **F-8 Write `tools/check-contrast.mjs` (~60 lines) and add to `npm run gate`.** Assert in both themes: each semantic text ≥4.5:1 on its `-soft` fill; `text-on-solid` ≥4.5:1 on every `-solid`; primary/secondary/tertiary ≥4.5:1 on page-bg and surface; focus ring ≥3:1. It fails today on F-1 and F-2 — that's the point.
- [ ] **F-2 Tertiary policy.** Forbid `--color-text-tertiary` below 14px (add to a gate), migrate the **179** micro/caption+tertiary sites to `text-secondary` (5.83:1). Keep tertiary for ≥14px metadata + non-text (3:1 is correct there). Don't just darken it — `#6e6b7b` passes but lands 7 lightness points from secondary, breaking your own F5 "never one accidental value" rule.
- [ ] **F-3 One press physics.** `.btn-glass:active` (`:1724`) beats the global `:where(button):active { scale(0.98) }` (`:1406`) by specificity, so library buttons sink and raw buttons scale. Pick the sink (it's better), delete the global rule, and fix the comment at `:1401-1405` which currently claims the opposite.
- [ ] **F-5 Type.** `text-micro` `font-weight: 650` → `600` (`:1064`, 650 isn't a Vazirmatn instance — fallbacks snap to 700). Reconcile `text-display`'s hardcoded `800` (`:1027`) with the `@theme` 700 clamp (`:30-31`) via a `--font-weight-display` token. Differentiate `caption`/`label`: make caption `13px/500`, label `14px/600` — today they're 1px apart at identical weight, i.e. one role with two names.
- [ ] **F-9 Component a11y, each <10 lines.** `Toggle`: drop `aria-label`, add `aria-labelledby` to the visible span (currently announced twice). `Tabs`: add `aria-controls` + `role="tabpanel"`/`aria-labelledby`. `Dropdown`: scroll selected option into view on open; `aria-labelledby={dropdownId}` instead of `aria-label`. `Modal`: lock body scroll while open. `Table`: `scope="col"` on `<th>`. `ConfirmDialog`: stop rendering the title twice. `Toast`: clear the inner 300ms timeout.
- [ ] Delete `focus:outline-hidden` from `Input`/`Textarea`/`Dropdown` (`:296`, `:806`, `:377`). It only works today because the global rule out-specifies it — a specificity accident, not a design.

---

# ROUND 3 — System & gates

- [ ] **F-6 Ratchet down.** `tools/check-library-adoption.mjs:51` `button: 140` → **130**; migrate `Login.tsx:156/218/317/399` (four raw submit buttons; `:402` is a fifth button style that exists nowhere else). Replace `Students.tsx:691-700`'s hand-rolled status pill with your own `StatusBadge`. Add `Pagination`, `Checkbox`, `Radio` to the library (Pagination is hand-rolled twice already), then drop the input baseline.
- [ ] **F-7 CSS hygiene.** Split `index.css` (1,852 lines) into `tokens/base/material/components/pages` via `@import`. Merge the duplicate `.btn-glass--bare:hover` blocks (`:1770` 12% vs `:1796` 8% — the first is dead). Collapse `.dashboard-hero-actions` (defined 3×). Delete the 43 unreferenced tokens your own `check:tokens` lists; flip that advisory to a failure for *new* tokens.
- [ ] **F-10 Small stuff.** `overflow-wrap: anywhere` → `break-word` (`:1433`, `anywhere` changes intrinsic min-content sizing). Use native `min-h-dvh` and delete the `.min-h-screen` override (`:1424`). Add a `--z-*` scale to `@theme` and kill the `z-[60]`/`z-[100]`/`zIndex: 9999` escalations. Add `--color-gold-ink: #765500` (already defined at `:145` for login) as the light-theme gold-*as-content* token — `Settings.tsx:359` uses raw gold as an icon colour at **1.83:1**.
- [ ] **Gate tightening.** `check-bundle.mjs`: gzip sizes, entry ~180 kB / chunk ~250 kB (exempt lazy `vendor-import`), plus assertions "no `FixtureGallery`/`TopbarHarness` chunk in dist" and "no `playground/` or `*-probe*` in dist".
- [ ] **P2-1 Rewrite `AGENTS.md`** — it claims lint==typecheck, no ESLint/Prettier, a `src/mock/` layer and runtime modes that don't exist. It's the first file agents and contributors read.
- [ ] **P2-2** Trim `glassMaterial.test.ts` (673 lines of regex-over-source) to the invariants that matter; delete `runtimeMode.test.ts` (tests a stub that returns `true`).

---

# ROUND 4 — Product (the P-series; this is what moves the *site* score)

- [ ] **P0-1 Exam link.** Delete `randCode`/`gradeLetter`/`generatedLink` (`ExamSettings.tsx:323-333`); read `examCode` back off the hydrated exam the server already returns; stop persisting `settings.examLink`. Add the e2e spec: publish → open link → student joins → submits → teacher grades. **This one test covers P0-1, P0-3 and P0-4.**
- [ ] **P0-2 Remove `triggerAiAssistedGrading`** (`ExamResults.tsx:255-303`) and its button until a real `/api/teacher/ai-grade` exists. `Math.random()` grades on real students is ship-blocking.
- [ ] **P0-3 Clock.** `ExamSettings.tsx:339` `new Date('2026-06-13…')` → `Date.now()`; defaults at `:51-54` → today; evaluate scheduling server-side at request time, not as a stored status; use `Asia/Tehran` explicitly instead of the decorative `_timezone` label.
- [ ] **P0-4 Excel.** Produce a real XLSX (`xlsx` is already a dep, already lazy-loaded) or relabel the button CSV and delete the ExcelJS toast.
- [ ] **P1-1 Fabrication sweep.** Delete the index-derived enrichment in `Questions.tsx:74-95` and `Students.tsx:64-71`. Render «—» for absent fields; drop the filters until the columns exist for real.
- [ ] **P1-2** `if (import.meta.env.DEV && currentPath.startsWith('/dev/'))` in `App.tsx:274` — the comment claims it's compiled out; it isn't.
- [ ] **P1-3** Move 472 kB of orphaned `public/` cruft (playground, probes, tuners, superseded PNGs) out of the deploy.
- [ ] **P1-9** CSV: export `maskedNationalId`, escape quotes, guard formula injection (`student-rows.ts:271`).
- [ ] **P1-4/P1-5** Scope submissions per exam + `AbortController` in `loadCollection`; bulk-create endpoint for student import (currently N sequential POSTs).
- [ ] **P1-6** `useReducer` for `ExamSettings` (28 useState → ~3 state slices); extract `features/question-bank/` from `Questions.tsx`.

---

# ROUND 5 — Art round 2: from a motif set to one hand

Full spec: `Azmoonsaz-ART-MASTERPLAN.md` (the complete plan — verbatim round-2 prompts, copy-paste components/CSS, gates, cadence; also shipped as `azmoonsaz-art-kit.zip` with all assets + pipeline), strategy chapter in `Azmoonsaz-ART-ROUND2.md`. The short version:

- [ ] **Shipped already (art side):** stroke-weight normalization (raw renders measured 92% optical-weight spread; now 14%, gate ≤15%) + edge-dissolve on open sweeps — both in `empty-art/process.py`, gate in `empty-art/measure.py`. Re-run both after any regen.
- [ ] **P0 — glyph cuts become the icon set:** six 48px native renders of each motif's signature element (bubble row / person duo / clock / stamp+pen / calendar cells / tabbed-pane corner) replace lucide in nav, quick-actions, dropdowns, panel headers. One hand draws everything; add an eslint `no-restricted-imports` on lucide so the set can only shrink.
- [ ] **P0 — the absence family:** error/404/expired/import-failed art using the inverted gold rule — the gold slot present but outline-only, zero fills in frame. Errors said in the brand's own grammar.
- [ ] **P0 — success seal** (stamp disc + rising sweep, 96px) for toasts; **P1 — bubble-row loader** (the one sanctioned loop), **auth hero** triad, second-surface empties; **P2 — print masthead, favicon/PWA from the questions cut.**
- [ ] **Master-craft moves M1–M7** (gold grammar in token comments, sweep as page-title wayfinding, isometric side-wall physics on buttons, night-lamp dark tuning, optical centering, art gate in `tools/`) — see the doc; these are what turn "app with pictures" into "one authored hand".

---

# Suggested cadence

| Round | Effort | Score movement |
|---|---|---|
| 1 — give it life | ~1.5-2 days (the art is the half-day) | light theme parity; first impression fixed |
| 2 — measured a11y | ~2 days | 4/10 → 8.5/10 on the accessibility dimension |
| 3 — system & gates | ~2-3 days | stops regression; makes the ratchet bite |
| 4 — product | ~3-4 days | **5.8 → 8.6 overall**; "impressive" becomes "authored" |

Round 1 first, exactly as you said. Screenshot the same three screens before and after — dashboard light, dashboard dark, menu-open light — and diff them. If the light one still reads quieter than dark after 1A+1B, push `line_a` to 0.20 and `glass-light-fill` to 0.55 and re-shoot; those two are the volume knobs.
