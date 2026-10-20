/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — BATCHED EDITION.
 *
 * Deduped batched dress pipeline over cached exact-size maps; the primary
 * renderer is the WebGL2 shader (webglRenderer.ts). Modules around it:
 *   glassTokens  — computed-style readers (shape + tint helpers, boot params)
 *   glassDrift   — the ?perf=1 drift waveform (reads window scroll, no state)
 *   glassMaps    — MAP_TABLE/FILTERS caches + the sync data-URI bucket build
 *   glassSyncQueue — dressPanel/commit + the map-worker pipeline (host contract)
 *
 * The full design history — why the engine is batched (27fps profile with
 * 121 long tasks), the WebGL2 rationale (Skia url() raster, per frame),
 * Lever A's viewport gate and the compositor scroll-sync — lives in
 * docs/glass-engine.md.
 */

import type { LensParams } from './lensEngine';
import {
  bindFlush,
  clearPendingSync,
  queueSync,
  requestFlush,
} from './glassFlush';
import {
  applyChain,
  chainDefs,
  chainOf,
  clearChainDefs,
  ensuredContainer,
  glassAllowed,
} from './glassChain';
import {
  GLASS_SELECTOR,
  readParams,
} from './glassTokens';
import { driftMarkPaint, driftSample, resetGlassDrift } from './glassDrift';
import type { GlassEngineStats } from './perfReporterTypes';
import { FILTERS, MAP_TABLE, revokeAllBlobs } from './glassMaps';
import {
  bindSyncQueue,
  inflightCount,
  terminateWorker,
} from './glassSyncQueue';
import { GlassRenderer } from './webglRenderer';
import type { GlassKind, GlassPaintParams } from './webglRenderer';
import {
  applyPaintKill,
  drawnSig,
  bindPipeline,
  plateSerialization,
  plateURLForTheme,
  tierAllowsGlass,
  untrackWebgl,
} from './glassPipeline';

/* ───────────────────── Ladder ───────────────────── */

const byEl = new WeakMap<Element, string>();

/** Every element we have dressed. A Set (not just the WeakMap) so pruning
 *  dead filters can iterate our own bookkeeping instead of the DOM tree. */
const tracked = new Set<HTMLElement>();

let mounted = false;
let resizeObserver: ResizeObserver | null = null;
let attrObserver: MutationObserver | null = null;
let domObserver: MutationObserver | null = null;
let viewObserver: IntersectionObserver | null = null;
let seq = 0;

let defaultParams: LensParams | null = null;

/* ───────────────────── WebGL render path ───────────────────── */

type RenderMode = 'webgl' | 'css';

interface PaintEntry {
  kind: GlassKind;
  params: GlassPaintParams;
}

/** Paint capability — settled before first paint by the boot probe
 *  (public/boot.js → html[data-paint]); the inline fallback covers a boot
 *  without the script. Pure WebGL2 capability: the lab-validated renderer
 *  beats the url() raster path even on software stacks, and the data-glass
 *  lite/off tiers stay the perf valve. */
const webglSupported = (() => {
  const probe = document.documentElement.dataset.paint;
  if (probe === 'gl') return true;
  if (probe === 'css') return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
})();

let lastDrawCount = 0;
/** Timestamp of the previous glass frame — feeds the drift ring's dt. */
let lastGlFrameT = 0;
/** Idle gate: a repaint happens only when the frame's identity changed
 *  (scroll, draw set, geometry, fade, resize, theme). See glFrame. */
let glDirty = true;
let lastIdleKey = '';
let lastDrawnCount = 0;

let renderMode: RenderMode = 'css';
let renderer: GlassRenderer | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let glRaf = 0;
let glReady = false;
/** Compositor scroll-sync (see the #glass-canvas keyframes in base.css).
 *  True when this engine runs scroll-driven animations; then every painted
 *  frame publishes its scroll offset to --glass-sync and the compositor
 *  cancels the live scroll delta for us — glass stays locked to its DOM
 *  instead of trailing by a frame. False (Firefox today) keeps the classic
 *  fixed-canvas behavior with no var writes at all. */
