# AZMOONSAZ · ART MASTER PLAN — Round 2 and the one-hand policy

*The full plan: what shipped, what to fix, every round-2 asset with its verbatim generation prompt, every component/CSS/gate needed to implement it, and the grammar that keeps future surfaces on the same hand. Companion docs: `Azmoonsaz-ART-ROUND2.md` (strategy), `Azmoonsaz-EMPTY-ART-PROMPTS.md` (grammar v2 + verified set), `Azmoonsaz-ROUND1-WORKLIST.md` (Rounds 1–5).*

**Premise.** Round 1 proved the vocabulary: six motifs, two signs (BUBBLE ROW for papers, PERSON GLYPH for people), exactly one gold fill, 30° line-only isometric, plum/cream/gold palette, transparent RGBA pairs for both themes. Round 2 turns vocabulary into **grammar** — rules that let any future surface derive its own art — and spends the vocabulary where it earns most: the icon set, the error states, and the controls themselves.

---

## PART A · Where the art stands today (shipped, measured, gated)

### A.1 The set
Six motifs, panel order: `01 students · 02 questions · 03 active-exams · 04 grading · 05 scheduled · 06 classes`. Each exists as:
- `src/*-white.png` — raw generation on solid white (01/04/05 take-1; 02/03/06 take-2),
- `light/*.png` + `dark/*.png` — shippable transparent RGBA squares, keyed and recolored,
- `preview.png` — contact sheet (light row, dark row, both at 72px),
- `panel-mock.png` — the filled/empty × light/dark crest-rail layout mock.

### A.2 The pipeline (`process.py`) and what it guarantees
1. **Coverage-fit matte:** every pixel solved as `C = a·S + (1−a)·bg` against the three brand inks; coverage `a` becomes alpha → anti-aliased fringes, no key halo. Background (corner-sampled) → fully transparent.
2. **Interior snap:** ink/gold cores with `a > 0.7` → 1.0 (kills generator fill mottle); wash gradients and fringes preserved.
3. **Stroke-weight normalization:** exact Euclidean morphology on the alpha mask, per-asset float radius (`STROKE_DELTA`), σ=0.7 re-fringe. Raw renders measured **92% optical-weight spread**; shipped set measures **14%**.
4. **Edge dissolve:** alpha × smoothstep ramp over the outer 6% of each edge — open-sweep tips dissolve instead of hard-capping.
5. **Square trim + 5% margin**, then flat recolor: light `#221E4A / #F5B301 / #EFEFEB`, dark `#F7F1E4 / #F8C542 / #322F47`. Dark is a recolor of the same matte — **never a second generation** (hue drift and composition drift both die here).

### A.3 The gates
- `python3 process.py` → re-keys/recolors/re-sheets after any regen.
- `python3 measure.py` → stroke-weight table; **spread ≤ 15% or the asset does not ship**. New asset ⇒ new `STROKE_DELTA` entry from a fresh measurement first.
- `python3 sheet.py` → contact sheet at **48 / 72 / 112 / 160 px × both themes**; the eye gate: every row reads as one hand.
- Traps recorded so nobody re-learns them: PIL Max/MinFilter over-correct 30° diagonals by cos+sin≈1.37 (use EDT); EDT radii quantize to integer distance rings (r=2.0 strips one ring, r=2.2 strips two) — tune in 0.2 steps against `measure.py`.

---

## PART B · Fixes

### B.1 Shipped already (no regens)
Stroke normalization (92%→14%) and edge dissolve — both in `process.py`, both re-runnable. Nothing to do.

### B.2 Regen candidates (optional, ~0.5 day, two generations)
- **R1 · 06-classes glyph scale.** Person row ≈60% of 01's head size; at ≤72px the people read as specks and the students-vs-classes contrast weakens. Append to the 06 subject: *"the row of person glyphs occupies at least 55% of the pane width; heads are the same diameter as the heads in the students crowd motif."* Accept when 06's people are as legible as 01's in the 72px row.
- **R2 · 01-students sweep path.** The contour sweep crosses the head band; at rail size it reads as a stray diagonal through faces. Append: *"the open contour sweep passes behind the ground plane, below the crowd; it never crosses the head band."*
- **R3 · DO NOT FIX:** the notch rhyme between 02's box front and 04's tray front (same handle-cut). Repetition that looks accidental and is actually authorship.

