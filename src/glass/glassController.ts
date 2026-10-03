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
 *   3. Time-budgeted map builds. The remaining genuine cost — a displacement
 *      map + a specular map + two PNG encodes per new size — is the only
 *      expensive step left, so it is spent against a small per-frame budget
 *      and the overflow carried to the next frame. A page mounting 18 panels
 *      can no longer block a single frame on 18 encodes.
 *
 * The playground's physics survive intact: same mapMath, same curvature
 * exponent (n = 2^k, Chromium-verified), same specular arc, same bezel ring.
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
let container: SVGDefsElement | null = null;
let seq = 0;

let defaultParams: LensParams | null = null;

const GLASS_SELECTOR = '.lens, .pane, .drop, .glx, .glx-strong, .glx-dark';

/** ms of map-building allowed per frame before the rest is carried over. */
const MAP_BUILD_BUDGET_MS = 6;

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
 *  size share the single cached entry. */
function ensureBucket(kind: 'lens' | 'pane' | 'drop', w: number, h: number, radius: number): BucketEntry {
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
 *   panel. Panels whose quickKey is unchanged are dropped here, so a mutation
 *   touching one panel never re-measures the other 32.
 *
 *   PHASE B writes against a time budget, carrying overflow to the next frame.
 *   Map building is the only expensive step and it can no longer block a frame.
 */
function flushSync(): void {
  flushQueued = false;
  if (!mounted) return;
  if (!glassAllowed()) {
    pendingSync.clear();
    return;
  }

  const batch = Array.from(pendingSync);
  pendingSync.clear();

  /* PHASE A — READ ONLY */
  const todo: PendingPanel[] = [];
  for (const el of batch) {
    if (!el.isConnected) {
      tracked.delete(el);
      continue;
    }
    const kind = kindOf(el);
    if (!kind) continue;
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

  /* PHASE B — WRITE, time-budgeted */
  let carried = false;
  if (todo.length) {
    let spent = 0;
    let i = 0;
    for (; i < todo.length; i++) {
      if (i > 0 && spent > MAP_BUILD_BUDGET_MS) break;
      const t0 = performance.now();
      try {
        commit(todo[i]);
      } catch {
        /* keep the plain CSS chain */
      }
      spent += performance.now() - t0;
    }
    if (i < todo.length) {
      for (; i < todo.length; i++) pendingSync.add(todo[i].el);
      carried = true;
    }
  }

  pruneDead();
  if (carried) scheduleFlush();
}

/** Apply one panel: cached maps + cached filter graph + inline chain. */
function commit(t: PendingPanel): void {
  const { el, kind, w, h, radius, p, chainBase, withDim, quickKey } = t;
  const entry = ensureBucket(kind, w, h, radius);

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
  if (!container) return;
  const liveIds = new Set<string>();
  for (const el of Array.from(tracked)) {
    if (!el.isConnected) {
      tracked.delete(el);
      continue;
    }
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
  if (!glassAllowed()) return;
  document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
    resizeObserver?.observe(el);
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
          queueSync(el as HTMLElement);
        }
        for (const inner of el.querySelectorAll?.(GLASS_SELECTOR) ?? []) {
          resizeObserver?.observe(inner as HTMLElement);
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
  resizeObserver?.disconnect();
  resizeObserver = null;
  attrObserver?.disconnect();
  attrObserver = null;
  domObserver?.disconnect();
  domObserver = null;
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
