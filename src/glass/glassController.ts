/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — BATCHED EDITION.
 *
 * Displacement + specular maps are built from the panel's own size, cached by
 * (kind, size, radius), and every panel points its inline backdrop-filter at
 * `blur() saturate() url(#shared)`.
 *
 * ── Why this was slow, and what changed ──────────────────────────────────
 * A real-session profile (?perf=1) on /teacher/settings/questions measured
 * 27fps avg, 59% janky frames and 121 long tasks (11.9s blocked over 100s).
 * The worst frames had NOTHING animating (tr: 0, an: 0), which ruled out both
 * the filter graph and the CSS animations:
 *
 *   Every DOM mutation anywhere under body scheduled a FULL-document sweep.
 *   The sweep ran sync() over every glass element, and sync() read
 *   offsetWidth/offsetHeight (forces layout) then wrote style.backdropFilter
 *   (invalidates layout) — per element, in a loop. 33 glass surfaces meant 33
 *   forced layouts per sweep, on every mutation. Layout thrash, not glass.
 *
 * The fix is in three parts, none of which touch a pixel:
 *
 *   1. Batched, deduped queue. Mutations enqueue only the elements that
 *      actually appeared; nothing scans the whole document. Queued panels are
 *      measured in ONE read-only phase (a single forced layout for the whole
 *      batch), then written in a second phase — the read/write split that
 *      removes the thrash entirely.
 *
 *   2. No querySelectorAll in the mutation path. Added subtrees are walked
 *      once on entry; tracked elements live in a Set so pruning dead filters
 *      never walks the DOM tree either.
 *
 *   3. Map builds + PNG encodes run in a Worker (mapWorker.ts). The pixel
 *      loop (borderSDF pow/sqrt per px) + two deflate encodes per new size
 *      were the remaining main-thread cost (~4.2s of long tasks over 66s in
 *      the ?perf=1 report). Panels rest on their CSS blur base until the
 *      maps arrive — one repaint, no flash — and the sync data-URI path
 *      survives only as the no-Worker fallback.
 *
 * The playground's physics survive intact: same mapMath, same curvature
 * exponent (n = 2^k, Chromium-verified), same specular arc, same bezel ring.
 *
 * ── Lever A: the bend is viewport-gated (2026-10-09) ──────────────────────
 * A ?perf=1 drive on /teacher/dashboard showed 13fps scroll vs 36fps still
 * with 73/80 worst frames carrying NO longtask: pure raster cost. Four lens
 * panels held ~2M px of live url() area — a full viewport of ~10-primitive
 * SVG graph per scroll frame — while one 1204x261 panel sat fully offscreen
 * still burning its filter. The engine observed resize + DOM only, so
 * offscreen panels kept their bend forever.
 *
 * An IntersectionObserver (300px pre-dress margin) parks offscreen panels:
 * inline url() chain cleared, lastQuickKey forgotten. Re-entry re-dresses
 * from the MAP_TABLE/FILTERS hit path (string ops, sub-frame — zero worker
 * rebuild), and the margin means the bend is attached before pixels turn
 * visible. Resting in-view output is byte-identical: zero visual loss by
 * construction. A flush-time rect check is authoritative (IO timing can't be
 * trusted at boot); a dress-time guard covers worker maps resolving while
 * offscreen.
 */

import {
  buildDisplacementMap,
  buildFilterMarkup,
  buildSpecularMap,
  computeProfile,
  imageDataToURL,
  mapCornerExp,
  mapDPR,
  mapScaleFor,
  type LensParams,
} from './lensEngine';
import type { MapBuildRequest, MapBuildResponse } from './mapWorker';
import { GlassRenderer, type GlassKind, type GlassPaintParams } from './webglRenderer';

/* ───────────────────── Ladder ───────────────────── */

interface BucketEntry {
  dispURL: string | null; // null for 'pane' (rim-only by design)
  specURL: string;
  maxAbs: number;
}

/** `${kind}|${w}x${h}|${radius}` -> exact-size maps. Built lazily on first
 *  sight of a panel size and REUSED by every later panel of that size (card
 *  grids, rows of same-height buttons share one map + one filter graph).
 *
 *  Why exact size: the ring's CSS-px position and the superellipse curvature
 *  are computed against the panel's real rect; a stretched canned-aspect map
 *  lands the bezel ramp at the wrong width on each axis and the corner
 *  departs from the painted border (the "rim ≠ panel size" bug). */