const SCROLL_SYNC_SUPPORTED =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline', 'scroll()');
/** The scroll offset the last painted frame was drawn for. Published to
 *  --glass-sync at paint time; the compositor reads it on the animation
 *  clock. -1 = nothing painted yet (the var must not exist before the first
 *  real paint, or the canvas would translate before its backdrop is ready). */
let syncPaintY = -1;
/** The scroller's travel (scrollHeight − clientHeight), published to
 *  --glass-range when it changes. The sync keyframes need it because the
 *  scroll() timeline's progress is normalized 0..1 — `translate(painted −
 *  progress·range)` is the un-normalized form. */
let syncRange = -1;
let webglBroken = false;
let shellElCache: HTMLElement | null = null;
let plateURL = '';
const paintCache = new WeakMap<HTMLElement, PaintEntry>();
const webglDrawSet = new Set<HTMLElement>();

/* Engine counters — the ?perf=1 oracle for the map pipeline. posted =
   builds sent to the worker, hits = panels dressed from cache (sub-frame),
   worker = panels dressed from worker maps, sync = panels that paid the
   main-thread data-URI fallback. Read via glassStats(). */
const stats = { posted: 0, hits: 0, worker: 0, sync: 0 };

/** Snapshot of the map pipeline — consumed by the ?perf=1 report. */
export function glassStats(): GlassEngineStats {
  return {
    posted: stats.posted,
    hits: stats.hits,
    worker: stats.worker,
    sync: stats.sync,
    maps: MAP_TABLE.size,
    inflight: inflightCount(),
    filters: FILTERS.size,
    mode: renderMode,
    drawn: lastDrawCount,
    boot: {
      probe: document.documentElement.dataset.paint ?? null,
      supported: webglSupported,
      broken: webglBroken,
      tier: document.documentElement.dataset.glass ?? '(unset)',
      lens: document.documentElement.dataset.lens ?? null,
      canvas: glCanvas !== null,
      ready: glReady,
      plate: renderer ? renderer.plateStage : null,
      plateRetries: renderer ? renderer.plateRetryCount : 0,
      plateSrc: renderer ? renderer.plateSrc : null,
      plateTried: renderer ? renderer.plateTried : [],
      plateProbe: renderer ? renderer.plateProbe : [],
      ...(plateSerialization()),
      shell: shellAt() !== null,
    },
  };
}

/**
 * Strip a dressed panel back to its CSS material. Runs when a dressed element
 * BECOMES nested (a DOM move can nest an already-dressed panel) so a stale
 * inline url() — which beats the stylesheet de-nest rule — can never survive.
 * Guarded: no DOM write when there is nothing to clear.
 */
function undressNested(el: HTMLElement): void {
  if (el.style.backdropFilter) el.style.backdropFilter = '';
  delete el.dataset.lastQuickKey;
  byEl.delete(el);
  untrackWebgl(el);
}

/* ── Lever A: viewport-gated bend (zero visual loss) ─────────────────────
 * Offscreen panels keep blur-only; the url() re-attaches on re-entry from
 * the MAP_TABLE/FILTERS hit path (string ops, sub-frame). */
const VIEW_MARGIN = 300;

/** True when any part of the element lies within the viewport expanded by
 *  VIEW_MARGIN. Authoritative at flush time — IO timing can't be trusted at
 *  boot (entries fire after first paint). Read-only: stays in PHASE A. */
function isInExtendedViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return r.bottom > -VIEW_MARGIN && r.top < vh + VIEW_MARGIN && r.right > -VIEW_MARGIN && r.left < vw + VIEW_MARGIN;
}

/** Park an offscreen panel: clear the inline url() chain, forget the key so
 *  re-entry re-dresses. Guarded: no style write when already parked. */
function parkOffscreen(el: HTMLElement): void {
  // Drawn panels stay tracked (the frame loop culls by rect); CSS-backed
  // panels (glx*, floating, non-webgl) park exactly as they always have.
  if (renderMode === 'webgl' && webglDrawSet.has(el)) return;
  if (el.style.backdropFilter) el.style.backdropFilter = '';
  if (el.dataset.lastQuickKey) delete el.dataset.lastQuickKey;
  byEl.delete(el);
}