After any regen: add/adjust its `STROKE_DELTA` from a fresh measurement → `process.py` → `measure.py` → `sheet.py` → eye the rows.

---

## PART C · Round-2 assets — grammar additions + verbatim prompts

### C.0 STYLE BLOCK (prefix every prompt below with this, verbatim)

> Flat minimal isometric line-art icon illustration, true 30-degree isometric projection, pure clean vector look. Uniform rounded-cap strokes only; stroke thickness everywhere equal to 22% of the diameter of the small circles in the scene. Strokes deep plum ink #221E4A; at most one pale wash plane #EFEFEB on a side or inner wall, never on a top or front face. No gradients, no shadows, no highlights, no textures, no noise, no glow. No text, no letters, no numbers, no punctuation anywhere. Square canvas, single centered object group with 12% margin, generous negative space. Crisp clean edges, one consistent stroke weight, no 3D shading, no perspective other than isometric. Background: solid pure white #FFFFFF, completely flat and empty — no vignette, no halo, no smoke, no soft glow, no drop shadow, no frame, no border.
> GOLD RULE: the image contains exactly one gold element: a flat solid disc #F5B301 with ABSOLUTELY NO outline, no ring, no stroke around it or touching it.

(Generators cannot emit real alpha — white background is asked for on purpose and keyed out by `process.py`. Reject checklist from the prompt pack still applies: no rings on gold, gold third-of-four where a row exists, open sweeps never closed rings, washes on side/inner planes only, people motifs contain person glyphs.)

### C.1 Grammar addition 1 — CUTS (the icon set, P0-1)
A **cut** is one motif's signature element alone, generated natively at icon composition (never cropped from the 1254px parent — a crop at 48px is 0.6px stroke mush). Cut rules:
- stroke = **14% of the small-circle diameter family** (+2% over parent: small sizes need weight, same rule as print type);
- a cut carries exactly one gold: the parent's gold element when it is inside the cut element, keeping its position; where it is not (the clock), the gold becomes a **center "now" dot**;
- minimum count that preserves gold position: rows of four stay four; the person row may reduce to three with gold third.

**CUT-1 questions** — subject: *a single horizontal row of exactly four small answer bubbles floating alone: bubbles 1, 2 and 4 outline only, bubble 3 the flat solid gold disc with no outline. No card, no box, no container, no rule lines. Nothing else in frame.*
**CUT-2 students** — subject: *a row of exactly three small abstract person glyphs — each a line-only circle head above a single open shoulder arc, no facial features — heads 1 and 2 outline only, head 3 the flat solid gold disc with no outline. No container, no ground plane. Nothing else in frame.*
**CUT-3 exams** — subject: *one small outline-only clock: a plain circle with two straight hands and no digits, no ticks; at its exact center a small flat solid gold disc with no outline, the hands starting outside it. Nothing else in frame.*
**CUT-4 grading** — subject: *one flat solid gold disc with no outline, stamped at the tip of a line-only pen lying at 45 degrees, pen outline only, nib a simple open wedge. No tray, no sheet. Nothing else in frame.*
**CUT-5 scheduled** — subject: *a 2×2 grid of four small outline-only rounded squares in isometric plane, the third square in reading order carrying a flat solid gold disc with no outline inside it. No outer calendar frame, no digits. Nothing else in frame.*
**CUT-6 classes** — subject: *the top-left corner of an upright rounded pane with a small corner tab, and inside it a row of exactly three small person glyphs — circle head above one open shoulder arc, no features — heads 1 and 2 outline only, head 3 the flat solid gold disc with no outline. Only the corner: two pane edges meeting at the tabbed corner, no full rectangle. Nothing else in frame.*

Ship as keyed light/dark pairs like the parents; slot at 20/24/28px through one `<Cut kind size>` component (Part D.3). Migration order: nav → quick-actions → dropdowns → panel headers; eslint ratchet in D.7.

