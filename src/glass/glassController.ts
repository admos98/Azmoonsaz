/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — BATCHED EDITION. Batched dress pipeline over
 * cached exact-size maps; the primary renderer is the WebGL2 shader
 * (webglRenderer.ts). Leaf modules: glassTokens (style readers), glassDrift
 * (?perf=1 waveform), glassMaps (caches), glassSyncQueue (dress+worker),
 * glassChain (CSS recipes), glassPipeline (webgl staging), glassFlush
 * (two-phase batch). Design history: docs/glass-engine.md.
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
  parentPaintFor,
  plateSerialization,
  plateURLForTheme,
  tierAllowsGlass,
  untrackWebgl,
} from './glassPipeline';
import {
  bootChrome,
  chromeStats,
  refreshChromePlate,
  shutdownChrome,
  tickChrome,
  untrackChrome,
} from './glassChrome';

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
  /** M2-A: non-null when this panel is a canvas CHILD of a drawn parent —
   *  the frame loop draws children after parents and freezes the parent's
   *  dim/fill into their backdrop. */
  childOf?: HTMLElement;
}

/** Paint capability — settled before first paint by the boot probe
 *  (public/boot.js → html[data-paint]) with an inline fallback for a boot
 *  without the script. Pure WebGL2 capability: the lab-validated renderer
 *  beats the url() raster path even on software stacks; lite/off tiers are
 *  the perf valve. */
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
/** M2-A: canvas children drawn in the last frame (the anchored sub-panels). */
let drawnChildCount = 0;

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
/** The scroll offset the last painted frame was drawn for — published to
 *  --glass-sync at paint time. -1 = nothing painted yet (the var must not
 *  exist before the first real paint, or the canvas translates early). */
let syncPaintY = -1;
/** The scroller's travel (scrollHeight − clientHeight), published to
 *  --glass-range: the timeline progress is normalized 0..1, and
 *  `translate(painted − progress·range)` needs the un-normalized form. */
let syncRange = -1;
let webglBroken = false;
let shellElCache: HTMLElement | null = null;
let plateURL = '';
const paintCache = new WeakMap<HTMLElement, PaintEntry>();
const webglDrawSet = new Set<HTMLElement>();

/* Engine counters — the ?perf=1 oracle: posted = builds sent to the worker,
   hits = panels dressed from cache, worker = from worker maps, sync = panels
   that paid the main-thread data-URI fallback. Read via glassStats(). */
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
    drawnChildren: drawnChildCount,
    chrome: chromeStats(),
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
 * BECOMES nested (a DOM move nests an already-dressed panel) so a stale
 * inline url() — which beats the stylesheet de-nest rule — never survives.
 * Guarded: no DOM write when there is nothing to clear.
 */
function undressNested(el: HTMLElement): void {
  if (el.style.backdropFilter) el.style.backdropFilter = '';
  delete el.dataset.lastQuickKey;
  byEl.delete(el);
  untrackWebgl(el);
  untrackChrome(el);
}

/* ── Lever A: viewport-gated bend (zero visual loss) ─────────────────────
 * Offscreen panels keep blur-only; the url() re-attaches on re-entry from
 * the MAP_TABLE/FILTERS hit path (string ops, sub-frame). */
const VIEW_MARGIN = 300;

/** True when any part of the element lies in the viewport + VIEW_MARGIN.
 *  Authoritative at flush time (IO timing can't be trusted at boot). */
function isInExtendedViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return r.bottom > -VIEW_MARGIN && r.top < vh + VIEW_MARGIN && r.right > -VIEW_MARGIN && r.left < vw + VIEW_MARGIN;
}

/** Park an offscreen panel: clear the inline url() chain, forget the key so
 *  re-entry re-dresses. Guarded: no style write when already parked. */
function parkOffscreen(el: HTMLElement): void {
  // Drawn panels stay tracked (the loop culls by rect); CSS-backed ones
  // (glx*, floating, non-webgl) park as they always have.
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
    /* Overscan: the sync translate moves the box up to a frame of motion;
       the shader lays panels over a taller canvas (0 without the sync). */
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
  // The chrome plane boots behind the main one (its context loss is
  // non-fatal; see glassChrome.ts).
  bootChrome();
}

/** Theme flip: re-load both plates behind the load-id race guards. */
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
  refreshChromePlate();
}