const MAP_TABLE = new Map<string, BucketEntry>();

/** `${kind}|${w}x${h}|${radius}|${withDim}|${specOpacity}|${specSat}|${dim}` -> filter id */
const FILTERS = new Map<string, string>();

const byEl = new WeakMap<Element, string>();

/** Every element we have dressed. A Set (not just the WeakMap) so pruning
 *  dead filters can iterate our own bookkeeping instead of the DOM tree. */
const tracked = new Set<HTMLElement>();

let mounted = false;
let resizeObserver: ResizeObserver | null = null;
let attrObserver: MutationObserver | null = null;
let domObserver: MutationObserver | null = null;
let viewObserver: IntersectionObserver | null = null;
let container: SVGDefsElement | null = null;
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

let renderMode: RenderMode = 'css';
let renderer: GlassRenderer | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let glRaf = 0;
let glReady = false;
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

export interface GlassEngineStats {
  posted: number;
  hits: number;
  worker: number;
  sync: number;
  maps: number;
  inflight: number;
  filters: number;
  /** Active paint path and panels drawn in the last WebGL frame. */
  mode: 'webgl' | 'css';
  drawn: number;
  /** Boot triage — WHY the active path is what it is. Travels into the
   *  ?perf=1 report (engine.boot) so a field run on an engine the dev
   *  machine cannot reproduce (iPhone/iPad Safari, Lockdown Mode, Reduce
   *  Transparency) still answers: probe vs tier vs lost context vs plate. */
  boot: {
    /** html[data-paint] as published by public/boot.js before first paint. */
    probe: string | null;
    /** The controller's resolved WebGL2 capability (probe first, own context after). */
    supported: boolean;
    /** A context failed or was lost this session — WebGL is off until reload. */
    broken: boolean;
    /** html[data-glass] tier (full | lite | off | '(unset)'). */
    tier: string;
    /** html[data-lens] — the classic url() bend gate (Chromium >= 138 only). */
    lens: string | null;
    /** The draw canvas exists. */
    canvas: boolean;
    /** The atomic swap landed (plate texture uploaded, canvas visible). */
    ready: boolean;
    /** Plate-load pipeline stage: 'ok' once the texture is up; 'img-err' /
     *  'timeout' / 'no-2d' / 'raster-err' / 'tex-err' name the failing step
     *  when the swap never lands. null = no renderer yet. */
    plate: string | null;
    /** Plate retries consumed this session (bounded backoff). */
    plateRetries: number;
    /** Which plate source landed the texture: 'svg' (vector decode) or
     *  'raster' (the .2x.webp twin — the iPhone path). null = none yet. */
    plateSrc: 'svg' | 'raster' | null;
    /** The teacher shell exists on this route (the shader needs it). */
    shell: boolean;
  };
}

/** Snapshot of the map pipeline — consumed by the ?perf=1 report. */
export function glassStats(): GlassEngineStats {
  return {
    posted: stats.posted,
    hits: stats.hits,
    worker: stats.worker,
    sync: stats.sync,
    maps: MAP_TABLE.size,
    inflight: inflight.size,
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
      shell: shellAt() !== null,
    },
  };
}

const GLASS_SELECTOR = '.lens, .pane, .drop, .glx, .glx-strong, .glx-dark';

/* ───────────────────── boot: params ───────────────────── */

function defaultParamsFromRoot(): LensParams {
  const cs = getComputedStyle(document.documentElement);
  return {
    bezel: cssNum(cs, '--lens-bezel', 14),
    thickness: cssNum(cs, '--lens-thickness', 66),
    refraction: cssNum(cs, '--lens-refraction-level', 0.7),
    scaleRatio: cssNum(cs, '--lens-scale-ratio', 1),
    specOpacity: cssNum(cs, '--lens-spec-opacity', 0.2),
    specSaturation: cssNum(cs, '--lens-spec-saturation', 4),
    specAngle: cssNum(cs, '--lens-spec-angle', -60),
    specPeak: cssNum(cs, '--lens-spec-peak', 1),
    cornerExp: cssNum(cs, '--corner-exp', 3),
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: [103, 100, 112],
  };
}

