# Frontend audit — Azmoon (آزمون‌ساز)

**Commit:** `818e415` · **Date:** 2026-09-26 · **No code changed.**

**Scope:** `src/index.css` (1329 lines), 56 TSX files (22,541 lines), the
`student-import` feature, `vite.config.ts`, and the deployed build read via CDP.

---

## Score

| Area | Score | Note |
|---|---|---|
| Colour discipline | **9/10** | Outstanding. 2,622 arbitrary Tailwind values, 100% resolve to tokens. 2 unique hex in all TSX. |
| Architecture intent | **8/10** | The token system is genuinely well designed and documented. |
| Token coherence | **4/10** | Two parallel glass vocabularies that have drifted apart. |
| Component library | **3/10** | 92% of panels bypass it. See §2 — this is the root problem. |
| Glass material | **3/10** | The rim has never once been visible. Structurally cannot fade. |
| Typography | **6/10** | Scale is clean, but 409 sites double-specify weight. |
| Motion | **4/10** | Zero motion tokens. 15 hardcoded `cubic-bezier`. |
| Accessibility | **5/10** | Reduced-motion plumbing exists; focus rings unverified. |
| Performance | **4/10** | 353 KB parser eagerly loaded for one wizard. |
| **Overall** | **5.5/10** | Strong bones, unbuilt. |

**The one-line verdict:** this is a well-architected design system that was
never actually adopted. The tokens are better than most production apps. The
pages just don't use them.

---

## 1. What is genuinely good — and should not be touched

Worth stating plainly, because the report below is mostly criticism:

- **Zero raw colour in components.** 2,622 `bg-[…]`/`text-[…]` values across
  22.5k lines, and every single one resolves to a `var(--color-*)` token. Two
  unique hex literals in the entire TSX tree. This discipline is rare and it
  is what makes the rest of this fixable at all.
- **The glass comments are excellent.** `index.css` explains *why* the veil is
  split from the scrim, why opacity must never animate on a filtered element,
  why `@supports` must nest inside `@utility`. Those are hard-won findings,
  correctly recorded.
- **Reduced motion is real.** 7 `data-motion` rules, 11 TSX guards, resolved
  before first paint in `index.html`.
- **Type scale is well-formed.** 7 steps, explicit weight + line-height.

---

## 2. The component library is bypassed — 92% of the time

This is the finding that matters most, and it matches your suspicion exactly.

| | count |
|---|---|
| `<Card>` usages in the app | **24** |
| Hand-written `glx` / `glx-strong` surfaces | **292** |
| Glass surfaces carrying the rim | **50** (17%) |
| Distinct className strings repeated 3+ times | **121** |

`src/components/UIComponents.tsx` exports a competent `Card`. It is used 24
times. Meanwhile `ExamPreview.tsx` hand-writes 58 glass surfaces in 2,183 lines,
and `Questions.tsx` 54 in 2,390 lines. The library exists and the app ignores it.

The repetition is concrete, not stylistic. These strings appear verbatim:

```
 35x  text-micro text-[var(--color-text-tertiary)] font-bold block
 25x  text-micro text-[var(--color-text-tertiary)] font-bold
 17x  flex items-center justify-between
  7x  relative glx glass-edge border rounded-2xl p-4 flex flex-col justify-between
  9x  pointer-events-none absolute area-blur
  6x  absolute inset-0 pointer-events-none veil-blur
```

`pointer-events-none absolute area-blur` ×9 is a *component* — a halo wrapper.
It is copy-pasted nine times instead of being one export. Same for the
`scrim`+`veil-blur` pair ×7.

**Why this is the root problem, not just tidiness:** every material decision
you make in the library is currently made 292 times in markup, or 0 times,
depending on which page you look at. That is why the hero, the menu and the
settings cards are three different materials wearing the same class names.

---

## 3. Two glass token systems that have drifted

There are two vocabularies for the same physical material.

**System A** — `@theme`, `--color-glass-*`, build-time, Tailwind-managed:
```
--color-glass-light-fill     rgba(255,255,255,0.45)
--color-glass-light-stroke   rgba(26,26,46,0.1)
--color-glass-panel-fill     rgba(255,255,255,0.78)
```

**System B** — `:root`, `--glass-*`, runtime, invisible to Tailwind:
```
--glass-p-a1     0.3
--glass-p-tint   255 255 255
--glass-p-ba     0.22
```

**System A is used 327 times directly in TSX** (`--color-glass-light-stroke`
alone: 253). **System B is used zero times in TSX** — only by the utilities.