/** Effective opacity of the panel INCLUDING fading wrappers (computed
 *  opacity is per-element; the product up to the shell is the paint alpha).
 *  Read-only — runs inside the draw loop. */
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
  tickChrome();
  if (!canvas.isConnected) {
    // The shell unmounted (route change) — park the whole path; CSS owns
    // whatever is on screen now, and a later shell re-inits from scratch.
    shutdownWebgl(false);
    return;
  }
  /* Resize first (no-op unless the box changed); a real buffer re-allocation
     is dirty — the browser clears it. The rest runs only past the idle gate.
     NO backdrop draw: GLASS-ONLY canvas since the sync — the plate stays the
     DOM layer UNDER the canvas; a translated canvas must never drag it. */
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
     correction happens ON THE COMPOSITOR (base.css sync keyframes): this
     frame paints at yNow and publishes it to --glass-sync, so the glass
     displays exactly where the DOM is. Raw rects are required: the shader
     samples the plate in unmoved viewport coordinates, and rect.top already
     IS the panel's position at yNow. (A display-time lead lived here for two
     generations; both removed — v1 stuttered, v2 eased back.) */
  const yNow = window.scrollY;
  const nowMs = performance.now();
  driftSample(yNow, nowMs, nowMs - lastGlFrameT);
  lastGlFrameT = nowMs;
  driftMarkPaint(yNow);

  /* IDLE GATE — do not repaint an unchanged frame. Repainting a fixed
     full-viewport canvas at 60Hz while nothing moves burns GPU and MEASURABLY
     LOWERS still fps (panel under test: 36 still < 52 scroll). Repaint only
     when scroll, draw set/geometry, a mid-fade alpha, the theme/plate, or a
     resize changed; otherwise skip the GL work (the previous frame stays
     on screen, pixel-identical because nothing moved). */
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
     the var is a claim: "the pixels now painted correspond to scroll offset
     yNow". The glass-sync timeline translates the canvas by (painted − live)
     on the compositor clock, so painted glass displays exactly where the DOM
     is at any velocity. Range uses clientHeight (the exact denominator of the
     root scroll range and of the scroll() timeline). Engines without
     scroll-driven animations never reach this block. */
  if (SCROLL_SYNC_SUPPORTED) {
    const range = Math.max(
      0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    /* Vars live on the CANVAS, not <html>: a root custom-property change
       invalidates style for the whole subtree per frame; here it is scoped
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

  /* Two passes (M2-A): parents first, then their glass children ON TOP —
     the child must not be trampled by its parent drawn later; a child whose
     host is culled/unmounted is skipped with it (it samples the parent's
     terms, so a parent-less child would paint a wrong station). */
  let drawn = 0;
  let childCount = 0;
  const kids: { el: HTMLElement; entry: PaintEntry }[] = [];
  for (const el of webglDrawSet) {
    if (!el.isConnected) {
      webglDrawSet.delete(el);
      continue;
    }
    const entry = paintCache.get(el);
    if (!entry) continue;
    if (entry.childOf) {
      kids.push({ el, entry });
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -M || rect.top > vh + M || rect.right < -M || rect.left > vw + M) continue;
    if (rect.width < 2 || rect.height < 2) continue;
    try {
      r.drawPanel(
        entry.kind,
        // Raw live rect: the compositor's sync translate places the canvas so
        // these pixels land exactly where the DOM is at display time.
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        entry.params,
        effectiveAlpha(el),
      );
      drawn++;
    } catch {
      /* one bad geometry must not kill the loop */
    }
  }
  for (const { el, entry } of kids) {
    const parentEntry = entry.childOf ? paintCache.get(entry.childOf) : null;
    if (!parentEntry) continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -M || rect.top > vh + M || rect.right < -M || rect.left > vw + M) continue;
    if (rect.width < 2 || rect.height < 2) continue;
    try {
      r.drawPanel(
        entry.kind,
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        entry.params,
        effectiveAlpha(el),
        // The parent's frozen frost rides as the child's backdrop (M2-A).
        parentPaintFor(entry.childOf as HTMLElement, parentEntry, el),
      );
      drawn++;
      childCount++;
    } catch {
      /* one bad geometry must not kill the loop */
    }
  }
  lastDrawCount = drawn;
  lastDrawnCount = drawn;
  drawnChildCount = childCount;
}

/** Tear the WebGL path down (canvas out, attr off, CSS resumes). `lost` is a
 *  context loss — permanent; route-driven teardown allows a later re-init. */
function shutdownWebgl(lost: boolean): void {
  if (glRaf) {
    cancelAnimationFrame(glRaf);
    glRaf = 0;
  }
  resetGlassDrift();
  // Sync vars die with the canvas; reset module state for a clean re-mount.
  syncPaintY = -1;
  syncRange = -1;
  shutdownChrome(lost);
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
  // Unobserve + untrack runs even when no filter was ever built (observer
  // retention, not filter markup).
  for (const el of Array.from(tracked)) {
    if (!el.isConnected) {
      tracked.delete(el);
      // unobserve the dead node — the observers hold strong refs.
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
  // Path housekeeping first — a tier flip or a route without the teacher
  // shell; WebGL is torn down when the tier drops, the CSS flow is unchanged.
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

  // Hosts: data flows DOWN from engine state (bind* are idempotent).
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

  // The WebGL staging host.
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
      // Rebuild once size STOPS changing (tweens settle in one map, not 12).
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

  // Lever A: viewport gate. Entry re-queues (cache hit); EXIT parks
  // immediately (guarded clear, no layout). Entries while unmounted or
  // glass-off are safe no-ops.
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

  // Only elements that actually APPEARED are enqueued (no whole-document
  // sweep — this observer used to be the app's largest source of forced
  // layouts).
  domObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Removals: schedule a prune when a tracked panel left the DOM (the
      // Set holds strong refs — dead nodes must not be retained).
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