/** Build one panel's exact-size map pair once; reuse thereafter. Cheap —
 *  a 200x400 panel is one 80k px loop, sub-frame. Cards/rows of the same
 *  size share the single cached entry.
 *
 *  ASYNC path: posts to mapWorker, resolves with blob: URLs when the maps
 *  arrive. The sync data-URI build below is the no-Worker fallback only —
 *  pixels are identical (same mapMath, same inputs). */
function buildBucketSync(kind: 'lens' | 'pane' | 'drop', w: number, h: number, radius: number): BucketEntry {
  // key on exact size — every panel gets the rim and corners at its own
  // geometry (playground contract). Tween-storm on resize is already killed
  // by the quantized idempotent key in sync().
  const key = `${kind}|${w}x${h}|${Math.round(radius)}`;
  const hit = MAP_TABLE.get(key);
  if (hit) return hit;
  const p = defaultParams ?? (defaultParams = defaultParamsFromRoot());
  const cornerExp = mapCornerExp(p.cornerExp, CORNER_SHAPE_SUPPORTED);
  const prof = computeProfile(p.bezel, p.thickness);
  const r = radius >= 9999 ? Math.min(w, h) / 2 : Math.min(radius, Math.min(w, h) / 2 - 1);
  // Map resolution contract (playground parity): build the maps at the
  // display DPR (1..2 device px per CSS px), capped by MAX_MAP_SIDE. feImage
  // then paints them at W×H CSS px, so the rim lands exactly on the border at
  // full density. Building at scale 1 made every rim a 1x bitmap upscaled by
  // the browser on a 2x display — the soft, "low quality" ring.
  const scale = mapDPR() * mapScaleFor(w, h);
  let dispURL: string | null = null;
  let maxAbs = 1;
  if (kind !== 'pane') {
    const dm = buildDisplacementMap(w, h, r, p.bezel, prof, scale, cornerExp);
    maxAbs = dm.maxAbs;
    dispURL = imageDataToURL(dm.img);
  }
  const specURL = imageDataToURL(
    buildSpecularMap(w, h, r, p.specAngle, scale, p.specPeak, cornerExp),
  );
  const entry: BucketEntry = { dispURL, specURL, maxAbs };
  MAP_TABLE.set(key, entry);
  return entry;
}

/* ───────────────────── helpers ───────────────────── */

const CORNER_SHAPE_SUPPORTED =
  typeof CSS !== 'undefined' &&
  CSS.supports?.('corner-shape', 'superellipse(3)') === true;