function shellAt(): HTMLElement | null {
  if (shellElCache && shellElCache.isConnected) return shellElCache;
  shellElCache = document.getElementById('app-teacher-shell');
  return shellElCache;
}

function tryInitWebgl(): void {
  if (glCanvas || webglBroken || !webglSupported || !mounted) return;
  if (!tierAllowsGlass()) return;
  const shell = shellAt();
  if (!shell) return;
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    canvas.id = 'glass-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    shell.insertBefore(canvas, shell.firstChild);
    const r = new GlassRenderer(canvas);
    /* Overscan (--glass-ov on the canvas): the sync translate moves the box
       by up to a frame of motion each way, so the shader must lay panels and
       the plate sample over a taller canvas — 0 when the engine has no
       scroll-driven animations (the @supports guard zeroes the token). */
    r.ov = parseFloat(getComputedStyle(canvas).getPropertyValue('--glass-ov')) || 0;
    canvas.addEventListener('webglcontextlost', () => shutdownWebgl(true), false);
    renderer = r;
    glCanvas = canvas;
    glReady = false;
    plateURL = plateURLForTheme();
    if (plateURL) {
      r.plateURL = plateURL;
      const url = plateURL;
      void r.setPlate(url).catch(() => r.retryPlate(url));
    }
    glRaf = requestAnimationFrame(glFrame);
  } catch {
    // Context creation failed even though the probe passed — stay on CSS
    // for the session; partial state must not leak.
    webglBroken = true;
    renderer = null;
    glCanvas = null;
    if (canvas) canvas.remove();
  }
}

/** Theme flip: re-load the plate artwork behind the atomic swap guard
 *  (setPlate has its own load-id race guard). */
function refreshPlate(): void {
  if (!renderer) return;
  const url = plateURLForTheme();
  if (url && url !== plateURL) {
    plateURL = url;
    renderer.plateURL = url;
    renderer.plateRetryCount = 0;
    glDirty = true; // the plate under the fixed canvas changed — repaint
    void renderer.setPlate(url).catch(() => renderer?.retryPlate(url));
  }
}

/** Effective opacity of the panel INCLUDING fading wrappers (motion sets
 *  opacity inline on the animated element and/or its parents; computed
 *  opacity is per-element, so the product up to the shell is the paint
 *  alpha). Reads only — runs inside the draw loop. */
function effectiveAlpha(el: HTMLElement): number {
  let a = 1;
  let n: HTMLElement | null = el;
  let guard = 0;
  while (n && n !== shellElCache && guard++ < 32) {
    const o = parseFloat(getComputedStyle(n).opacity);
    if (Number.isFinite(o) && o < 1) {
      a *= o;
      if (a < 0.01) return 0;
    }
    n = n.parentElement;
  }
  return a;
}

