# Operation Meraj — Brand Book (معراج)

The codified design law of آزمون‌ساز. Everything here is already shipped and
traceable to a token or source file; nothing is aspirational unless explicitly
marked **RESERVED** (future phase, do not implement ad-hoc).

Sibling documents: `docs/brand-the-mark.md` (The Mark geometry), `docs/glass-engine.md`
(engine internals), `docs/tone-of-voice.md` (Persian copy), `docs/illustration-system.md` (art).

---

## 1. The Myth — one sentence, one metaphor

**آزمون‌ساز is the digital stationery of Persian education.**

An exam is a *document*. A document deserves *paper*, *ink*, and — when the
answers are in — a *seal*. The glass is *crystal paper*: perfectly transparent,
because honesty between teacher and student is the product.

Four physical elements govern every visual decision:

| Element | Persian | What it is in the product |
|---|---|---|
| **Paper** | کاغذ | Page plates: generated topo-map SVGs (`/backgrounds/bg-d-light.svg`, `bg-d-dark.svg`) — glass always has real content to bend |
| **Ink** | مرکب | `--color-ink` #1a1a2e (light) / #f5f6fa (dark); all strokes and headings |
| **Seal** | مُهر | The gold commitment: The Mark's 3rd circle, the Seal art, the Sealing Ceremony |
| **Light** | نور | Glass optics: refraction, the rim lens, and now the girih wave |

If a design decision can't be stated in these four elements, it probably
doesn't belong in the product.

---

## 2. The Mark (علامت)

Full geometry spec: `docs/brand-the-mark.md` (V2.1). The laws that matter
downstream:

- **Formula**: D = diameter; SPACING = 1.4·D; STROKE = 0.22·D uniform; GOLD is
  always the **3rd of 4** circles and always filled. "Third is gold" is the
  brand's smallest story — it recurs everywhere (see illustration sign systems).