### C.2 Grammar addition 2 — THE ABSENCE FAMILY (errors, P0-2)
The gold rule **inverts**: the gold slot is present but **outline-only in the gold hue**, and there are **zero filled shapes in frame**. Absence of the one answered bubble = something went wrong, said in the brand's own grammar. Prefix prompts with the STYLE BLOCK **minus the GOLD RULE**, plus:

> ABSENCE RULE: the image contains NO filled shapes at all. Where the gold disc would sit, draw an outline-only circle in the gold hue #F5B301 at the same stroke weight — the missing answer. Everything else outline only.

**ABS-1 not-found / 404** — subject: *one isometric answer sheet with a horizontal row of four small bubbles — bubbles 1, 2 and 4 outline only in plum, bubble 3 an outline-only circle in the gold hue — and two outline rule lines below; the open contour sweep under the sheet BREAKS mid-curve, a gap of two stroke-widths between its two halves. No fill anywhere.*
**ABS-2 session-expired** — subject: *one outline-only clock, plain circle, no digits; of its two hands, one is detached and floats one stroke-width away from the center, still pointing at its angle; at the center an outline-only circle in the gold hue. No fill anywhere.*
**ABS-3 import-failed** — subject: *an isometric open index-card box with two cards standing inside, and one card fallen flat on the ground plane outside the box; the standing front card carries a row of four small bubbles with the third an outline-only circle in the gold hue. No fill anywhere.*
**ABS-4 no-results (search/filter)** — subject: *a single horizontal row of exactly four small bubbles floating alone: bubbles 1, 2 and 4 outline only in plum, bubble 3 an outline-only circle in the gold hue. No container, no magnifier, no slash, no cross. No fill anywhere.*

Where: route 404; session-expired interstitial; student-import failure; empty search/filter results in `Students`/`Questions`. The art carries tone; the existing Persian title + description carry meaning; `aria-hidden` on the art always.

### C.3 Grammar addition 3 — SEAL & SWEEP DIRECTION (success, P0-3)
Sweeps carry mood by direction: **horizontal = neutral** (parents), **rising = success**, **broken = error** (ABS-1 only). One seal for all successes:

**SEAL** — STYLE BLOCK + subject: *one flat solid gold disc with no outline, stamped; under it a single open contour sweep that RISES from lower-left to upper-right, passing behind the disc and exiting the frame; no sheet, no tray, no pen. Nothing else in frame.*
Use at 96px in toasts: exam published, grading saved, import completed, schedule set. Entrance: one 240ms sweep draw-in; no loop; reduced-motion static.

### C.4 Auth hero (P1-2) — the piece people screenshot
**HERO** — STYLE BLOCK + subject: *one overlapping isometric cluster: an answer sheet in front carrying a row of four small bubbles (third = the flat solid gold disc, no outline) and two rule lines; behind it an upright calendar pane with a 3×3 outline grid; behind that a small outline-only clock with no digits; one open contour sweep passing under the whole cluster, entering and leaving the frame. Exactly one gold in the whole image. Wash plane on at most one side wall of the sheet.*
Render at 480–640px, sits beside the form in `login-shell` at ≥1024px, hidden below. Give this one an extra iteration: it is the first impression.

### C.5 Second-surface empties (P1-3) — no new grammar, reuse
- **Notifications empty:** CUT-1 (bubble row) at 56px + absence variant if the distinction "no notifications yet" vs "notifications failed" is ever needed — until then the parent grammar: empties are neutral, not absent. Title/description carry it.
- **Trash/archive empty:** *an isometric closed card-box lid, outline only, one pale wash plane on its side wall, no cards, no bubbles, NO gold at all* — a closed box is the only zero-gold neutral allowed (it is not an error and not a presence; it is "nothing in here"). Prefix STYLE BLOCK without GOLD RULE and add: *the image contains no gold at all.*
- **Teacher-without-classes onboarding:** CUT-6 composition under the ABSENCE RULE (pane corner + three outline-only heads) — *no students yet* is an absence, same grammar, different words.