function glFrame(): void {
  glRaf = requestAnimationFrame(glFrame);
  const r = renderer;
  const canvas = glCanvas;
  if (!r || !canvas) return;
  if (!canvas.isConnected) {
    // The shell unmounted (route change) — park the whole path; CSS owns
    // whatever is on screen now, and a later shell re-inits from scratch.
    shutdownWebgl(false);
    return;
  }
  /* Resize first (cheap; it is a no-op unless the canvas box changed) and
     treat a real buffer re-allocation as a dirty frame — the buffer is
     cleared by the browser on resize. The REST of the frame (clear + panels)
     runs only past the idle gate below. NO backdrop draw: the canvas is
     GLASS-ONLY since the compositor scroll-sync — the plate stays the DOM
     layer UNDER the canvas (base.css), the shader samples it as a texture,
     and the translated canvas must never drag it. */
  const before = `${canvas.width}x${canvas.height}`;
  r.resizeFrame();
  const resized = before !== `${canvas.width}x${canvas.height}`;
  if (resized) glDirty = true;
  if (!glReady && r.hasPlate) {
    glReady = true;
    document.documentElement.dataset.glassRender = 'webgl';
    glDirty = true;
    // The atomic swap: from this frame the canvas paints these panels, so
    // their DOM backdrop-filter dies INLINE (the stylesheet strip cannot be
    // trusted — see applyPaintKill). CSS material held until this moment.
    for (const el of webglDrawSet) applyPaintKill(el);
  }
  if (!glReady) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = 96;

  /* Panel placement — LIVE layout rects, no lead term. The stale-vs-display
     correction now happens ON THE COMPOSITOR (see base.css sync keyframes):
     this frame paints at scrollY yNow and publishes yNow to --glass-sync;
     the compositor translates the canvas by (yNow − liveY) so the glass
     displays EXACTLY where the DOM is. Painting at the raw rect (rather
     than rect+lead) is required for correctness: the shader samples the
     plate texture in unmoved viewport coordinates, and rect.top already IS
     the panel's position at yNow.
     History: a display-time lead lived here for two generations; both were
     removed (v1 stuttered, v2's EMA decay read as "sliding ahead and easing
     back"). The lead is now exact and compositor-owned, not estimated. */
  const yNow = window.scrollY;
  const nowMs = performance.now();
  driftSample(yNow, nowMs, nowMs - lastGlFrameT);
  lastGlFrameT = nowMs;
  driftMarkPaint(yNow);

  /* IDLE GATE — do not repaint an unchanged frame. The canvas is fixed and
     full-viewport: repainting it at 60Hz while nothing moves burns GPU on
     every device and measurably LOWERS fps on the still frames (the panel
     under test measured fpsStill 36 < fpsScroll 52 — the loop was the
     cost). A frame is repainted only when one of these changed:
       · scroll position (panels are placed in viewport coords),
       · the draw set / geometry (layout, route, keepers),
       · a panel's alpha mid-fade (motion opacity),
       · the theme/plate (handled by the explicit dirty flag below),
       · a resize.
     Everything else skips the GL work entirely — the previous frame stays
     on screen, which is pixel-identical because nothing moved. */
  const aNow = webglDrawSet.size;
  const idleKey = `${yNow}|${aNow}|${drawnSig()}`;
  const alphaMoving = webglDrawSet.size > 0 && Array.from(webglDrawSet).some((el) => effectiveAlpha(el) < 0.999);
  if (!glDirty && idleKey === lastIdleKey && !alphaMoving) {
    lastDrawCount = lastDrawnCount;
    return;
  }
  lastIdleKey = idleKey;
  glDirty = false;

  /* Publish the sync state to the compositor — ONLY past the gate, because
     the var is a claim: "the pixels now being painted correspond to scroll
     offset yNow". The glass-sync timeline (base.css) reads it and translates
     the canvas by (painted − live) on the compositor clock, so painted glass
     is displayed exactly where the DOM is at display time — no trail, at any
     velocity. --glass-range is the scroller's travel: the timeline progress
     is normalized 0..1, so translate = yNow − progress·range must know the
     un-normalized range. Range uses clientHeight (NOT innerHeight): that is
     the exact denominator of the root scroll range and of the scroll()
     timeline. Engines without scroll-driven animations never reach this
     block (SCROLL_SYNC_SUPPORTED is false, and the @supports guard in
     base.css additionally disables the animation itself). */
  if (SCROLL_SYNC_SUPPORTED) {
    const range = Math.max(
      0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    /* Vars go on the CANVAS, not <html>: custom-property changes on the root
       invalidate style for the whole (inheriting) subtree — a per-frame
       full-document invalidation. On the canvas the invalidation is scoped
       to the single animated element. */
    if (range !== syncRange) {
      syncRange = range;
      canvas.style.setProperty('--glass-range', `${range}px`);
    }
    if (yNow !== syncPaintY) {
      syncPaintY = yNow;
      canvas.style.setProperty('--glass-sync', `${yNow}px`);
      (window as unknown as { __glassSyncPx?: number }).__glassSyncPx = yNow;
    }
  }

  // Past the gate: this frame is actually (re)painted.
  r.beginFrame();

  let drawn = 0;
  for (const el of webglDrawSet) {
    if (!el.isConnected) {
      webglDrawSet.delete(el);
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -M || rect.top > vh + M || rect.right < -M || rect.left > vw + M) continue;
    if (rect.width < 2 || rect.height < 2) continue;
    const entry = paintCache.get(el);
    if (!entry) continue;
    try {
      r.drawPanel(
        entry.kind,
        // Raw live rect: the compositor's sync translate places the canvas so
        // these pixels land exactly where the DOM is at display time. Any
        // per-panel lead on top of that would double-correct.
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        entry.params,
        effectiveAlpha(el),
      );
      drawn++;
    } catch {
      /* one bad geometry must not kill the loop */
    }
  }
  lastDrawCount = drawn;
  lastDrawnCount = drawn;
}

/** Tear the WebGL path down: canvas out, attr off, panels back on the CSS
 *  material. `lost` marks a context loss — permanent for the session; a
 *  route-driven teardown allows a later re-init. */
function shutdownWebgl(lost: boolean): void {
  if (glRaf) {
    cancelAnimationFrame(glRaf);
    glRaf = 0;
  }
  resetGlassDrift();
  // The sync vars live inline on the canvas element and die with it; reset
  // the module state so a later re-mount starts clean.
  syncPaintY = -1;
  syncRange = -1;
  if (renderer) {
    renderer.plateURL = ''; // stop any pending plate retries on a dead renderer
    try {
      renderer.dispose();
    } catch {
      /* context already gone */
    }
  }
  renderer = null;
  if (glCanvas) {
    glCanvas.remove();
    glCanvas = null;
  }
  glReady = false;
  lastDrawCount = 0;
  if (lost) webglBroken = true;
  document.documentElement.removeAttribute('data-glass-render');
  for (const el of Array.from(webglDrawSet)) untrackWebgl(el);
  webglDrawSet.clear();
  if (mounted) resyncGlass();
}

function pruneDead(): void {
  // Unobserve + untrack runs even when no filter was ever built: unmount is
  // about observer retention, not filter markup.
  for (const el of Array.from(tracked)) {
    if (!el.isConnected) {
      tracked.delete(el);
      // Stop observing the dead node: the observers hold strong refs, so
      // without this a removed panel is retained until the next resync.
      resizeObserver?.unobserve(el);
      viewObserver?.unobserve(el);
    }
  }
  for (const el of Array.from(webglDrawSet)) {
    if (!el.isConnected) webglDrawSet.delete(el);
  }
  const defs = chainDefs();
  if (!defs) return;
  const liveIds = new Set<string>();
  for (const el of tracked) {
    const id = byEl.get(el);
    if (id) liveIds.add(id);
  }
  for (const node of Array.from(defs.children)) {
    const id = node.getAttribute('id');
    if (!id || !id.startsWith('lg-')) continue;
    if (liveIds.has(id)) continue;
    node.remove();
    for (const [key, owned] of FILTERS) {
      if (owned === id) FILTERS.delete(key);
    }
  }
}

/* ───────────────────── mount ───────────────────── */

/** Full sweep — boot and theme/glass-tier flips only. Still batched. */
export function resyncGlass(): void {
  if (!mounted) return;
  // Path housekeeping first — a tier flip (settings) or a route with/without
  // the teacher shell lands here. WebGL is torn down when the tier drops;
  // nothing else about the CSS flow changes.
  if (tierAllowsGlass() && webglSupported && !webglBroken) {
    if (glCanvas) refreshPlate();
    else tryInitWebgl();
  } else if (glCanvas) {
    shutdownWebgl(false);
  }
  if (!glassAllowed() && !glCanvas) return;
  document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
    resizeObserver?.observe(el);
    viewObserver?.observe(el);
    queueSync(el);
  });
}

