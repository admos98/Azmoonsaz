# FRONTEND — audit & master-fix plan (2026-10-20)

> Supersedes the 2026-10-15 version of this file. That version's structural
> split section is **done** — see "Landed since 2026-10-15" at the bottom —
> so this doc no longer lists it.
>
> This version is written from a **root-cause audit** of the Safari/iOS
> phone reports (2026-10-20): "sub panels are not bending the background on
> Safari phone, big panels do"; "background moves with scroll and stutters
> on Safari phone"; "remove the four big circles from the background". No
> band-aids: each finding names the mechanism in the code, then the root
> fix.
>
> **No code has been written for anything in Sections 1–6 yet.** This doc
> is the contract for that work.

---

## 0. The three material worlds the app actually ships (root model)

Every glass pixel on screen is painted by exactly one of three painters,
chosen per panel by the engine (src/glass/*):

| Painter | Who gets it | Bend? | Blur source |
| --- | --- | --- | --- |
| **WebGL shader** (`webglRenderer.ts`, canvas `#glass-canvas`) | **in-flow** panels over the page plate: `.glx`, `.glx-strong`, `.lens`, `.pane`, `.drop` that pass `webglPlaceable()` (no fixed/sticky/absolute ancestor, no clipped ancestor, nothing painting between them and the plate) | YES — displacement + specular + dim, uniform across engines | 25-tap blur of the **plate texture** |
| **CSS `url()` chain** (engine inline `backdrop-filter: blur() saturate() url(#lg-N)`) | panels the shader **cannot** serve (fixed/floating/clipped), **on Chromium ≥ 138** only (`data-lens='on'` gates the fall-through, `glassFlush.ts` PHASE A) | YES | Chromium backdrop blur of the **live DOM behind the panel** |
| **Bare CSS material** (the `@utility` declarations in `materials.css`/`glass.css`, engine untouched) | the same non-placeable panels on **Safari/Firefox**, plus lite/off tiers, plus nested glass (de-nest rule) | **NO** | the engine's own backdrop blur (WebKit GPU) — rim decays to static rings |

The iOS bug reports are this table read aloud. On iPhone (Safari 26),
`data-lens` is **permanently `off`** (public/boot.js — the gate is a
Chromium version test, deliberately, because WebKit silently drops
`url()` inside `backdrop-filter`; WebKit bug 245510, still NEW in Sept
2026), while `data-paint` is `gl` (WebGL2 works). So:

- **Big panels bend** — in-flow, shader-drawn, engine-independent. ✔
- **Sub panels don't bend** — the menu, the notifications dropdown and
  every topbar surface live inside `position: fixed/sticky/absolute`
  wrappers → `webglPlaceable()` returns false → on Safari the lens gate
  drops them from the engine → they ship bare CSS: real blur, **no bend,
  no specular rim**. On Chromium the same panels bend via the CSS `url()`
  path. ✔

**This is not a tuning problem.** The architecture was designed (correctly)
around Chromium's two working paths and left Safari a deliberately plainer
fallback. Apple hardware is the second most important client; the master
fix is a fourth row in that table, not a tweak to the third.

---

## 1. Finding M1 (root): floating-family panels never bend on Safari/iOS

**Mechanism** (glassFlush.ts, PHASE A): WebGL mode + non-placeable panel →
`if (!glassAllowed()) continue;` → `glassAllowed()` is false on every
non-Chromium engine, forever. `chainOf()`/`commit()` could serve these
panels on Safari — but the markup they'd produce is
`backdrop-filter: blur(3px) saturate(1.4) url(#lg-N)`, which WebKit drops
**in its entirety** (bug 245510: the whole declaration, blurred result
included). Skipping them is the *right* bug-prevention today; what is
missing is another painter for them.

**Impact on iPhone**: the hamburger menu (4 `lens--menu` panels), the
notifications dropdown, the name/search pane pills and every `btn-glass`
circle — the chrome the user touches most — render as the flat pre-bend
material, while the content beneath them (big in-flow panels) bends. The
page reads as "broken glass on top, magic glass underneath."

**Master fix — a "chrome pass" in the WebGL canvas: menu, topbar and
every floating panel bend on ALL engines, Safari included.**

The shader cannot sample live DOM — but it does not need to. A floating
panel's backdrop is discoverable without sampling DOM:

- **Backdrop decomposition.** A floating panel's backdrop is
  1. the plate (constant), plus
  2. whatever DOM content sits under the panel *at that scroll offset*.
  For (2) the engine already has the panel rect, the scroll state and the
  DOM; the pass renders that region into an offscreen texture only for
  frames where the rect has an under-content delta. Menus opened over
  calm plate regions skip the build and shade from the plate alone.
- **Cost wall.** One offscreen texture shared by all floating panels,
  sized to their union rect, invalidated by the same idle gate that
  already resolves `glDirty` (scroll / draw-set / geometry / fade /
  theme). Menus are open-then-settle objects: one build on open, one per
  scroll frame only while a menu tracks moving content, zero while idle.
- **Alpha is already solved** — `effectiveAlpha()` (glassController.ts)
  feeds the shader the fade opacity of the growFrom/shrinkTo animations;
  the floating pass reuses it so open/close motion stays smooth.
- **It is directional, never a removal:** the chrome pass REPLACES the
  painters that failed on Safari with the one that works everywhere —
  the shader. No engine loses the bend anywhere. On Chromium the CSS
  `url()` fall-through becomes dead weight once the pass ships and is
  deleted; other engines lose nothing they had.
- **Fallback stays honest**: a panel the pass cannot serve (two clipped
  ancestors overlapping, unmappable content) keeps its current material
  on that engine — a smaller downgrade than wrong pixels.
- **`?glxf=0`** stays as an A/B lever, same pattern as the existing
  `?glxc=0`.

Acceptance: on an iPhone (Safari 26) AND on desktop Chrome, the hamburger
menu and the topbar show bend + specular rim structurally identical to
the shader panels behind them — one glass material at multiple weights,
the grammar `glx` vs `glx-strong` already defines; `?perf=1` chrome-pass
counters stay flat while the menu idles, and menu open costs ≤ 1 extra
texture build; no engine regresses on any panel it bends today.

**Sequencing note.** The largest item in the plan. Lands standalone
(one PR, one lever, one device test); nothing in Sections 2–5 depends on
it.

---

## 2. Finding M2 (root): big glass and its children ride different position stations

**User's formulation (accepted as the root hypothesis):** the big bending
panels painted by WebGL are **separated from the children panels inside
them** — the two groups move differently during scroll, so the interior
reads as detached from its own glass shell. This reproduces on the phone
and is reported on desktop too.

**Mechanism — the station split.** A bending panel's glass and its
children are composited in different places today:

- The **glass body** lives on the `#glass-canvas` plane: a fixed element
  translated by the scroll-sync timeline (compositor clock), while the
  frame loop paints panels at `getBoundingClientRect()` positions sampled
  on the main-thread rAF clock.
- The **children** live in the DOM plane, moved by the scroller itself
  (compositor scroll for transform-oil, main-thread layout otherwise).

Three clocks claim the same pixel row during a scroll: the scroller's
live offset at display time, the `--glass-sync` var the engine last
*published*, and the rAF frame the engine last *painted*. Chromium's
sync timeline is exact on the lab harness (max error 0.0px) — but the
lab verified the canvas translating a **glass-only** region over an
*undecorated* plate. In the app the panels the canvas paints are
rect-measured one frame late relative to the DOM the children ride,
and any error between those two planes reads as "the children slide
inside their own panel."

***

### 2b-side note kept: rubber-band overscroll is REAL and separate

`overscroll-behavior` is set nowhere; iOS rubber-band translates fixed
layers, dragging glass relative to DOM during the band. That fix
(M2b below) stays — but the "children separate from their panel" report
is NOT explained by rubber-band alone: it appears in normal scrolling
too, where the mechanism above (glass on canvas plane, children on DOM
plane, three clocks) is accountable. The overscroll fix removes one
mover; the anchor fix below removes the structural split itself.

---

## 2A. Finding M2-A (the root fix): migrate child glass INTO the parent plane — one station per panel tree

> **LANDED 2026-10-20** — the mechanism below is implemented in the engine
> (`glassFlush.ts` child branch, `glassPipeline.ts`
> trackWebglChild/canvasParentOf/parentPaintFor, `webglRenderer.drawPanel`
> parent frost, GLASS_FS `u_p*` uniforms). The original design text is kept
> under "Design intent" for the material contract; "What shipped" is the
> authoritative account.

**What shipped.** A glass child whose nearest glass ancestor IS itself a
canvas-eligible panel (webglKindOf + webglPlaceable — read from the parent's
own state, never its dataset, so parent + child arriving in one flush batch
both land on the canvas the same pass) joins the parent's station:

- Same draw set, same paint clock, same `--glass-sync` translate; rect
  sampled from the same frame as the parent's. One plane, three clocks →
  one. `data-glass-child='webgl'` marks it (NOT data-glass-paint, whose CSS
  block transparents backgrounds — the child's de-nest quiet fill must
  survive; only its filter is killed inline, to be replaced by the shader).
- Painter order: parents first, then children (`glFrame` two-pass), so a
  child is never trampled by its own parent drawn later. A child whose host
  left the draw set is skipped with it.
- Backdrop semantics: what a CSS backdrop root passes down is the parent's
  finished composite — the parent's dim wash + fill step are frozen into
  `ParentPaint` uniforms (`u_pDim`, `u_pDimTint/…`, `u_pFillA`, `u_pFillTint`)
  and applied to the child's displaced plate sample before its own chain.
  The parent's fill alpha is evaluated once at the child's centre along the
  parent's CSS gradient axis (position-dependent term). The parent's rim
  displacement/specular arc are deliberately skipped: edge-weighted maps read
  zero in the interior where children sit; documented approximation.
- Rank bound: 2 (panel → inside-panel). A grandchild (nearest glass ancestor
  has no canvas paint) keeps the CSS quiet material.
- Counters: `?perf=1` `engine.drawnChildren` reports anchored children per
  frame; the source contract is pinned in
  `src/test/config/glassChildStation.test.ts`.

**Design intent:** glass-in-glass is already refused as *filters*, but
the *children* of a bending panel are plain DOM that composites over the
canvas — two planes, three clocks. The master fix makes the panel tree
a single station by painting child-panel glass **into the parent's
placeable-plane condition** instead of treating position/nesting as the
split line:

1. **Canvas-local composition.** The shader already draws any panel
   whose ancestors are plain-flow to the shell. Extend the
   placeability logic: a panel INSIDE a shader-drawn parent is a glass
   surface *in canvas coordinates* (its rect is
   `parentRect + localOffset`), not a DOM-plane surface. The backdrop
   it samples is the parent's panel backdrop as the shader already
   computes it — one blur pipeline, one clock. Nesting depth is
   bounded at 2 ranks: panel → inside-panel.  ✅ as the child-station
   draw + frozen parent terms.
2. **DOM keeps only text/controls.** What remains in the DOM layer of
   a parent panel is content (text, controls, art), which never needs
   its own glass clock — it scrolls WITH the panel rectangle because
   it IS the panel rectangle's content; the panel's glass on the
   canvas maps the same rect to the same local coordinates.
3. **Scroll-sync gets one mover, not three.** With child glass on the
   canvas, the compositor's translate moves glass and its content
   identically; the reconcile between rect-sample error and live
   scroll becomes a single-variable problem governed by the published
   `--glass-sync` (existing machinery), not a per-frame negotiation
   between separate painted planes.
4. **The de-nest rule stays for FILTERS only.** A quiet in-flow child
   (`pref-row`, builder rows) that today correctly reads as non-glass
   remains non-glass by CLASS, not by plane. What this fix changes is
   not "nested glass gets a bend" (that stays wrong) but "child glass
   positions differently from its parent glass."  ✅ the de-nest quiet
   fill survives verbatim under the child's own shader bend.

Acceptance (phone AND desktop): scroll a big panel containing
builder/row glass at high velocity in both engines — zero relative
motion between panel and children across the whole gesture, including
at scroll conclusion after a fling; `?perf=1` child-panel counts report
identical rects to their parent's mapped space for all sampled frames.
→ Device pass pending on the real phone (the desktop side is verified
by the source contract + counters; the phone case re-tests in the same
session as M1's device check).

---

### 2b. Rubber-band overscroll translates fixed layers (iOS mover №3)

No `overscroll-behavior` exists anywhere in `src/styles/*.css`. On iOS,
end-of-page overscroll visually translates fixed layers — plate and
canvas both ride the rubber band. That is one of the movers in the
phone report ("background moves with scroll") and it compounds 2A
whenever the canvas is translating.

**Master fix (Apple-grade, not the blunt `none` on `html`):**

- `#app-teacher-shell { overscroll-behavior-y: contain; }` — the shell
  stops the ripple; the OS keeps its bounce everywhere else.
- `overscroll-behavior: contain` on nested scrollers (the `.max-h-60`
  notif list, the secure-exam body, every `overflow-y-auto` inside
  panels) so their drags do not chain into the shell scroll.
- A scoped `touch-action` audit pass confirming every other gesture
  stays native.

Acceptance: a hard fling at the top of `/teacher` in Safari on iPhone
leaves plate and panels unmoved; the notif list and exam body scroll
inside their own boxes without dragging the page.

### 2c. iOS chrome sampling — the OS half of the phone complaint

Safari 26's Liquid Glass chrome samples the page's composited pixels at
the viewport edges; a WebKit field report (bug 322087, iPhone 16 Pro
Max, iOS 26.6) shows sticky light cards + a fixed transparent header
making the toolbar/status bar lose transparency mid-scroll. Our topbar
is `bg-transparent` sticky over a moving page — the exact recipe in
that report. Page CSS cannot control the OS sampling where it fails,
but two mitigations belong in the plan:

- **`theme-color` meta** for both themes, synced to `data-theme`
  changes (currently absent).
- **Topbar probe:** if device reports show the status bar flashing,
  give the phone topbar a hairline translucent plate-tint instead of
  pure transparency — a visual decision to be made at implementation.

---

## 3. Finding M3 (answered): sub-panels inside big bending panels

The user asked *why* there are "two separate moving-on-scroll
mechanisms" and how sub-panels sit inside the big ones. This section is
the model so future work inherits it rather than re-derives it.

**Nesting model (correct today — keep it):**

- Glass never nests glass. `.lens/.pane/.drop/.glx*` inside another glass
  panel are flattened by the de-nest rule (glass.css) and the engine
  refuses them (`isNestedGlass`). A backdrop root exposes only its own
  flat fill to children — a nested bend would bend a *flat field*
  (invisible) at full filter cost. Sub-panels are therefore **quiet
  materials** (translucent fill + hairline, no filter), laid in normal
  flow inside the bending host: the question-bank builders, `pref-row`
  selector rows, roster cards. This is the iOS grouped-list grammar and
  it is right.
- **Placeability is a different axis from nesting**
  (`webglPlaceable`): an ancestor chain of plain flow up to
  `#app-teacher-shell`. It conflates *layout position* (fixed vs
  in-flow) with *visual situation* (glass-over-plate vs
  glass-in-glass). Floating panels are perfectly clean glass over the
  plate, yet the gate pushes them off the shader for layout reasons —
  while "glass-in-glass" forbids a bend for a *correct* reason. M1's
  floating pass un-conflates exactly this.

**The "two moving mechanisms," answered:** there is no JS pair. The
movers on screen are

1. the **DOM plate** — fixed, compositor-anchored, does not scroll by
   design;
2. the **glass canvas** — fixed, translated by the scroll-sync animation
   (Chromium) / parked (other engines);
3. on iOS, **rubber-band overscroll** (2b), translating *both* — the one
   mover no engine accounts for, and unplanned.

Movers 1 and 2 are the architecture working as drawn; the defect is not
a third JS mover but the **station split (see M2/M2-A)**: panel glass on
the canvas plane, children on the DOM plane, so two of those movers
carry the same panel tree differently — the "anchor" problem the user
named. Fix = one station per panel tree (M2-A), plus the overscroll
containment (M2b) for the only genuinely unplanned mover.

---

## 4. Finding M4: remove the four big circles from the background

**Where they live:** `public/backgrounds/bg-d-light.svg` and
`bg-d-dark.svg` — two `<g>` groups of `<circle>`s: a top-right cluster
(cx≈972–1140, cy 216–384) and a bottom-left cluster (cx≈156–260,
cy 808–912), one gold disc each (`#F5B301` @ 0.34 light / 0.5 dark),
the rest outline rings. The `.2x.webp` raster twins were rendered from
these SVGs and will go stale together.

**Why they fail the material:** the plate exists to be a calm contour
field — "the contour lines are the structure the blur and lens bend
reveal" (docs/brand-the-mark.md). Sharp filled discs are the
highest-frequency, highest-chroma content on the plate: along every
panel's displaced edge they show up as hard gold arcs rolling under the
glass. The circles are the only content that *fights* the bend instead
of showing it off.

**Master fix, the engineering-clean way:**

1. Delete both circle `<g>` groups from `bg-d-light.svg` +
   `bg-d-dark.svg`. Keep `bloom`, `pool`, the `fade` mask, contour
   strokes and `grain` — the glass still has fine structure to bend
   over.
2. Re-render the `.2x.webp` twins with the existing
   `tools/render-plate-rasters.mjs`. Never hand-edit a raster twin.
3. Inspect the sibling plates (`bg-e/f/g-*`) for the same disc grammar
   and enforce "one plate, one idea" across all of them while touching
   this part of the tree.
4. No test churn: the plate pins in `glassMaterial.test.ts` /
   `webglGlassPath.test.ts` reference filenames, not artwork content.

Acceptance: the plate renders identically in both themes minus the
discs; a before/after `?perf=1` plate dump confirms only removal.

---

## 5. Deliberately out of scope (named so they don't creep back)

- **Adopting WebKit `url()` in backdrop-filter** when bug 245510 ships
  to stable: the chrome pass is GPU-flat and engine-independent — a
  software-raster regression is exactly what the shader path exists to
  avoid.
- **Removing the bend from menu/topbar on any engine.** The user's
  direction is explicit: menu and topbar bend via the WebGL canvas — the
  mechanism Safari allows — not stripped down anywhere. Any "simplify
  Safari by flattening the chrome" proposal is out of scope (M1).
- **Relitigating the glx shader-fill split.** The
  DOM-gradient-stays-in-CSS decision is measured and correct
  (glx-parity bisect).

## 6. Priorities & order

1. ~~**M2b overscroll/contain**~~ — ✅ LANDED (`4784a2a`).
2. ~~**M2-A child-glass anchoring**~~ — ✅ LANDED 2026-10-20 (see 2A "What
   shipped"; desktop verified, device pass rides M1's phone check).
3. **M4 plate circles** — asset surgery + raster regen, half a session.
4. ~~**M2c theme-color + topbar probe**~~ — ✅ LANDED (`5287ff5`; the topbar
   probe stays open until field reports name a status-bar flash).
5. **M1 chrome pass (menu/topbar/floating bend on WebGL, all engines)** —
   the master fix for the bending gap. Build last, plan first:
   `?glxf=0` lever, offscreen texture budget, device test at every
   step.

## 7. Landed since 2026-10-15 (so nobody re-audits it)

- Findings 1–10 of `docs/FRONTEND-FINDINGS.md` — resolved (label contrast
  tiers, dead `font-*` sweep, unsaved-changes guards, boot screens split,
  surface-discipline blur rules, veil split, label grammar, motion,
  focus, library ratchet). Anchors `e0b2de9`, `c2d99e4`.
- Size-ratchet campaign, four phases, all gates green at commit
  `f89622e` (typecheck, eslint 0, vitest 43 files/315 tests, all check:*
  ratchets, production build):
  - A. `SecureExamPortal.tsx` 892→73 → `features/secure-exam/`
  - B. `Questions.tsx` 1973→1416 → `features/question-bank/builders/*`
  - C. `Students.tsx` 1240→889 → `features/student-roster/*`
  - D. Glass engine split: `glassController.ts` 1550→696 surrounded by
    `glassTokens/drift/maps/chain/syncQueue/pipeline/flush` leaf modules
    (state-free, host-bound); `webglRenderer` 1005→722
    (`webglShaders.ts`); `perfRecorder` 752→527 (`perfReporterTypes` +
    `perfRecorderUi`); `glassMaterial.test.ts` 950→677 +
    `glassMaterialFamily.test.ts` 320. Engine design history lives in
    `docs/glass-engine.md`.
- The 2026-10-20 audit (this doc): M2b overscroll containment (`4784a2a`),
  M2c theme-color sync (`5287ff5`), **M2-A child-glass anchoring** — glass
  children of canvas-drawn parents join the parent's station (one plane,
  one clock; parent frost frozen into uniform terms; `?perf=1`
  `drawnChildren`); contract pinned in `src/test/config/glassChildStation.test.ts`.
- Still open from the 2026-10-15 doc:
  - **Visual-regression tooling** — no screenshots, no CI image diff. A
    single broken glass rule or missing art asset ships silently today;
    the glass world M1 touches is the strongest argument yet. Pick
    Playwright `toHaveScreenshot`; baseline the six panels + empty
    states, light and dark.
  - **Viewport/browser matrix** in Playwright (single Desktop Chrome
    project today) — now doubled in importance: iOS Safari is a
    first-class glass client and there is zero automated coverage of
    it.
  - Release-gate manual passes (keyboard-only, reduced-motion,
    forced-colors, 200% zoom) — unchanged.
  - Small/hygiene: 3 reasoned `any`s to re-check, 10 files with
    `eslint-disable` to audit, Art Round-2 niceties (sweep-underline,
    isometric controls, `optical.css`) — build only if surfaces feel
    flat.
