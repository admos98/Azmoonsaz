# Liquid-glass engine — background and design history

> Moved from the 60-line header comment of `src/glass/glassController.ts`
> (2026-10-20, controller size campaign). The code is authoritative; this
> file keeps the measurement record that shaped the modules.

@license
SPDX-License-Identifier: Apache-2.0

Liquid-glass controller — BATCHED EDITION.

Displacement + specular maps are built from the panel's own size, cached by
(kind, size, radius), and every panel points its inline backdrop-filter at
`blur() saturate() url(#shared)`.

── Why this was slow, and what changed ──────────────────────────────────
A real-session profile (?perf=1) on /teacher/settings/questions measured
27fps avg, 59% janky frames and 121 long tasks (11.9s blocked over 100s).
The worst frames had NOTHING animating (tr: 0, an: 0), which ruled out both
the filter graph and the CSS animations:

  Every DOM mutation anywhere under body scheduled a FULL-document sweep.
  The sweep ran sync() over every glass element, and sync() read
  offsetWidth/offsetHeight (forces layout) then wrote style.backdropFilter
  (invalidates layout) — per element, in a loop. 33 glass surfaces meant 33
  forced layouts per sweep, on every mutation. Layout thrash, not glass.

The fix is in three parts, none of which touch a pixel:

  1. Batched, deduped queue. Mutations enqueue only the elements that
     actually appeared; nothing scans the whole document. Queued panels are
     measured in ONE read-only phase (a single forced layout for the whole
     batch), then written in a second phase — the read/write split that
     removes the thrash entirely.

  2. No querySelectorAll in the mutation path. Added subtrees are walked
     once on entry; tracked elements live in a Set so pruning dead filters
     never walks the DOM tree either.

  3. Map builds + PNG encodes run in a Worker (mapWorker.ts). The pixel
     loop (borderSDF pow/sqrt per px) + two deflate encodes per new size
     were the remaining main-thread cost (~4.2s of long tasks over 66s in
     the ?perf=1 report). Panels rest on their CSS blur base until the
     maps arrive — one repaint, no flash — and the sync data-URI path
     survives only as the no-Worker fallback.

The playground's physics survive intact: same mapMath, same curvature
exponent (n = 2^k, Chromium-verified), same specular arc, same bezel ring.

── Lever A: the bend is viewport-gated (2026-10-09) ──────────────────────
A ?perf=1 drive on /teacher/dashboard showed 13fps scroll vs 36fps still
with 73/80 worst frames carrying NO longtask: pure raster cost. Four lens
panels held ~2M px of live url() area — a full viewport of ~10-primitive
SVG graph per scroll frame — while one 1204x261 panel sat fully offscreen
still burning its filter. The engine observed resize + DOM only, so
offscreen panels kept their bend forever.

An IntersectionObserver (300px pre-dress margin) parks offscreen panels:
inline url() chain cleared, lastQuickKey forgotten. Re-entry re-dresses
from the MAP_TABLE/FILTERS hit path (string ops, sub-frame — zero worker
rebuild), and the margin means the bend is attached before pixels turn
visible. Resting in-view output is byte-identical: zero visual loss by
construction. A flush-time rect check is authoritative (IO timing can't be
trusted at boot); a dress-time guard covers worker maps resolving while
offscreen.

## Child-glass anchoring (2026-10-20, M2-A)

The station split: panel glass painted on the canvas plane, nested glass
children on the DOM plane — during scroll the two groups moved on
different clocks (the reported "children slide inside their own panel").

Fix: a glass child whose nearest glass ancestor is itself canvas-eligible
joins the parent's station. Eligibility read from the parent's own gate
(webglKindOf + webglPlaceable), never its dataset — a parent and child
arriving in one flush batch both land on the canvas the same pass. The
child marks `data-glass-child='webgl'` (NOT data-glass-paint: that CSS
block transparents backgrounds, and the child's de-nest quiet fill must
survive; only its filter is killed inline). `glFrame` draws parents
first, then children, so painter order cannot be trampled; a child whose
host left the draw set is skipped with it.

Backdrop semantics: what a CSS backdrop root passes down is the parent's
finished composite — dim wash + fill step frozen into `ParentPaint`
uniforms, applied to the child's displaced plate sample before its own
chain (`u_pHas` gates the GL block). The parent's fill alpha is evaluated
once at the child's centre along the parent's CSS gradient axis. The
parent's rim displacement/specular arc are skipped intentionally:
edge-weighted maps read zero in the interior where children sit. Rank
bound: 2 (panel → inside-panel); grandchildren keep the CSS quiet
material. Counter: `?perf=1` `engine.drawnChildren`.