They encode the same ideas with different names and independently tuned values.
A stroke is `0.1` in A and `0.22` in B. A fill is `0.45`/`0.78` in A and
`0.3`/`0.14` in B. Nothing reconciles them. This is exactly how a design system
rots: not through bad decisions, but through two sources of truth.

---

## 4. The glass material does not work — and it is not a tuning problem

Full detail in `docs/glass-audit-2026-09-26.md`. The four load-bearing findings:

**a) The rim is white on white.** `--glass-edge-color: 255 255 255` on
`--glass-p-tint: 255 255 255`. Composited, the rim differs from the panel by
**4/255**; the 1px dark border differs by **49/255**. The rim is 12× less
visible than the border. Light mode is showing you the border.

**b) "Size-relative thickness" is decorative.** `clamp(1.5px, 4.2%, 3.6px)`
saturates its ceiling at **86px wide**. The 1,376px hero and a 40px avatar get
the identical 3.6px band.

**c) The rim cannot fade inward — architecturally.** `mask-composite: exclude`
confines the gradient to the ring. A ring has no interior, so the top band is
one flat alpha: measured `0.5 → 0.496` across the hero. A masked ring cannot
express an inward falloff. An `inset` box-shadow is required and nothing
currently provides one.

**d) Panels are ~1% different from the page.** Light: `251,250,247` panel on
`250,248,245` page — 2/255. Dark: 4/255. No material presence, and no
luminance range for dark mode to work with.

**Plus:** nothing exists behind the glass to distort. The page background is
two radial tints at **1% opacity** over flat cream. `blur(7px)` on a flat field
returns a flat field. This is not a CSS bug — it is a design decision that has
not been made yet.

---

## 5. Simplification opportunities

You asked what could be simpler with the same result. Four real ones:

**1. Delete `--glass-edge-t` percentage.** It never binds (§4b). Either give it
a real range or remove it and be honest that the rim is a constant band.

**2. Unify the blur recipes.** `glx` uses `blur(7px) brightness(0.97)
contrast(0.92)` (`index.css:518`); `glx-strong` uses `blur(6px) brightness(1.04)
contrast(1)` (`:538`). Same material, **opposite brightness**. One recipe,
differentiated by shadow and fill only.

**3. One radius.** `--glass-p-radius: 28px` is consumed only by `area-blur`,
while panels use `rounded-2xl` (24px) and `rounded-3xl` (32px). The halo behind
every modal is built on a different radius than the modal. Meanwhile 6 distinct
radii are in use across 270+ occurrences. One scale, one panel radius.

**4. Promote the copy-pasted wrappers to components.** `area-blur` ×9,
`scrim`+`veil-blur` ×7, the stat-card block ×7. That is 23 sites that should be
one export each.

---

## 6. Typography — 409 double-specified weights

The type utilities set weight in CSS:
```css
@utility text-caption { font-size: .8125rem; font-weight: 600; }
@utility text-micro   { font-size: .75rem;   font-weight: 650; }
```
And **409 places in markup** also add a `font-*` class to the same element. The
winner is CSS-order dependent, so the same class renders at different weights
depending on what sits beside it. Pick one owner.

Also: `font-weight: 650` on `text-micro`. The `@font-face` declares `300 900`,
so if the shipped woff2 is a true variable font this is fine — but 650 is off
the 100 grid, and if the file is a static instance it silently snaps to 700,
making micro text *heavier* than label text (600). An inverted hierarchy. Worth
verifying the actual font file.

---

## 7. Motion has no token layer at all

- **0** duration/easing tokens
- 15 hardcoded `cubic-bezier(…)` strings in TSX
- 4 `ease-[…]` arbitrary values
- 36 Tailwind `duration-N` uses, all different

The `useEdgeLight` hook and the modal springs are the two places where motion
carries meaning, and both hardcode their curves. Everything else is
individually tuned, so the app has no single "feel".

---

## 8. Performance — 353 KB loaded for one wizard

`vendor-import` is **352,928 bytes** (gzip 121 KB) and contains PapaParse +
SheetJS. `src/features/student-import/parseStudentFile.ts` imports both
**statically** at line 1–2.