- Shipped ink is `--color-ink` (#1a1a2e light / #f5f6fa dark), not the historical
  plum #221E4A (art-tool palette only).
- `src/components/TheMark.tsx` is the only React rendering; never hand-inline
  Mark SVGs.

---

## 3. Material physics — glass is a layered substance, not a style

The glass system is the app's *law of nature*, single-sourced in
`src/styles/themes.css` (runtime recipe) + `src/styles/tokens.css` (design
tokens). Three engines render the same physics:

1. **CSS + SVG filter chain** — the shipping path (`src/glass/`).
2. **WebGL2 renderer** — the performance path, same maps as textures.
3. **Map worker** — off-main-thread map builds, same math (`mapMath.ts`).

The three material families (see `public/lab/` for live A/B):

| Family | Class | Physics |
|---|---|---|
| **lens** | `.lens` | Refraction at the rim (feDisplacementMap) + specular ring + dim |
| **pane** | `.pane` | Ring only — no displacement; for content that must stay legible |
| **frost** | `.frost` | Blur only — no refraction, no ring |

Non-negotiables:
- The tuned **peak pull** (`--lens-max-displacement`) is a contract. Any
  modulation of the displacement field must be **trough-only** (see girih below)
  so the peak is never exceeded.
- Panels never coat the page: fill must *tint*, never hide (`--glass-p-a1/a2`
  are calibrated; the halo layer is retired by decision).
- Every glass surface sits over a real plate — glass without content to bend
  is a rectangle, not glass.

---

## 4. Girih Optics (گیره) — the signature

The rim's refraction pull is modulated by a **trough-only, fold-fold
rotationally-symmetric wave anchored to each panel's center** — light bends
along Persian geometry. Fold **10** = the Isfahan decagram (the five-and-ten
star of girih tilework).

**The math** (identical in `src/glass/mapMath.ts`, `public/lab/maps.js`, and
`tools/gen-glass-maps.py` — three implementations, one law):

```
val *= 1 - amp * (1 - cos(fold * theta)) * 0.5
theta = atan2(y - cy, x - cx)   // measured from the PANEL center,
                                // so the star rescales with the panel
```

**Laws:**
1. **Trough-only.** The wave only *relaxes* pull toward wave nodes and keeps
   the full approved peak at crests. amp 0 must produce a byte-identical
   pre-Meraj field. This keeps `--lens-max-displacement` exact.
2. **Center-anchored.** θ comes from the panel center, so the decagram is
   nailed to the surface — resize the panel and the star rescales with it.
3. **Theme-independent physics.** `--lens-girih` / `--lens-girih-fold` live in
   `tokens.css` with the design tokens and are consumed via
   `glassTokens.readParams` — they are *not* theme blocks.
4. **Three-way parity.** Any change to the wave must land simultaneously in
   mapMath.ts, the lab port, and the Python raster generator, and the rasters
   must be regenerated (`tools/gen-glass-maps.py`).

**Shipped values:** `--lens-girih: 0.22` (brand amplitude ≈ 28/127 raw
modulation — visible, elegant, never a gimmick), `--lens-girih-fold: 10`.

**Verified** (2026-10-25, headless WebGL + raw-field extraction): measured
trough depth vs the analytic decagram = **corr 0.993, exactly 10 lobes, all at
fold·θ = π ± 0.07**; trough-only holds at amp 0.22 and 0.5. Record:
`download/meraj-visual-check/11-girih-decagram-verification.png`.

**Live A/B:** `/lab/` — the گیره slider (0 / 0.22 / 0.5) and پره‌ها (6/8/10/12).

**Seasonal girih (P3, shipped — `src/glass/seasonalGirih.ts`):** the fold
follows the Persian calendar — spring/autumn 10 (the decagram), summer 8,
winter 12 — set on `:root` before the engines boot. The amplitude NEVER moves
(0.22 is the brand constant). Fold 10 = no inline override at all, so token
retunes always win. Do NOT hardcode folds per page.

---

## 5. Color — ink, silver, gold

Shipped system (single source: `tokens.css` @theme + `themes.css` dark block):

| Role | Light | Dark | Notes |
|---|---|---|---|
| Page (paper) | `#f2efe8` | `#131220` | The plate's own base color; swap is invisible |
| Surface | `#fffdfa` | `#252334` | One depth step: `--color-surface-secondary` |
| Ink | `#1a1a2e` | `#f5f6fa` | Strokes, headings, The Mark |
| Gold | `#f5b301` | `#f8c542` | **Commitment color only** — answers, seals, focus (dark), the 3rd circle |
| Gold as content | `#765500` | `#f8c542` | Bright gold fails on cream (1.8:1); gold-ink is the text-safe twin |
| Focus | `#343242` | gold | Light uses ink (contrast); dark keeps gold (5.64:1) |

Laws:
- **Gold is never decoration.** If gold is on screen, something is being
  promised, answered, or sealed. Two golds on one screen need a reason.
- Status colors carry both a text channel and a solid channel (`--color-*` /
  `--color-*-solid`); never mix them.
- The muted-label tier (`--color-text-label-muted`, 4.53:1 light) is for
  required reading; the hint tier (`--color-text-tertiary`, 3.09:1) is
  decorative only. Never swap.

**RESERVED (P3):** lantern night theme (حالت شب امتحان — warm 2200K shift for
evening exams) and seasonal plates. Both must ship as theme blocks, not
per-page overrides.

---

## 6. Typography — the voice's handwriting

Single source: `tokens.css` (ramp) + `typography.css` (utilities) + `fonts.css`
(Vazirmatn, variable 300–900, arabic + latin subsets).

- **Scale**: display 2.25rem/800 → heading-1 1.75rem/700 → heading-2 1.25rem/700
  → heading-3 1.125rem/700 → body 1rem/400 (lh 1.65) → label .875rem/700 →
  caption .8125rem/600 → micro .75rem/700.
- **Weights clamp at 700 in UI sizes.** Vazirmatn goes muddy at 800–900 below
  display sizes; `--font-weight-extrabold/black` are pinned to 700 and only
  `--font-weight-display` earns 800. Retune every heading by editing three lines.
- **No negative letter-spacing.** Persian is cursive — tightened tracking cramps
  the letter joins. `text-display` documents this in place.
- **Every semantic utility owns its weight.** Same-weight call-site overrides
  fail `npm run check:typography`.
- **Persian digits** everywhere numbers face users: `toPersianDigits`
  (`src/utils/persian.ts`) / `toLocaleString('fa')`. Latin digits are machine
  surfaces (IDs, query params, code) only.
- **RESERVED**: kashida (کشیده) print-grade justification for long-form
  documents; Nastaliq for decorative display only (≤3 words, never UI-critical
  text). Neither is shipped — do not fake kashida with letter-spacing.

---

## 7. Motion grammar — the physics of time

Single source: `tokens.css` `:root` block.

```css
--dur-instant: 120ms;  /* hover/focus/press feedback — a ceiling, not a suggestion */
--dur-flow: 240ms;     /* reveals, collapses, panel transitions */
--ease-seal:  cubic-bezier(0.2, 0.9, 0.25, 1.04);  /* the brand curve: stamp-and-settle */
--ease-glass: cubic-bezier(0.33, 0, 0.2, 1);       /* engine-native, no overshoot */
--ease-exit:  cubic-bezier(0.55, 0, 0.85, 0.6);    /* things leaving: accelerate away */
```

**Pulse discipline** (the deepest rule in the app): *nothing loops*.
- Skeletons sweep **once** (1.2s, right→left — the RTL reading direction) and
  rest as a static wash.
- The Seal draws in **once** (240ms sweep) and is static forever — a stamp
  lands once for the moment it marks.
- Illustrations are static by design; there is nothing for reduced-motion to
  quiet.
- `:root[data-motion='reduce']` + the media query both park every animation;
  `MotionContext` resolves before first paint.

**The Sealing Ceremony** (`SealCeremony.tsx` + `sealBeats.ts`) — the exam-submit
moment as a rite, not a spinner:

| Beat | t (ms) | What happens |
|---|---|---|
| fold | 0 | The paper folds closed |
| wax | 640 | Wax rises |
| stamp | 1080 | The crest stamps; thump + haptic fire at +40ms (wax-contact frame) |
| settle | +300 | Hold, then 320ms fade; overlay removes itself |

Contract: one-shot ~1.9s total; **never blocks submission** (the server has
already accepted when it plays); reduced motion → the overlay never mounts, the
terminal card alone carries the moment, zero timers; `role="status"` +
`aria-live="polite"` so screen readers get the outcome, not the choreography.
The beat table in `sealBeats.ts` is the ONE table the JS timeline and the CSS
keyframes both honor — never re-time in CSS alone.

**Grade reveal** (`ScoreOdometer.tsx`): the score as Persian-digit odometer —
each digit a ۰..۹ strip rolling with `--ease-seal` under `--dur-reveal`
(700ms, the one moment-class duration). Zero-padded so the reveal rolls, never
remounts. A sealed کارنامه draws the gold تذهیب rule once. Reduced motion:
static value, zero timers.

**View Transitions** (`utils/viewTransition.ts`): push-navigations and
popstate morph `#main-content` through `document.startViewTransition` +
`flushSync`, guarded by platform support and MotionContext; `replaceState`
(boot repairs) is never a moment. CSS twin (`base.css`): exit accelerates
away (`--ease-exit`), the new page settles in glass (`--ease-glass`).

**Lantern ambience** (`lib/lantern.ts` + `styles/lantern.css`): حالت شب امتحان
— the student portal goes candle-warm during the lamp hours (19:00–06:00,
preference `azmoonsaz:preference:lantern`, default ON). Two moves only: warm
glass tokens + a ~5% wash. Text tokens untouched; teacher surfaces never
mount it.

---

## 8. Sound & haptics — the seal sting

Single source: `src/lib/sealSound.ts`.

- **The one sound reserved for commitment** (final submit, publish, seal).
  A deep sub-bass thump (sine drop 130→42 Hz, exponential decay) + one paper
  tick (26ms band-passed noise). Total ~0.42s. *"A stamp, not a chime."*
- **Laws**: WebAudio-synthesized only (no asset fetch, ~0 bytes shipped, zero
  latency after the submitting gesture); fires **once on the stamp beat**;
  never scheduled, never looped, never used twice in a row; every failure is
  silent — sound must never break the moment it marks.
- **Preference**: `azmoonsaz:preference:seal-sound` (JSON boolean, default ON —
  the moment earns it). The key is the single mute surface today; a visible
  Topbar/settings toggle is **RESERVED** and must consume this same key when
  it lands — no second source of truth.
- **Haptic**: one short impact on the stamp beat (`sealHaptic`), same
  preference gate.

No other sound exists. Micro-interactions stay silent; if a second sound is
ever proposed it needs its own reserved moment, its own preference key, and the
same zero-asset constraint.

---

## 9. Performance law — glass must be free

- **60fps on a 5-year-old laptop** is the budget; the lab's bench
  (`آزمون روانی`) is the instrument.
- Maps are static assets of the physics: built once per geometry, cached, and
  in the WebGL path uploaded as textures. Runtime cost is the sample, not the
  build.
- Girih adds **zero runtime cost** (it lives inside the static map).
- `prefers-reduced-transparency` and the inset/veil token splits are load-bearing
  accessibility surfaces — never bypass them for a visual idea.
- Bundle ratchets (`npm run check`, check-sizes) guard the budget mechanically;
  an OVERRIDES entry is a debt, not a victory.

---

## 10. The moments ledger

Every "moment" is a *promise point* — a place where the product commits to
someone. The ledger keeps them rare and rite-shaped:

| Moment | Status | Owner |
|---|---|---|
| Sealing Ceremony (submit) | **Shipped** (P1-a) | `SealCeremony.tsx` |
| Seal stamp (publish/import successes) | **Shipped** | `Seal.tsx` (96px, full-panel only — never a toast) |
| Girih optics (every glass rim) | **Shipped** (P0) | tokens + 3-way map math |
| Motion grammar | **Shipped** (P0) | `tokens.css` |
| Grade reveal (ScoreOdometer + تذهیب rule) | **Shipped** | `components/ScoreOdometer.tsx` |
| View-Transition page morphs | **Shipped** | `utils/viewTransition.ts` |
| Night-exam lantern mode | **Shipped** | `lib/lantern.ts` |
| Seasonal girih folds | **Shipped** | `glass/seasonalGirih.ts` |
| Azmoonsaz Wrapped (teacher year report) | **Shipped** | `pages/teacher/Wrapped.tsx` |
| Scroll-narrative landing | **Shipped** | `public/welcome/` |

A reserved moment is *designed for* (tokens pre-positioned) but *not built
incrementally*: each lands as one reviewed, gated change — same as the
ceremony did.
