# AZMOONSAZ — ART ROUND 2 · from a motif set to one hand

*Companion to `Azmoonsaz-ROUND1-WORKLIST.md` (Round 5) and `Azmoonsaz-EMPTY-ART-PROMPTS.md` (grammar v2). Assumes Round 1 shipped: plate re-tuned, glass tokens, crest rail in the six panels, designed zeros, traffic-light grading tile.*

The first round proved the vocabulary: six motifs, two signs (bubble row / person glyph), one gold fill, 30° line-only isometric. Round 2 is about **grammar** — the rules that make every *future* mark, icon, divider and button belong to the same hand. Pictures are vocabulary; grammar is what makes a masterpiece instead of a decorated panel.

---

## 0 · Fixes shipped to the existing six (no regens, evidence-first)

### 0.1 Optical stroke-weight normalization — the fix the acceptance row missed

The 72px contact-sheet row passed, but a measurement of stroke/canvas ratio showed the set was **not** one weight family: at equal slot size, 02/04 rendered strokes ~1.9× heavier than 05. In the fixed crest rail — side by side, every day — that reads as two different illustrators.

| asset | raw ratio (e-3) | after (e-3) |
|---|---|---|
| 01 students | 10.80 | 12.32 |
| 02 questions | 16.67 | 13.02 |
| 03 active-exams | 9.43 | 12.49 |
| 04 grading | 16.00 | 12.50 |
| 05 scheduled | 8.70 | 11.76 |
| 06 classes | 11.46 | 11.46 |

Spread **92% → 14%** (gate: ≤15%). Method: exact Euclidean morphology on the keyed alpha mask (`scipy.ndimage.distance_transform_edt`, float radius per asset in `process.py::STROKE_DELTA`), then σ=0.7 re-fringe. Two traps recorded so nobody re-learns them: square-window filters (PIL Max/MinFilter) over-correct the 30° diagonals by cos+sin ≈ 1.37; and EDT radii are quantized to integer distance rings (r=2.0 strips one ring, r=2.2 strips two) — tune in 0.2 steps against `measure.py`, never by eye.

**Gate:** `python3 empty-art/process.py && python3 empty-art/measure.py` after *any* regen or new motif. A new asset gets its own `STROKE_DELTA` entry from a fresh measurement before it may join the sheet.

### 0.2 Edge-dissolve on open sweeps