That means every user downloads a spreadsheet parser to reach the dashboard,
because the import wizard is behind a route that isn't lazy. One `await
import('xlsx')` inside the branch that needs it removes ~121 KB gzip from the
critical path.

There are also **0** `will-change` hints and **0** `contain` declarations
against 9 blurred surfaces and 17 explicit z-index layers.

---

## 9. Accessibility — partial

Present: reduced-motion resolved pre-paint, semantic tokens for status colours,
`aria-label` on icon-only controls in several places.

Unknown / likely gaps:
- No visible `:focus-visible` style audit was possible. 542 `font-bold` and
  ~700 buttons/interactive divs later; several are `div` with `onClick` and no
  `role`/`tabIndex` (e.g. the avatar pill in `Topbar.tsx`).
- Contrast: text tokens over glass were checked in Phase 2 (tightest 4.75,
  passing), but that was before the border fix changed every panel edge.
- Forced-colors mode: not audited.

---

## 10. Proposed refactor plan

Sequenced so each step is independently verifiable. Phases 1–2 are the material;
3–5 are structure; 6 is cleanup.

### Phase 1 — Make glass actually read as glass
1. Body fill → **radial**, densest at rim, clearest at centre. Fixes §4a and
   §4d together and gives dark mode its luminance range back.
2. Rim → **three parts**: sub-pixel outer line, a band with genuine cross-band
   falloff, and an `inset` shadow carrying glow inward. This is the one that
   cannot be done with the current ring (§4c).
3. Rim thickness → actually size-responsive, or drop the percentage.
4. Remove the competing 1px border (§4a) — the rim becomes the edge.
5. Refraction → keep on floating chrome only; already correct at 13 sites.
   Tune `scale` in `GlassSystem.tsx` — `0.14` on a 1,376px hero is ~96px of
   displacement, almost certainly too much.

**Gate:** you look at the deployed app. This is the only phase where taste
decides, and the only one I cannot verify.

### Phase 2 — Decide what the page looks like behind the glass
Either give the page real depth (gradient field, texture, scrolling content) so
backdrop-filter has something to work on, or formally accept that in-page cards
are frosted panels and reserve refraction for floating chrome. **This is a
product decision and it gates the rest of the plan** — without it, Phase 1 is
tuning against an empty backdrop.

### Phase 3 — Rebuild the component library, then migrate
1. Define the surface set once: `Panel`, `StatCard`, `MenuButton`, `Field`,
   `Badge`, `Sheet`, `HeroSurface` — each owning its glass recipe.
2. Promote the copy-pasted wrappers: `GlassHalo` (×9), `Scrim` (×7),
   `StatCard` (×7).
3. Migrate high-density files first: `ExamPreview` (58), `Questions` (54),
   `ExamSettings` (38), `ExamResults` (26).
4. Delete the inline `glx …` class strings as each file is migrated.

**Gate:** the rim and body must be *in the library*, so a change in one place
changes 292 surfaces. This is where the material stops drifting again.

### Phase 4 — Collapse the two token systems
Merge system A and B into one. Keep `--color-*` as the single vocabulary
(TSX already speaks it 327 times); migrate the `--glass-*` utilities onto it and
delete the duplicates. Reconcile `stroke 0.1` vs `0.22`, `fill 0.45/0.78` vs
`0.3/0.14`.

### Phase 5 — Typography, motion, radius
1. One owner for weight: strip the 409 `font-*` classes, or strip weight from
   the utilities. Not both.
2. Verify the woff2 is variable; settle `650`.
3. Define 4–5 motion tokens (`--dur-fast/base/slow`, `--ease-standard/exit`).
   Replace the 15 hardcoded `cubic-bezier` and 4 arbitrary easings.
4. One radius scale; one panel radius shared by panel and halo.

### Phase 6 — Performance and a11y
1. Lazy-load `xlsx` — removes ~121 KB gzip from the critical path.
2. `will-change` / `contain` on the 9 blurred surfaces.
3. Focus-visible audit; add `role`/`tabIndex` to `div`-as-button surfaces.
4. Re-run contrast after Phase 1 changes every panel edge.
5. Forced-colors pass.

---

## Honest limits

- **I cannot see the deployed page.** Every perceptual judgement here is from
  source, computed values, and your screenshots. Phases 1 and 2 need your eyes
  after each step.
- **Refraction is Chromium-only.** Safari drops `backdrop-filter: url()`
  entirely. The `@supports` split is correct, so Safari gets frosted glass —
  but the two will never match exactly.
- **Scores are my judgement**, informed by measurement but not by sight.
- The 353 KB parser figure is the *uncompressed chunk*; 121 KB is the gzip
  figure that actually crosses the wire.