function cssNum(cs: CSSStyleDeclaration, name: string, fallback: number): number {
  const v = parseFloat(cs.getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

function radiusOf(el: HTMLElement, cs: CSSStyleDeclaration, fallback: number): number {
  const raw = (cs.borderRadius || '').trim().split(/[\s/]+/)[0];
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  if (raw.endsWith('%')) return (n / 100) * Math.min(el.offsetWidth, el.offsetHeight);
  return n;
}

function kindOf(el: Element): 'lens' | 'pane' | 'drop' | null {
  if (el.classList.contains('lens')) return 'lens';
  if (el.classList.contains('pane')) return 'pane';
  if (el.classList.contains('drop')) return 'drop';
  if (el.classList.contains('glx-strong') || el.classList.contains('glx-dark') || el.classList.contains('glx'))
    return 'lens';
  return null;
}

/**
 * True when the element sits inside another glass surface. A parent with
 * backdrop-filter is a BACKDROP ROOT: the child can only sample the parent's
 * own flat fill, so a url() bend attached here bends a flat field (no visible
 * refraction) while the full ~10-primitive SVG graph still runs per frame per
 * surface. The engine never dresses these — their CSS quiet material owns
 * them, at zero filter cost.
 */
function isNestedGlass(el: Element): boolean {
  return !!el.parentElement?.closest?.(GLASS_SELECTOR);
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

function chainOf(el: Element, cs: CSSStyleDeclaration): string {
  const lensBlur = cssNum(cs, '--lens-blur', 1);
  const sat = (v: number) => (v === 1 ? '' : ` saturate(${v})`);
  if (el.classList.contains('glx-strong'))
    return `blur(${cssNum(cs, '--glass-p-blur', 16).toFixed(2)}px)${sat(cssNum(cs, '--glass-p-sat', 1.5))}`;
  if (el.classList.contains('glx-dark')) return 'blur(10px) saturate(1.4)';
  if (el.classList.contains('glx'))
    return `blur(${cssNum(cs, '--glass-bg-blur', 8).toFixed(2)}px)${sat(cssNum(cs, '--glass-bg-sat', 1.5))}`;
  if (el.classList.contains('lens')) {
    if (el.classList.contains('lens--menu'))
      return `blur(${cssNum(cs, '--lens-menu-blur', 8).toFixed(2)}px)`;
    return `blur(${lensBlur.toFixed(2)}px)`;
  }
  if (el.classList.contains('pane')) return `blur(${(lensBlur * 2).toFixed(2)}px)`;
  if (el.classList.contains('drop')) return `blur(${cssNum(cs, '--drop-blur', 0.5).toFixed(2)}px)`;
  return `blur(${lensBlur.toFixed(2)}px)`;
}

function ensuredContainer(): SVGDefsElement {
  if (container && document.contains(container)) return container;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  container = defs;
  return container;
}

function applyChain(el: HTMLElement, chain: string): void {
  if (el.style.backdropFilter !== chain) el.style.backdropFilter = chain;
}

function glassAllowed(): boolean {
  const root = document.documentElement;
  return root.dataset.lens === 'on' && root.dataset.glass !== 'lite' && root.dataset.glass !== 'off';
}

/* ── WebGL paint path — the primary renderer ────────────────────────────
 * The shader (webglRenderer.ts) draws the fixed page plate plus every
 * in-flow .lens/.pane/.drop panel whose true backdrop IS the plate:
 * nothing floats above it, nothing clips it, no ancestor paints over the
 * plane. Everything else — glx* families (their bloom lines are CSS),
 * floating/sticky panels, scroll/clip containers, non-shell routes — stays
 * exactly as it is on the CSS path. Drawn panels go transparent via
 * html[data-glass-render='webgl'] [data-glass-paint='webgl'] only once the
 * plate texture has landed (the swap is atomic: canvas on, plate ::before
 * off, panels transparent). A lost context reverts to the classic path. */

function shellAt(): HTMLElement | null {
  if (shellElCache && shellElCache.isConnected) return shellElCache;
  shellElCache = document.getElementById('app-teacher-shell');
  return shellElCache;
}

function tierAllowsGlass(): boolean {
  const tier = document.documentElement.dataset.glass;
  return tier !== 'lite' && tier !== 'off';
}

/** Drawable class → kind; glx* are excluded on purpose (blur-only CSS). */
function webglKindOf(el: Element): GlassKind | null {
  const cl = el.classList;
  if (cl.contains('glx') || cl.contains('glx-strong') || cl.contains('glx-dark')) return null;
  if (cl.contains('lens')) return 'lens';
  if (cl.contains('pane')) return 'pane';
  if (cl.contains('drop')) return 'drop';
  return null;
}

/** True when the panel's backdrop is provably the plate: in flow inside the
 *  shell, no fixed/sticky/absolute ancestor, no clip/scroll ancestor, no
 *  ancestor painting a fill or artwork over the plate plane. Conservative on
 *  purpose — a panel left on the CSS path is a smaller bug than a panel
 *  showing the wrong layer. */
function webglPlaceable(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  const ownPos = cs.position;
  if (ownPos === 'fixed' || ownPos === 'sticky' || ownPos === 'absolute') return false;
  const shell = shellAt();
  if (!shell) return false;
  let n = el.parentElement;
  while (n && n !== shell) {
    const acs = getComputedStyle(n);
    const p = acs.position;
    if (p === 'fixed' || p === 'sticky' || p === 'absolute') return false;
    if (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') return false;
    if (acs.backgroundImage !== 'none') return false;
    const bg = acs.backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) return false;
    n = n.parentElement;
  }
  return n === shell;
}

/** The panel's shader recipe — the same tokens chainOf() reads for the CSS
 *  chain, in numeric form. `sat` stays at the lab's 1.15: drawn families
 *  carry no saturate() in their base chains. dpr mirrors the CSS map build
 *  (mapDPR caps 1..2 by viewport). */
function paramsForWebgl(el: HTMLElement, cs: CSSStyleDeclaration): GlassPaintParams {
  const lensBlur = cssNum(cs, '--lens-blur', 1);
  let blur: number;
  if (el.classList.contains('lens--menu')) blur = cssNum(cs, '--lens-menu-blur', 6);
  else if (el.classList.contains('pane')) blur = lensBlur * 2;
  else if (el.classList.contains('drop')) blur = cssNum(cs, '--drop-blur', 0.5);
  else blur = lensBlur;
  return {
    bezel: cssNum(cs, '--lens-bezel', 14),
    thickness: cssNum(cs, '--lens-thickness', 66),
    refraction: cssNum(cs, '--lens-refraction-level', 0.7),
    scaleRatio: cssNum(cs, '--lens-scale-ratio', 1),
    specOpacity: cssNum(cs, '--lens-spec-opacity', 0.2),
    specSaturation: cssNum(cs, '--lens-spec-saturation', 4),
    specAngle: cssNum(cs, '--lens-spec-angle', -60),
    specPeak: cssNum(cs, '--lens-spec-peak', 1),
    cornerExp: cssNum(cs, '--corner-exp', 3),
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: [103, 100, 112],
    blur,
    sat: 1.15,
    fillA1: cssNum(cs, '--glass-fill', 0),
    fillA2: cssNum(cs, '--glass-fill', 0),
    fillAngle: cssNum(cs, '--glass-p-angle', 180),
    radius: radiusOf(el, cs, cssNum(cs, '--lens-radius', 21)),
    dpr: mapDPR(),
    cornerShapeSupported: CORNER_SHAPE_SUPPORTED,
  };
}

/** Track a panel into the per-frame draw list. The engine writes NO inline
 *  backdrop-filter in WebGL mode: any chain from an earlier CSS flush is
 *  cleared and the stylesheet keeps showing the material until the atomic
 *  swap turns [data-glass-paint] panels transparent. */
function trackWebgl(el: HTMLElement, kind: GlassKind, params: GlassPaintParams): void {
  paintCache.set(el, { kind, params });
  webglDrawSet.add(el);
  if (el.dataset.glassPaint !== 'webgl') el.dataset.glassPaint = 'webgl';
  if (el.style.backdropFilter) el.style.backdropFilter = '';
  if (el.dataset.lastQuickKey) delete el.dataset.lastQuickKey;
  byEl.delete(el);
}

function untrackWebgl(el: HTMLElement): void {
  webglDrawSet.delete(el);
  if (el.dataset.glassPaint) delete el.dataset.glassPaint;
}

function plateURLForTheme(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--page-plate').trim();
  const m = /url\((['"]?)(.*?)\1\)/.exec(raw);
  return m ? m[2] : '';
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
  r.beginFrame();
  r.drawBackdrop();
  if (!glReady && r.hasPlate) {
    glReady = true;
    document.documentElement.dataset.glassRender = 'webgl';
  }
  if (!glReady) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = 96;
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
}

/** Tear the WebGL path down: canvas out, attr off, panels back on the CSS
 *  material. `lost` marks a context loss — permanent for the session; a
 *  route-driven teardown allows a later re-init. */
function shutdownWebgl(lost: boolean): void {
  if (glRaf) {
    cancelAnimationFrame(glRaf);
    glRaf = 0;
  }
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
  for (const el of webglDrawSet) {
    if (el.dataset.glassPaint) delete el.dataset.glassPaint;
  }
  webglDrawSet.clear();
  if (mounted) resyncGlass();
}

/* ───────────────────── batched sync ───────────────────── */

interface PendingPanel {
  el: HTMLElement;
  kind: 'lens' | 'pane' | 'drop';
  w: number;
  h: number;
  radius: number;
  p: LensParams;
  chainBase: string;
  withDim: boolean;
  quickKey: string;
}

const pendingSync = new Set<HTMLElement>();
let flushQueued = false;

/** Enqueue one panel. Deduped by element, coalesced to a single rAF. */
function queueSync(el: HTMLElement): void {
  if (!mounted) return;
  tracked.add(el);
  if (!el.isConnected) return;
  pendingSync.add(el);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(flushSync);
}

/**
 * Two-phase flush — the fix for the layout thrash.
 *
 *   PHASE A reads every panel's box and computed style with ZERO writes in
 *   between, so the whole batch costs ONE forced layout instead of one per
 *   panel — except nested panels, which are undressed here (a guarded style
 *   clear, no layout) before any measurement. Panels whose quickKey is
 *   unchanged are dropped here, so a mutation touching one panel never
 *   re-measures the other 32.
 *
 *   PHASE B dresses cache hits inline (string ops, sub-frame). Cache misses
 *   post to the map worker and return — zero map math on this thread.
 */
function flushSync(): void {
  flushQueued = false;
  if (!mounted) return;

  // Path choice, resolved fresh every flush: WebGL2 + full glass tier = the
  // shader path; anything else = the CSS path below, untouched. renderMode
  // is what parkOffscreen / IO callbacks test between flushes.
  const wantWebgl = tierAllowsGlass() && webglSupported && !webglBroken;
  if (wantWebgl && !glCanvas) tryInitWebgl();
  const useWebgl = wantWebgl && glCanvas !== null;
  renderMode = useWebgl ? 'webgl' : 'css';

  if (!useWebgl && !glassAllowed()) {
    pendingSync.clear();
    return;
  }

  const batch = Array.from(pendingSync);
  pendingSync.clear();

  /* PHASE A — READ ONLY */
  const todo: PendingPanel[] = [];
  const glTodo: { el: HTMLElement; kind: GlassKind; params: GlassPaintParams }[] = [];
  for (const el of batch) {
    if (!el.isConnected) {
      tracked.delete(el);
      continue;
    }
    const kind = kindOf(el);
    if (!kind) continue;
    // Nested glass samples only the parent's flat fill — the bend is
    // invisible there, so never dress or draw it. Strip any stale inline
    // chain first: inline style beats the stylesheet de-nest rule, so a
    // panel that BECAME nested (DOM move) would otherwise keep burning a
    // filter forever. Checked BEFORE getComputedStyle: a DOM walk, zero
    // forced layout.
    if (isNestedGlass(el)) {
      undressNested(el);
      continue;
    }
    if (useWebgl) {
      // WebGL branch — the panel is tracked into the per-frame draw list
      // (reads only here; DOM writes happen in PHASE B). Panels the shader
      // cannot serve fall THROUGH to the classic CSS dress path instead:
      // glx* families (their bloom lines and url() bend stay exactly as
      // today), floating/sticky/absolute panels, clipped or painted-over
      // backdrops. On engines below the url() gate they skip that too and
      // keep the pure stylesheet material — today's behavior, unchanged.
      const wk = webglKindOf(el);
      const cs = getComputedStyle(el);
      if (wk && webglPlaceable(el, cs)) {
        glTodo.push({ el, kind: wk, params: paramsForWebgl(el, cs) });
        continue;
      }
      // Not shader-served: hand it back to the CSS path BEFORE the offscreen
      // gate below, so a formerly-drawn panel (DOM move, class swap) parks
      // and re-dresses exactly like any other CSS panel. Attribute/style
      // clears are layout-free.
      if (el.dataset.glassPaint) untrackWebgl(el);
      if (!glassAllowed()) continue;
    }
    // Lever A: offscreen panels park on blur-only. Checked BEFORE
    // getComputedStyle so an offscreen panel costs one rect (same layout
    // pass as the box read below), never a style resolve + worker build.
    // parkOffscreen is a guarded style clear — no layout.
    if (!isInExtendedViewport(el)) {
      parkOffscreen(el);
      continue;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w < 2 || h < 2) continue;
    const cs = getComputedStyle(el);
    const p = readParams(cs);
    const radius = radiusOf(el, cs, cssNum(cs, '--lens-radius', 21));
    const chainBase = chainOf(el, cs);
    const withDim = kind !== 'drop' && p.dim > 0;
    const quickKey = `${kind}|${w}x${h}|${Math.round(radius)}|${withDim ? 1 : 0}|${p.specOpacity}|${p.specSaturation}|${p.dim.toFixed(3)}`;
    if (el.dataset.lastQuickKey === quickKey) continue;
    todo.push({ el, kind, w, h, radius, p, chainBase, withDim, quickKey });
  }

  /* PHASE B — WRITE. */
  if (useWebgl) {
    for (const t of glTodo) trackWebgl(t.el, t.kind, t.params);
  }
  // Runs in BOTH modes: the pure-CSS path, and WebGL fall-through panels
  // (glx*/floating) which keep the engine's maps + filter graphs. Cache
  // hits dress inline (string ops, sub-frame); misses post to the map
  // worker and return — zero map math on this thread.
  for (const t of todo) {
    try {
      commit(t);
    } catch {
      /* keep the plain CSS chain */
    }
  }

  pruneDead();
}

/** Dress one panel from a cached bucket: filter graph + inline chain. */
function dressPanel(t: PendingPanel, entry: BucketEntry): void {
  const { el, kind, w, h, radius, p, chainBase, withDim, quickKey } = t;
  // Race guard: the panel may have BECOME nested while its maps were building
  // off-thread (a DOM move nests it; the requeue undresses it; then the worker
  // message lands). Dressing here would resurrect a stale inline url() over
  // the stylesheet de-nest rule — undress instead.
  if (isNestedGlass(el)) {
    undressNested(el);
    return;
  }
  // Lever A twin: worker maps may resolve while the panel scrolled offscreen
  // (the request posted in-view, the message lands out-of-view). Dressing now
  // would burn a filter on invisible pixels — park (cache stays, re-entry
  // re-dresses from the hit path) instead.
  if (!isInExtendedViewport(el)) {
    parkOffscreen(el);
    return;
  }
  const mapKey = `${kind}|${w}x${h}|${Math.round(radius)}`;
  const filterKey = `${mapKey}|${withDim ? 1 : 0}|${p.specOpacity}|${p.specSaturation}|${p.dim.toFixed(3)}`;
  let id = FILTERS.get(filterKey);
  if (!id || !document.getElementById(id)) {
    id = `lg-${++seq}`;
    const markup = buildFilterMarkup(id, entry.dispURL, entry.specURL, entry.maxAbs, p, withDim, w, h);
    ensuredContainer().insertAdjacentHTML('beforeend', markup);
    FILTERS.set(filterKey, id);
  }
  byEl.set(el, id);
  applyChain(el, `${chainBase} url(#${id})`);
  el.dataset.lastQuickKey = quickKey;
}

/** Apply one panel: cached maps + cached filter graph + inline chain. */
function commit(t: PendingPanel): void {
  const { kind, w, h, radius } = t;
  const mapKey = `${kind}|${w}x${h}|${Math.round(radius)}`;

  // Cache hit: dress immediately (string ops only — sub-frame).
  const hit = MAP_TABLE.get(mapKey);
  if (hit) {
    stats.hits++;
    dressPanel(t, hit);
    return;
  }

  // Cache miss: build off the main thread. The panel keeps its CSS
  // blur() + saturate() base until the maps arrive — one repaint, no flash.
  if (requestBucketAsync(t, mapKey)) return;

  // No Worker (very old browser): sync data-URI fallback. Pixel-identical,
  // main-thread cost — the only path that still pays it.
  try {
    stats.sync++;
    dressPanel(t, buildBucketSync(kind, w, h, radius));
  } catch {
    /* keep the plain CSS chain */
  }
}

/* ───────────────────── map worker ───────────────────── */

let mapWorker: Worker | null = null;
let workerDead = false;

/** Panels waiting on a map build, by map key. */
const inflight = new Map<string, PendingPanel[]>();

function worker(): Worker | null {
  if (workerDead) return null;
  if (mapWorker) return mapWorker;
  try {
    const w = new Worker(new URL('./mapWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = onWorkerMessage;
    // A dead worker must never leave panels lens-less forever: fall back to
    // the sync build once, instead of janking or hanging.
    w.onerror = () => {
      workerDead = true;
      const waiting = Array.from(inflight.values()).flat();
      inflight.clear();
      mapWorker = null;
      for (const t of waiting) {
        try {
          stats.sync++;
          dressPanel(t, buildBucketSync(t.kind, t.w, t.h, t.radius));
        } catch {
          /* keep the plain CSS chain */
        }
      }
    };
    mapWorker = w;
    return w;
  } catch {
    workerDead = true;
    return null;
  }
}

/** Post one map build to the worker. Returns false when no Worker exists. */
function requestBucketAsync(t: PendingPanel, mapKey: string): boolean {
  const queued = inflight.get(mapKey);
  if (queued) {
    queued.push(t);
    return true;
  }
  const w = worker();
  if (!w) return false;
  const p = defaultParams ?? (defaultParams = defaultParamsFromRoot());
  const r =
    t.radius >= 9999
      ? Math.min(t.w, t.h) / 2
      : Math.min(t.radius, Math.min(t.w, t.h) / 2 - 1);
  const req: MapBuildRequest = {
    key: mapKey,
    kind: t.kind,
    w: t.w,
    h: t.h,
    radius: r,
    bezel: p.bezel,
    thickness: p.thickness,
    specAngle: p.specAngle,
    specPeak: p.specPeak,
    cornerExp: mapCornerExp(p.cornerExp, CORNER_SHAPE_SUPPORTED),
    scale: mapDPR() * mapScaleFor(t.w, t.h),
  };
  try {
    inflight.set(mapKey, [t]);
    w.postMessage(req);
    stats.posted++;
  } catch {
    inflight.delete(mapKey);
    return false;
  }
  return true;
}

function onWorkerMessage(e: MessageEvent): void {
  const res = e.data as MapBuildResponse;
  const waiting = inflight.get(res.key);
  if (!waiting) return;
  inflight.delete(res.key);
  // A failed build falls back to sync — rare, and only for these panels.
  const needDisp = waiting[0]?.kind !== 'pane';
  if (!res.ok || !res.specBlob || (needDisp && !res.dispBlob)) {
    for (const t of waiting) {
      try {
        stats.sync++;
        dressPanel(t, buildBucketSync(t.kind, t.w, t.h, t.radius));
      } catch {
        /* keep the plain CSS chain */
      }
    }
    return;
  }
  const entry: BucketEntry = {
    dispURL: res.dispBlob ? URL.createObjectURL(res.dispBlob) : null,
    specURL: URL.createObjectURL(res.specBlob),
    maxAbs: res.maxAbs,
  };
  MAP_TABLE.set(res.key, entry);
  for (const t of waiting) {
    if (!t.el.isConnected) continue;
    try {
      stats.worker++;
      dressPanel(t, entry);
    } catch {
      /* keep the plain CSS chain */
    }
  }
  pruneDead();
}

function readParams(cs: CSSStyleDeclaration): LensParams {
  return {
    bezel: cssNum(cs, '--lens-bezel', 14),
    thickness: cssNum(cs, '--lens-thickness', 66),
    refraction: cssNum(cs, '--lens-refraction-level', 0.7),
    scaleRatio: cssNum(cs, '--lens-scale-ratio', 1),
    specOpacity: cssNum(cs, '--lens-spec-opacity', 0.2),
    specSaturation: cssNum(cs, '--lens-spec-saturation', 4),
    specAngle: cssNum(cs, '--lens-spec-angle', -60),
    specPeak: cssNum(cs, '--lens-spec-peak', 1),
    cornerExp: cssNum(cs, '--corner-exp', 3),
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: [103, 100, 112],
  };
}

/** Drop filters whose panels unmounted. Iterates OUR Set, never the DOM tree. */
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
  if (!container) return;
  const liveIds = new Set<string>();
  for (const el of tracked) {
    const id = byEl.get(el);
    if (id) liveIds.add(id);
  }
  for (const node of Array.from(container.children)) {
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
            scheduleFlush();
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
  mapWorker?.terminate();
  mapWorker = null;
  workerDead = false;
  inflight.clear();
  for (const entry of MAP_TABLE.values()) {
    if (entry.dispURL?.startsWith('blob:')) URL.revokeObjectURL(entry.dispURL);
    if (entry.specURL.startsWith('blob:')) URL.revokeObjectURL(entry.specURL);
  }
  FILTERS.clear();
  MAP_TABLE.clear();
  tracked.clear();
  pendingSync.clear();
  container?.remove();
  container = null;
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