03/05 (and 01's left tip) had contour curves hard-capped at the canvas edge — inside the rail that cap reads as a cut wire. `process.py` now multiplies alpha by a smoothstep ramp over the outer 6% of each edge: the tip dissolves, so the curve reads as "continues past the view". This is also what lets a sweep safely bleed under a panel edge later (M3).

### 0.3 What the pipeline already guarantees (re-stating, so round 2 inherits it)

Keyed transparency with coverage-fit alpha; flat brand-exact colors (light `#221E4A`/`#F5B301`/`#EFEFEB`, dark `#F7F1E4`/`#F8C542`/`#322F47`) — generator hue drift never survives; dark is a recolor of the same matte, never a second generation.

---

## 1 · Fixes that need a regen (your call — prompt deltas included)

- **R1 · 06-classes glyph scale.** The person row is ~60% the head-size of 01's crowd; at ≤72px the people read as specks next to 01's legible crowd, and the *students-vs-classes* contrast weakens. Delta to the 06 prompt: *"the row of person glyphs occupies at least 55% of the pane width; heads are the same diameter as the heads in the students crowd motif."* Accept when, in the 72px row, 06's people are as legible as 01's.
- **R2 · 01-students sweep path.** The contour sweep crosses the head band; at rail size it reads as a stray diagonal through faces. Delta: *"the open contour sweep passes behind the ground plane, below the crowd; it never crosses the head band."*
- **R3 · do NOT fix:** the notch rhyme between 02's box front and 04's tray front (same handle-cut shape). That repetition is a family tie — the kind of decision that looks accidental and is actually authorship.

After any regen: `process.py` (new `STROKE_DELTA` from measurement) → `measure.py` → re-shoot `preview.png` → 72px row by eye.

---

## 2 · Round-2 pictures — where art earns its keep next

### P0-1 · Glyph cuts: the motif set becomes the icon set *(the single biggest lever in this document)*

Today the app's chrome speaks lucide-react and its panels speak the Mark — two hands in one UI. Round 2's headline move: **six 48px native renders**, each one motif's signature element alone, in the same STYLE BLOCK:

| cut | element | replaces lucide in |
|---|---|---|
| questions | the four-bubble row (gold 3rd) | question-bank nav, panel header |
| students | person duo (gold 2nd of 2? **no** — cuts keep gold only where the parent motif's gold lands in frame; duo = outline+gold head) | students nav/header |
| exams | the digit-less clock | exams nav, active-exam chip |
| grading | stamp disc + pen tip at 45° | grading tile, results header |
| scheduled | 2×2 calendar cells, gold in one | schedule nav, date pickers |
| classes | tabbed-pane corner with one person head | classes nav/header |

**Not crops.** A 1254px motif downscaled to 48px is 0.6px stroke mush; cuts are generated natively at icon composition (`stroke = 12% of canvas` becomes `stroke = 14%` at cut scale — small sizes need +2% weight, same rule as print type). Ship as the same light/dark keyed pairs; slot 20/24/28px via one `<Cut kind size>` component.
Migration order: nav → quick-actions → dropdowns → panel headers. Add `eslint no-restricted-imports` on `lucide-react` with the migrated surfaces removed from the allow-list one PR at a time, so the set can only shrink. Surfaces without a cut yet (settings, download, close…) keep lucide until a cut exists — **never** invent a one-off glyph outside the grammar.

### P0-2 · The absence family: errors spoken in the brand grammar

The gold rule inverts: **the gold slot is present but outline-only; zero fills in frame.** "The one answered bubble is missing" is exactly what an error is, said in this language. Four pieces, same STYLE BLOCK plus: *"no filled shapes anywhere; the third bubble is an outline circle in the gold hue #F5B301 at stroke weight, the only gold in frame."*

1. **404 / not-found** — answer sheet, bubble row, gold slot empty outline; the open sweep **breaks** mid-curve (the only place a broken contour is allowed).
2. **session-expired** — the clock, hands outline-only, one hand detached and floating a stroke-width away.
3. **import-failed** — the card box, one card fallen flat outside the box, bubble row with empty gold slot.
4. **no-results (search/filter)** — the bubble row alone, four outlines, gold slot empty, no container.

Where: route 404, auth/session-expired interstitial, student-import failure state, empty search/filter results in `Students`/`Questions`. Pair each with the existing title/description; the art carries tone, the words carry meaning.

### P0-3 · Success seal — the only art allowed inside a toast

The grading stamp disc + a **rising** open sweep (up-curve, vs. the neutral horizontal elsewhere), 96px, one gold. Fires on: exam published, grading saved, import completed, schedule set. Entrance: single 240ms draw-in of the sweep; no loop; reduced-motion static. One seal for all successes — a family of success illustrations would dilute it.

### P1-1 · The bubble-row loader (the one sanctioned loop)

Four outline bubbles; the gold fill cycles 1→2→3→4 at ~180ms/step. It is a progress indicator, so it loops — the single documented exception to the pulse-discipline rule, written into `index.css` next to the iteration-cap so the exception is visible, not smuggled. Reduced-motion: static third-gold (which is also the brand's resting state). Replaces every spinner, including Supabase-wait states.

### P1-2 · Auth hero — the first impression is currently a bare form

480–640px triad: answer sheet + clock + calendar in one overlapping iso cluster, one gold (the exam-day bubble on the sheet), one open sweep under the cluster. Sits in `login-shell` beside the form at ≥1024px, hidden below. This is the piece people screenshot; give it one extra iteration beyond the others.

### P1-3 · Second-surface empties

Notifications dropdown (bell cut + absence rule), trash/archive empty (card box, lid closed, no gold), teacher-without-class onboarding (classes pane, person row outline-only — absence rule again: *no students yet* is an absence, not an error — same grammar, different words).

### P2 · Outside the app, same hand

- **Print/PDF exam masthead:** line band with the bubble row + exam-day gold + sweep; the paper students hold should be recognizably from the same world as the screen they joined from.
- **Favicon / PWA splash:** the questions cut on plum `#221E4A`, gold intact; splash = seal centered, nothing else.
- **Role pair** (teacher/student) only if the role switcher ships: person glyph vs. person glyph + stamp disc. Do not pre-draw product that doesn't exist.

---

## 3 · Master-craft moves — language beyond the pictures

**M1 · One-hand policy.** (P0-1 above.) The icon migration is the move; the eslint ratchet is what makes it permanent.

**M2 · Gold grammar, written into the token file as comments:** fill = *presence / success / now*; outline-only gold slot = *absence / error / waiting*; gold as text = *never* (F-1 stands: `--color-gold-ink #765500`). Three states of one idea. When someone asks "can this badge be gold?", the comment answers before you do.

**M3 · Sweep as wayfinding.** Page titles get one open sweep underline (ink at 0.20 light / cream at 0.24 dark), drawn once per route change, 240ms, reduced-motion static. It replaces hairline dividers **in hero moments only** (page header, auth, empty states) — hairlines stay inside dense tables. Never more than one sweep per screen; never a closed ring. The 0.20/0.24 opacities sit below the menu-bleed ghost threshold from 1H, so a sweep never competes with an open menu.

**M4 · Isometric physics for controls.** Primary CTA and quick-actions grow a 3–4px side wall in the wash color on hover — the motif's wash plane, same 30° — and press collapses the wall + 1px translate. Controls and pictures then share one physics: *objects in this world have thickness; pressing puts the thickness under your finger.* Implement as a pseudo-element parallelogram, not a shadow (shadows are banned in the art grammar; this is geometry, not glow). Reduced-motion: instant state swap, no travel.

**M5 · Night-lamp dark.** Tune the existing gold bloom pool under the focused/active panel (pool `0.15→0.18`, bloom radius −10%) so dark reads as *a desk lamp over paper at exam night* — and the motif wash planes read as lamp-lit sides. One narrative sentence in the theme block: tokens with a story get respected; tokens with only numbers get drifted.

**M6 · Optical, not mathematical.** Crest art sits 2% above true vertical center (math-center reads low); bubble rows in cuts align to the optical center of their text block; the seal's sweep starts at the title's cap-height, not the box edge. These are 2–4px values that no token can carry — put them in one `optical.css` with comments, so they're adjusted in one place during the next visual pass.

**M7 · The art gate lives in the repo.** Copy `empty-art/measure.py` + a sheet renderer into `tools/art-gate/`; wire to `npm run gate` (or a pre-merge check): any change under `src/assets/art/` re-renders `preview.png` and fails CI on spread >15% or a missing theme pair. The diffed contact sheet becomes the review artifact — art review stops being taste-argument and starts being a red/green line, like contrast.

---

## 4 · Cadence & acceptance

| step | effort |
|---|---|
| 0 · normalization + taper (shipped) | done |
| 1 · regen candidates R1–R2 (optional, 2 gens) | ~0.5 d |
| 2 · glyph cuts (6 gens + sheet + measure) | ~0.5 d |
| 3 · absence family (4 gens) | ~0.5 d |
| 4 · seal + loader | ~0.5 d |
| 5 · auth hero (extra iteration) | ~1 d |
| 6 · M3 + M4 + M6 (CSS) | ~1 d |
| 7 · M1 icon migration, per surface | ~0.5 d each |

**Round acceptance, all of it:** contact sheets at 48 / 72 / 112 / 160 read as one hand; `measure.py` spread ≤15%; every asset exactly one gold fill — absence family exactly zero; no new lucide import outside the allow-list; every new element static under `data-motion='reduce'`; and the five-question before/after screenshot diff from Round 1 still passes with the art in place.

---

*The test of all of this, in one sentence: a new engineer adding a surface next year should be able to ask "what does this state look like?" and answer it themselves from the grammar — gold present, gold absent, sweep rising or broken — without ever needing to ask you. That is the difference between an app with pictures and a crafted one.*