### C.6 Not generated — specified (P1-1, P2)
- **Bubble-row loader (the one sanctioned loop).** Inline SVG/CSS, four outline bubbles, gold fill cycles 1→2→3→4 at 180ms/step, `infinite` — the single documented exception to the pulse-discipline iteration cap, written into `index.css` next to the cap so the exception is visible. Reduced-motion / `data-motion='reduce'`: static third-gold (the brand's resting state). Replaces every spinner including Supabase-wait. Implementation in D.4.
- **Favicon / PWA:** CUT-1 on plum `#221E4A`, gold intact; splash = SEAL centered on plum, nothing else. Generate the PNGs from the shipped cut with a 10-line script, don't re-roll art for a favicon.
- **Print/PDF exam masthead:** line band: CUT-1 left of the exam title block, one horizontal sweep under the band, gold = the exam-day bubble. Same assets, new placement; the paper students hold should be recognizably the same world as the screen they joined from.
- **Role pair:** only if the role switcher ships — person glyph (student) vs person glyph + CUT-4 stamp (teacher). Do not pre-draw product that doesn't exist.

---

## PART D · Implementation specs (copy-paste grade)

### D.1 Asset placement
`src/assets/art/{light,dark}/*.png` (the twelve shipped files) + round-2 sets into the same folders as they land. Vite imports give hashing + caching; theme pair chosen at render time (D.2), no runtime theming needed because both colorways are pre-keyed.

### D.2 `PanelCrest` — the fixed rail (Round 1 §1K, filled + empty)
```tsx
// src/components/PanelCrest.tsx
import type { ReactNode } from 'react'
import studentsL from '../assets/art/light/01-students.png'
import studentsD from '../assets/art/dark/01-students.png'
// …same for 02–06
const CRESTS = {
  students:   { light: studentsL, dark: studentsD },
  questions:  { light: questionsL, dark: questionsD },
  exams:      { light: examsL, dark: examsD },
  grading:    { light: gradingL, dark: gradingD },
  scheduled:  { light: scheduledL, dark: scheduledD },
  classes:    { light: classesL, dark: classesD },
} as const
export type CrestKind = keyof typeof CRESTS

export function PanelCrest({ kind, state, children }: {
  kind: CrestKind; state: 'empty' | 'filled'; children: ReactNode
}) {
  const dark = document.documentElement.classList.contains('dark') // your theme hook
  return (
    <div className="panel-crest" data-state={state}>
      <div className="panel-crest__content">{children}</div>
      <div className="panel-crest__rail" aria-hidden="true">
        <img src={CRESTS[kind][dark ? 'dark' : 'light']} alt="" width={112} height={112} />
      </div>
    </div>
  )
}
```
```css
/* grid, not flex: the rail is the SECOND column, so under dir=rtl it renders
   on the physical left automatically — and mirrors correctly if LTR ever lands.
   Never anchor it with a physical `left:`. */
.panel-crest { display: grid; grid-template-columns: minmax(0, 1fr) 136px; column-gap: 8px; }
.panel-crest__rail { display: flex; align-items: center; justify-content: center; }
.panel-crest__rail img {
  width: 112px; height: 112px;
  opacity: var(--crest-op, 1);
  transition: opacity 160ms ease;
  transform: translateY(-2%);            /* M6: optical, not mathematical */
}
.panel-crest[data-state='filled'] { --crest-op: var(--panel-crest-dim); }
:root { --panel-crest-dim: 0.60; }
.dark, [data-theme='dark'] { --panel-crest-dim: 0.75; }   /* match your theme selector */
@media (prefers-reduced-motion: reduce) { .panel-crest__rail img { transition: none; } }
```
Empty↔filled swaps only the content column and `--crest-op` → **zero layout shift** is the acceptance test. Rail lives outside any scroll container: rows scroll, crest stays. If a panel ever grows header + 10 rows + internal scroll, switch that rail to `align-self: start; margin-top: 8px` or drop to CUT size in the header.

### D.3 `Cut` — the icon component
Same shape as `PanelCrest`'s map, sizes 20/24/28, `aria-hidden` always, no per-theme files (pair chosen like above). One component; every lucide site migrates through it.

### D.4 Bubble-row loader
```tsx
export function BubbleLoader({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <span className="bubble-loader" role="status" aria-label={label}>
      {[0, 1, 2, 3].map((i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
    </span>
  )
}
```
```css
.bubble-loader { display: inline-flex; gap: 6px; }
.bubble-loader i {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--color-ink);
  animation: bubble-cycle 720ms steps(1) infinite;
  animation-delay: calc(var(--i) * 180ms);
}
@keyframes bubble-cycle { 0% { background: var(--color-accent); border-color: var(--color-accent); }
                          25%, 100% { background: transparent; } }
/* THE sanctioned loop: this comment is the exception record for the
   iteration-cap rule in index.css — do not copy the pattern elsewhere. */
[data-motion='reduce'] .bubble-loader i,
@media (prefers-reduced-motion: reduce) { .bubble-loader i { animation: none; } }
[data-motion='reduce'] .bubble-loader i:nth-child(3) { background: var(--color-accent); border-color: var(--color-accent); }
```
(write the reduce block as two separate rules; the nested form above is shorthand for the spec)

### D.5 Sweep underline (M3 wayfinding)
One inline SVG per page header, keyed by route so it re-draws on navigation:
```tsx
<SweepUnderline key={location.pathname} />
```
```css
.sweep-underline path {
  stroke: var(--color-ink); opacity: 0.20;            /* dark: cream at 0.24 */
  stroke-dasharray: 100; stroke-dashoffset: 100;
  animation: sweep-draw 240ms ease-out forwards;
}
.dark .sweep-underline path { stroke: var(--color-cream); opacity: 0.24; }
[data-motion='reduce'] .sweep-underline path { animation: none; stroke-dashoffset: 0; }
@keyframes sweep-draw { to { stroke-dashoffset: 0; } }
```
Rules: hero moments only (page header, auth, empty states); hairlines stay inside dense tables; never two sweeps on one screen; never a closed ring; opacities sit below the 1H menu-ghost threshold so a sweep never fights an open menu.

### D.6 Isometric physics for controls (M4)
```css
.btn-glass--primary, .btn-glass--quiet { position: relative; isolation: isolate; }
.btn-glass--primary::after, .btn-glass--quiet::after {
  content: ''; position: absolute; inset: 0; z-index: -1;
  border-radius: inherit; background: var(--color-accent-soft);   /* the wash plane */
  transform: translate(3.5px, 2px);                /* 30°: (cos30, sin30) × 4px */
  opacity: 0; transition: opacity 120ms ease, transform 120ms ease;
}
.btn-glass--primary:hover::after, .btn-glass--quiet:hover::after { opacity: 1; }
.btn-glass--primary:active::after, .btn-glass--quiet:active::after { transform: translate(1px, 0.6px); }
[data-motion='reduce'] .btn-glass--primary::after { transition: none; }
```
Geometry, not shadow: no blur, no spread — the art grammar bans shadows and this must read as thickness. Objects in this world have thickness; pressing puts the thickness under your finger.

### D.7 The eslint ratchet (M1)
```jsonc
// .eslintrc / eslint.config.js
"no-restricted-imports": ["error", {
  "paths": [{
    "name": "lucide-react",
    "message": "Use src/components/Cut.tsx glyph cuts (Art Master Plan P0-1). If no cut exists for this glyph yet, add the cut first — never invent a one-off."
  }]
}]
```
Migrate surface by surface; each migration PR deletes its `// eslint-disable-line no-restricted-imports` from the tracking issue. The set can only shrink.

### D.8 `EmptyState` art prop (page-level empties)
As Round 1 §1K: `EmptyState` (`UIComponents.tsx:876-910`) gains `art?: React.ReactNode` above the title; page-level empties pass the parent motif at 160px (or an absence piece); `compact` stays icon-only; panels use `PanelCrest` instead. `aria-hidden` on all art.

### D.9 `optical.css` (M6)
One file for the 2–4px values no token can carry: crest `translateY(-2%)`, cut vertical alignment to the optical center of their text block, seal sweep start at cap-height. Comment each with *why*; adjust all of them in one place at the next visual pass.

### D.10 Art gate in the repo (M7)
Copy `process.py`, `measure.py`, `sheet.py` to `tools/art-gate/`; add `"gate:art": "python3 tools/art-gate/measure.py && python3 tools/art-gate/sheet.py"` and chain it into `npm run gate`. CI fails on spread >15% or a missing theme pair; the diffed `sheet.png` is the review artifact. Art review stops being a taste argument and becomes a red/green line, like contrast.

---

## PART E · The grammar, on one page (M2 distilled)

1. **Two signs.** BUBBLE ROW = papers/exams. PERSON GLYPH = people. Never swap (the v1 STUDENTS failure).
2. **Gold, three states.** fill = presence/success/now · outline-only gold slot = absence/error/waiting · no gold at all = closed/neutral-empty (the closed box only). Gold as text = never (`--color-gold-ink #765500`, F-1).
3. **One gold per asset**, third of four where a row exists, no ring ever around it.
4. **Sweep direction is mood.** horizontal = neutral · rising = success · broken = error (once, ABS-1).
5. **Washes on side/inner planes only**; shadows nowhere; thickness is geometry (M4).
6. **Stroke ratio 12e-3** at motif scale, **14e-3** at cut scale; `measure.py` ≤15% spread.
7. **Dark is a recolor, never a regen.**
8. **Reduced motion renders everything static**, loader included (static third-gold).

---

## PART F · Cadence, acceptance, manifest

### F.1 Cadence
| step | effort |
|---|---|
| A/B.1 normalization + edge dissolve | **shipped** |
| B.2 regen candidates R1–R2 (2 gens) | ~0.5 d |
| C.1 cuts (6 gens + key + measure + sheet) | ~0.5 d |
| C.2 absence family (4 gens) | ~0.5 d |
| C.3 seal + C.6 loader | ~0.5 d |
| C.4 auth hero (extra iteration) | ~1 d |
| C.5 second surfaces (2 gens + reuse) | ~0.5 d |
| D.2/D.3/D.5/D.6/D.9 CSS+components | ~1 d |
| D.7 icon migration | ~0.5 d per surface |
| D.10 gate wiring | ~0.5 d |

### F.2 Round acceptance (all must hold)
- [ ] `sheet.png` rows at 48/72/112/160 × both themes read as one hand.
- [ ] `measure.py` spread ≤15%; every motif asset exactly one gold fill; absence family exactly zero fills; closed-box exactly zero gold.
- [ ] Zero layout shift on empty↔filled in the six panels (screenshot diff, rail pixel-identical).
- [ ] No new lucide import outside the migration allow-list.
- [ ] Every new element static under `data-motion='reduce'` and `prefers-reduced-motion`.
- [ ] Round-1 five-question before/after diff still passes with art in place.
- [ ] `npm run gate` (now incl. `gate:art`) green.

### F.3 Kit manifest (this zip)
```
azmoonsaz-art-kit/
  README.md                     what this is, quick start
  Azmoonsaz-ART-MASTERPLAN.md   ← you are here (full plan)
  docs/Azmoonsaz-ART-ROUND2.md          strategy chapter
  docs/Azmoonsaz-EMPTY-ART-PROMPTS.md   grammar v2 + verified set + reject checklist
  docs/Azmoonsaz-ROUND1-WORKLIST.md     Rounds 1–5 implementation checklist
  light/  dark/                 the six shipped motifs, transparent RGBA, both themes
  src/                          raw white-bg generations (provenance + re-key source)
  preview.png                   contact sheet (72px acceptance rows)
  sheet.png                     gate sheet: 48/72/112/160 × 2 themes
  panel-mock.png                crest-rail layout mock, filled/empty × light/dark
  process.py  measure.py  sheet.py  mock-panel.py
```
Quick start: drop `light/`+`dark/` into `src/assets/art/`, implement D.2 first (visible win in one evening), then run the C-series generations in priority order, each through `process.py → measure.py → sheet.py` before it joins the set.

---

*The test of the whole plan, one sentence: a new engineer adding a surface next year should be able to ask "what does this state look like?" and answer it themselves from Part E — gold present, gold absent, sweep rising or broken — without ever asking you. That is the difference between an app with pictures and a crafted one.*
