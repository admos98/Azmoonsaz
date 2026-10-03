# Liquid Glass Engine Audit — why the app diverged from the playground

**Scope:** fresh clone at `5598b06` ("fix(glass): playground parity + perf — blur inside
filter, default filter region, no double blur, lazy resync"). Every finding below was
reproduced empirically in headless Chromium (bisection harnesses in
`scripts/harness/ab.html`, `bisect.html`, `ext.html` of the playground workspace) and
confirmed against the live dev server (`/dev/fixtures`).

## Symptom → root cause map

| Symptom | Root cause(s) |
|---|---|
| "Displacement is the WHOLE panel" | **C1, C2** |
| "No rim or rim color" | **C1, C2, C4** |
| "Some edges are sharp" | **C1, C3** |
| "5–10 fps, laggy" | **C6–C9** (compounding) |

## The major culprits

### C1 — Runtime engine: `feImage width/height="100%"` without an explicit filter region
`src/glass/lensEngine.ts → buildFilterMarkup()` emits `<feImage … width="100%"
height="100%">` inside a `<filter>` that has **no `x/y/width/height` region**. The
default filter region is `-10% -10% 120% 120%`, and the feImage percentage subregion
resolves against **that region** — not the element box. The displacement and specular
maps therefore never paint where they are designed to; `feDisplacementMap` effectively
samples an empty map and displaces **every pixel by `scale/2` in both axes** (a
uniform diagonal shift of the whole panel), and the specular ring lands outside the
element.

**Proof (bisect.html):** the *same* chain renders correctly with absolute-pixel feImage
sizes (V1–V4) and breaks catastrophically the moment `100%` is used (V5/V6/V7). On the
live dev server, every runtime filter ships `feImgSizes: [["100%","100%"], …]`.

The playground uses `width="${P.w}" height="${P.h}"` (absolute element px) — that is
why the playground is edge-only and the app is whole-panel.

### C2 — Static `#lg-lens` fallback: external `feImage href="/lens-map.png"`
`index.html` ships a static filter with an **external file** as the feImage source.
Chromium does not load external feImage references inside a `backdrop-filter` chain
(proof: `ext.html` S1 — external href = uniform shift; S2 — byte-identical map as a
data URI = renders). Every `.glx`/`.glx-strong`/`.glx-dark` surface consumes this
filter via the CSS gates, so **all ~269 card-class panels get a uniform −14 px
diagonal displacement** (`scale=28 → offset = 28·(0/255 − 0.5) = −14 px`) plus the
CSS `saturate()` boost — the "whole panel misplaced" look on every card, topbar and
dropdown, even where the runtime engine never runs.

### C3 — `/lens-map.png` is one map for one panel size, square-cornered, no AA
Pixel analysis (`scripts/analyze_lens_map.py`): the PNG is **652×128 = exactly
326×64 CSS @2×** (the hero's `--lens-size`), with a **0 px corner radius** (displacement
runs into the very corner) and **no AA ring** (R=255 at the border column). It is
stretched with `preserveAspectRatio="none"` onto every panel: bend bands become
anisotropic (band width scales by `W/326` horizontally and `H/64` vertically) and
**rounded panels get square-corner bends → sharp edges**. The runtime engine
`buildDisplacementMap` does generate proper per-panel SDF maps — but its output never
renders because of C1.

### C4 — The static chain has no specular (rim) layer at all
`#lg-lens` = `feImage + feDisplacementMap` only. The painted `.glass-edge` rim was
retired in the same commit ("rims now come from the lens filter's saturate pass") —
but a `saturate` pass only oversaturates the refracted backdrop near the edges; it
cannot create a reflective rim. The playground's rim = reverse-engineered specular map
(`A = cos²(θ−φ)·bump`) + `feComposite in` + `feFuncA slope` + `feBlend`. The runtime
engine ships that construction — but its output is killed by C1, so **nothing in the
app ever shows a rim**.

### C5 — The runtime engine only covers `.lens/.pane/.drop`
`glassController.kindOf()` ignores `.glx/.glx-strong/.glx-dark` — the majority of
glass surfaces — so per-panel geometry (correct maps, correct radius, specular) never
reaches cards even after C1 is fixed. They stay on the static stretched-map path.

## The FPS culprits

### C6 — `feGaussianBlur` inside every SVG chain
Each runtime filter blurs the **full backdrop** inside the SVG image-filter graph
(10 chains on the small fixtures page; more per route). SVG-chain blur and
displacement run together on the slow image-filter path. The playground's *visual*
order (blur → bend) is preserved just as well by CSS: `backdrop-filter:
blur() saturate() url(#f)` — CSS blur is GPU-composited and the SVG chain then only
bends the already-blurred backdrop.

### C7 — One filter per element; no geometry sharing
`sync()` builds a private `<filter>` per panel (`lg-1…lg-N`). Cards in a grid, rows,
buttons — identical geometry + params — each get their own graph and their own two
feImage decodes. Sharing one filter per unique signature (the sig already exists!)
removes duplicate graphs and decodes.

### C8 — Map DPR hard-forced to 2, maps rebuilt un-debounced
`mapDPR() = Math.max(2, Math.min(dpr, 2))` **always returns 2** — a 1240×800 panel
builds two 2480×1600 ImageData (≈ 32 MB) and PNG-encodes them (~30–80 ms each) on
every signature change. ResizeObserver rebuilds are **not debounced**: a window resize
or layout animation re-runs full map builds per frame → multi-hundred-ms stalls
(perceived as single-digit fps). On DPR-1 displays the 2× maps are pure waste.

### C9 — Observer storms
`domObserver` fires on **every React commit that inserts nodes** → `resyncGlass()` →
`pruneDead()` runs **one `document.querySelectorAll` per dead-filter candidate**
(O(filters × DOM)), then a full-panel sweep calling `getComputedStyle` 3× per element.
No rAF coalescing anywhere. Cheap-looking, but it lands on top of the frame budget
exactly when React is busiest.

## The tiny culprits (found in the dig, all fixed)

- **T1** `index.css` documents `--lens-max-displacement: 43.67px` as "the #lg-lens
  scale in index.html" — index.html actually ships `scale="28"`. Param drift.
- **T2** Engine reads radius from the `--lens-radius` token (21) instead of the
  panel's real `border-radius` → even a fixed chain would build the wrong map for
  r-28 modals / r-14 topbars (sharp-corner maps on rounded panels).
- **T3** `--lens-blur` for panes is `calc(var(--lens-blur) * 2)`; `parseFloat("calc…")`
  = NaN → silently falls back to 1 px. The intended 2× pane blur never applied.
- **T4** `.lens--menu` gets `--lens-blur × 3` only inside `mountGlassEngine`'s
  mount-loop — panels mounted later (routes, modals) never receive it.
- **T5** Map DPR is captured once per session (`const DPR = mapDPR()`); the sig
  includes a *fresh* `currentDPR()` on zoom, so zoom triggers rebuilds that reuse the
  **stale** module DPR.
- **T6** Engine sets `el.style.backdropFilter = url(#id)`, dropping the family's CSS
  blur/saturate — `.lens` panels rendered with 1 px chain blur while `.glx` panels
  used 8 px CSS blur: two different materials on one screen.
- **T7** `imageDataToURL` allocates a fresh canvas per map (GC churn during rebuilds).
- **T8** The pre-engine frames (and any element the engine misses) render the CSS
  `url('#lg-lens')` chain with its dead external map → a visible **shifted-panel
  flash on every navigation** before the engine overrides inline.

## The fix contract (what "same engine as the playground" means now)

1. `buildFilterMarkup` emits **explicit filter region** + **absolute-pixel feImage
   sizes** (playground-proven) and **no in-chain blur** (blur lives in the CSS chain).
2. The engine claims **every glass family** (`.glx/.glx-strong/.glx-dark` too), reads
   the panel's real border-radius, and composes the full inline chain
   `blur(B) saturate(S) url(#id)` per family (restores T6, fixes C5).
3. **Filters are shared per signature** (geometry + params + DPR) — one graph for N
   identical panels (C7).
4. Maps build at **clamped real DPR** (`min(max(dpr,1),2)`, no forced 2) and rebuilds
   are **rAF-coalesced + 120 ms-debounced** on resize (C8).
5. Observers are **rAF-coalesced**; `pruneDead` does a single DOM pass (C9).
6. The dead static filter and the `url('#lg-lens')` CSS references are removed — the
   engine's inline chain is the only refraction path, so there is no broken fallback
   and no flash (C2, T8).
7. The rim is the playground's specular construction, backdrop-derived — never paint.

## Evidence index

- `scripts/harness/bisect.html` — one-delta-at-a-time chain bisection (V1–V7).
- `scripts/harness/ext.html` — external href vs data URI vs region/sizing (S1–S4).
- `scripts/harness/ab.html` — full playground-vs-app side-by-side.
- `scripts/analyze_lens_map.py` — lens-map.png pixel forensics.
- Live dev server probe: 10 runtime filters, all feImages `100%`, scroll ≈ 16 fps
  headless (SwiftShader) before the fix.

## 2026-10 addendum — load-time + curve unification (user round 3)

The user confirmed the engine parity fix landed ("much better"), then reported:
rims still too thin, the app still LOADS slow, corner curves inconsistent, and
duplicate close buttons. Findings and fixes, all measured:

### L1 — Main-thread map building blocked first paint
`canvas.toDataURL` PNG encoding ran on the main thread (30–80 ms per big panel)
inside a single synchronous boot burst — TBT 230 ms, worst task 280 ms on
/dev/fixtures.
**Fix**: `src/glass/mapWorker.ts` builds both maps and PNG-encodes them on an
OffscreenCanvas inside a 2-worker pool; the controller receives PNG **Blobs**
and wires them as `blob:` object URLs. Verified empirically: `feImage` resolves
`blob:` URLs inside `backdrop-filter` chains (stripes displacement probe), and
CSP `img-src` already allows `blob:`. The synchronous path (`imageDataToURL`,
data URIs) is kept as the no-Worker fallback. Result: **TBT 0 ms, worst task 0 ms**.

### L2 — Maps were 4–16× larger than the physics requires
Maps are smooth gradient fields: the interior is flat-neutral (128) and the
ring is a monotone ramp, so bilinear upscaling is loss-free for them. Maps now
build at 1 map-px per CSS px, capped to 1024 px on the long side
(`mapScaleFor`, `MAX_MAP_SIDE`) — the ring's on-screen geometry is defined in
CSS px and is unchanged.

### L3 — Everything built at boot whether visible or not
New `IntersectionObserver` gate (600 px lead): far panels keep the plain CSS
chain (`blur() saturate()`), maps build as panels approach the viewport, and
built filters are reused on scroll-back (signature cache hit). Off-screen
panels drop back to the plain chain so invalidations never re-raster a hidden
filter.

### L4 — Theme flips rebuilt every MAP for a markup-only change
`--lens-dim`/spec opacity/saturation only shape the `<filter>` markup, but the
old signature keyed the map build too. Now map-data is cached (LRU 64) by
**map signature** (geometry + physics + specAngle + specPeak + cornerExp +
scale); markup params re-dress cached maps for free. Verified: theme flip
reuses 23/23 feImage URLs, builds 0 maps.

### V1 — Rim thickness (+2 px, user spec)
`--lens-spec-peak: 2px` (was hardcoded 1 px): the specular ring paints
2×peak = 4 CSS px (white glint AND the saturated backdrop reflection the ring
masks), tuned from the playground's 2 px total.

### V2 — Apple signature curve, everywhere, engine-matched
The Task-5 state painted glass families with `corner-shape: squircle` (scoped)
while the maps drew CIRCULAR corners — the visible "panel curve ≠ rim curve"
drift. Now:
- one token `--corner-exp: 3` + `--corner-shape: superellipse(var(--corner-exp))`
  applied in `@layer base` to every box; circles/pills exempt
  (`[class*='-full']`, `.drop`, inline 9999px/50% → `corner-shape: round`);
- the old scoped `squircle` block is removed (it used a different exponent than
  the rim maps assumed);
- both map SDFs measure distance on the SAME superellipse (`borderSDF` with
  exponent k, exact-circle degeneration for pills), so the refracted rim hugs
  the painted corner. Non-±-3 exponents take a generic `Math.pow` path.

### V3 — Duplicate close buttons (user spec: X present → no bottom close)
Removed the bottom "بستن" strip in the Topbar notifications panel and the
"بستن" button in StudentImportWizard's done step. Functional
cancel/save/confirm pairs are untouched.

### Measured (same harness, same machine, SwiftShader)
| metric | before | after |
|---|---|---|
| scroll fps (3-run median) | 17.3 | 51.3 |
| load TBT / worst task | 230 / 280 ms | 0 / 0 ms |
| FCP | 948 ms | 676 ms |
| theme-flip map rebuilds | all | 0 |
Superellipse corner-shape costs ≈12% fps under SOFTWARE rendering (54→48);
on GPU-accelerated compositing (the user's hardware) it is a shader mask.

### Regression tooling
`tools/perf-probe.mjs` (load timeline), `tools/ab-perf.mjs` (A/B fps),
`tools/verify-fn.mjs` (lazy build, theme-flip reuse, circle exemption,
console cleanliness), `tools/visual-shot.mjs` (matched corner/edge captures).