export function mountGlassEngine(): void {
  if (mounted) return;
  mounted = true;

  // The dress pipeline (glassSyncQueue) reaches engine state through this host.
  bindSyncQueue({
    stats,
    MAP_TABLE,
    FILTERS,
    byEl,
    filterUid: () => `lg-${++seq}`,
    getParams: () => defaultParams ?? (defaultParams = readParams()),
    ensuredContainer,
    chainOf,
    applyChain,
    undressNested,
    parkOffscreen,
    isInExtendedViewport,
    pruneDead,
  });

  // The WebGL staging (glassPipeline) reaches engine state through this host.
  bindPipeline({
    markDirty: () => {
      glDirty = true;
    },
    isGlReady: () => glReady,
    drawSet: webglDrawSet,
    byEl,
    paintCache,
    shellAt,
  });

  // The two-phase flush reaches engine state through this host.
  bindFlush({
    isMounted: () => mounted,
    tracked,
    setRenderMode: (mode) => {
      renderMode = mode;
    },
    webglSupported: () => webglSupported,
    webglBroken: () => webglBroken,
    getGlCanvas: () => glCanvas,
    tryInitWebgl,
    undressNested,
    parkOffscreen,
    isInExtendedViewport,
    pruneDead,
  });

  resizeObserver = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      // Rebuild only once the size STOPS changing. A tween reports a new
      // size every frame; we sync only when two consecutive rAF samples
      // agree, so a 200ms width animation costs one map, not 12.
      el.dataset.pendingSize = `${el.offsetWidth}x${el.offsetHeight}`;
      if (el.dataset.settleRaf) continue;
      el.dataset.settleRaf = '1';
      const tick = () => {
        const cur = el.dataset.pendingSize;
        if (cur === el.dataset.settleCheck) {
          el.dataset.settleRaf = '';
          el.dataset.settleCheck = '';
          if (el.dataset.lastSize !== cur) {
            el.dataset.lastSize = cur;
            queueSync(el);
          }
          return;
        }
        el.dataset.settleCheck = cur;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  attrObserver = new MutationObserver(() => resyncGlass());
  attrObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-glass'],
  });

  // Lever A: viewport gate. Entry re-queues (re-dress is a cache hit, no
  // worker build); EXIT parks immediately — guarded style clear, no layout,
  // so an offscreen panel stops burning its filter on the same frame it
  // leaves the 300px band instead of waiting for the next resize/DOM queue.
  // Entries arriving while !mounted or glass-off are safe: queueSync is
  // already a no-op there, and parkOffscreen on an undressed panel writes
  // nothing.
  viewObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (!el.isConnected) continue;
        if (e.isIntersecting) queueSync(el);
        else parkOffscreen(el);
      }
    },
    { rootMargin: `${VIEW_MARGIN}px 0px` },
  );

  // Only elements that actually APPEARED are enqueued. No querySelectorAll,
  // no whole-document sweep — this observer used to be the largest single
  // source of forced layouts in the app.
  domObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Removals: if a tracked panel left the DOM, schedule a prune so the
      // Set (a strong-ref holder) does not keep dead nodes alive.
      if (m.removedNodes.length) {
        for (const n of m.removedNodes) {
          const el = n as Element | null;
          if (!el || el.nodeType !== 1) continue;
          if (tracked.has(el as HTMLElement) || el.querySelector?.(GLASS_SELECTOR)) {
            requestFlush();
            break;
          }
        }
      }
      if (!m.addedNodes.length) continue;
      for (const n of m.addedNodes) {
        const el = n as Element | null;
        if (!el || el.nodeType !== 1) continue;
        if (el.matches?.(GLASS_SELECTOR)) {
          resizeObserver?.observe(el as HTMLElement);
          viewObserver?.observe(el as HTMLElement);
          queueSync(el as HTMLElement);
        }
        for (const inner of el.querySelectorAll?.(GLASS_SELECTOR) ?? []) {
          resizeObserver?.observe(inner as HTMLElement);
          viewObserver?.observe(inner as HTMLElement);
          queueSync(inner as HTMLElement);
        }
      }
    }
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  resyncGlass();
}

export function unmountGlassEngine(): void {
  mounted = false;
  shutdownWebgl(false);
  resizeObserver?.disconnect();
  resizeObserver = null;
  attrObserver?.disconnect();
  attrObserver = null;
  domObserver?.disconnect();
  domObserver = null;
  viewObserver?.disconnect();
  viewObserver = null;
  terminateWorker();
  revokeAllBlobs();
  tracked.clear();
  clearPendingSync();
  clearChainDefs();
  defaultParams = null;
}

// Re-export so the tuner / tests can reach the pieces directly.
export {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  mapCornerExp,
} from './lensEngine';
export type { LensParams } from './lensEngine';
export type { GlassEngineStats, PerfReport } from './perfReporterTypes';
