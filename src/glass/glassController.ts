/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — FIXED-LADDER EDITION (2026-10-04).
 *
 * One decision, no scheduler: displacement + specular maps are built ONCE at
 * boot from a small static ladder (radius class × aspect class), then every
 * panel just points its inline backdrop-filter at `blur() saturate()
 * url(#shared)` where #shared is a cached <filter> keyed by
 * (kind, map bucket, W×H, dim-mode). No workers, no LRU cache, no lazy
 * IntersectionObserver builds, no per-panel rebuild storms.
 *
 * Why the ladder: maps are smooth gradient rings; a map built for a 256px
 * panel is mathematically identical (bilinear upscale, flat-neutral interior,
 * CSS-px specular ring) to one built at 1024px. The only real axes of
 * variation are CORNER RADIUS and ASPECT — so bucket exactly those two and
 * everything else is a shared cache hit.
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

let mounted = false;
let resizeObserver: ResizeObserver | null = null;
let attrObserver: MutationObserver | null = null;
let domObserver: MutationObserver | null = null;
let container: SVGDefsElement | null = null;
let seq = 0;

let defaultParams: LensParams | null = null;

const GLASS_SELECTOR = '.lens, .pane, .drop, .glx, .glx-strong, .glx-dark';

/* ───────────────────── boot: build the ladder once ───────────────────── */

function defaultParamsFromRoot(): LensParams {
  const cs = getComputedStyle(document.documentElement);
  return {
    bezel: cssNum(cs, '--lens-bezel', 14),
    thickness: cssNum(cs, '--lens-thickness', 72),
    refraction: cssNum(cs, '--lens-refraction-level', 0.5),
    scaleRatio: cssNum(cs, '--lens-scale-ratio', 1),
    specOpacity: cssNum(cs, '--lens-spec-opacity', 0.34),
    specSaturation: cssNum(cs, '--lens-spec-saturation', 5),
    specAngle: cssNum(cs, '--lens-spec-angle', -55),
    specPeak: cssNum(cs, '--lens-spec-peak', 2),
    cornerExp: cssNum(cs, '--corner-exp', 3),
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: [103, 100, 112],
  };
}

/** Build one panel's exact-size map pair once; reuse thereafter. Cheap —
 *  a 200x400 panel is one 80k px loop, sub-frame. Cards/rows of the same
 *  size share the single cached entry. */
function ensureBucket(kind: 'lens' | 'pane' | 'drop', w: number, h: number, radius: number): BucketEntry {
  // quantized key: two panels within 8px share one map (stretch is invisible
  // at 1px blur) — keeps the table bounded during resize tweens
  const qw = Math.max(2, Math.round(w / 8) * 8);
  const qh = Math.max(2, Math.round(h / 8) * 8);
  const key = `${kind}|${qw}x${qh}|${Math.round(radius)}`;
  const hit = MAP_TABLE.get(key);
  if (hit) return hit;
  const p = defaultParams ?? (defaultParams = defaultParamsFromRoot());
  const cornerExp = mapCornerExp(p.cornerExp, CORNER_SHAPE_SUPPORTED);
  const prof = computeProfile(p.bezel, p.thickness);
  // build at the quantized size, capped long side — gradient maps upscale fine
  const cap = Math.min(1, 512 / Math.max(qw, qh, 1));
  const bw = Math.max(2, Math.round(qw * cap));
  const bh = Math.max(2, Math.round(qh * cap));
  const r = radius >= 9999 ? Math.min(bw, bh) / 2 : Math.min(radius * cap, Math.min(bw, bh) / 2 - 1);
  let dispURL: string | null = null;
  let maxAbs = 1;
  if (kind !== 'pane') {
    const dm = buildDisplacementMap(bw, bh, r, p.bezel * cap, prof, 1, cornerExp);
    maxAbs = dm.maxAbs;
    dispURL = imageDataToURL(dm.img);
  }
  const specURL = imageDataToURL(
    buildSpecularMap(bw, bh, r, p.specAngle, 1, p.specPeak * cap, cornerExp),
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

/* ───────────────────── sync ───────────────────── */

function sync(el: HTMLElement): void {
  const kind = kindOf(el);
  if (!kind) return;
  const root = document.documentElement;
  if (root.dataset.lens !== 'on' || root.dataset.glass === 'lite' || root.dataset.glass === 'off') return;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < 2 || h < 2) return;
  const cs = getComputedStyle(el);
  const p = readParams(cs);
  const radius = radiusOf(el, cs, cssNum(cs, '--lens-radius', 21));
  const chainBase = chainOf(el, cs);
  const withDim = kind !== 'drop' && p.dim > 0;

  // idempotent: same panel + same quantized size + same params = nothing to do
  const qw = Math.round(w / 8) * 8;
  const qh = Math.round(h / 8) * 8;
  const quickKey = `${kind}|${qw}x${qh}|${Math.round(radius)}|${withDim ? 1 : 0}|${p.specOpacity}|${p.specSaturation}|${p.dim.toFixed(3)}`;
  if (el.dataset.lastQuickKey === quickKey) return;
  el.dataset.lastQuickKey = quickKey;

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
}

function readParams(cs: CSSStyleDeclaration): LensParams {
  return {
    bezel: cssNum(cs, '--lens-bezel', 14),
    thickness: cssNum(cs, '--lens-thickness', 72),
    refraction: cssNum(cs, '--lens-refraction-level', 0.5),
    scaleRatio: cssNum(cs, '--lens-scale-ratio', 1),
    specOpacity: cssNum(cs, '--lens-spec-opacity', 0.34),
    specSaturation: cssNum(cs, '--lens-spec-saturation', 5),
    specAngle: cssNum(cs, '--lens-spec-angle', -55),
    specPeak: cssNum(cs, '--lens-spec-peak', 2),
    cornerExp: cssNum(cs, '--corner-exp', 3),
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: [103, 100, 112],
  };
}

/** Drop filters whose panels unmounted. One DOM pass. */
function pruneDead(liveIds: Set<string>): void {
  if (!container) return;
  for (const node of Array.from(container.children)) {
    const id = node.getAttribute('id');
    if (!id || !id.startsWith('lg-')) continue;
    if (!liveIds.has(id)) {
      node.remove();
      for (const [key, owned] of FILTERS) {
        if (owned === id) FILTERS.delete(key);
      }
    }
  }
}

let sweepQueued = false;
function scheduleSweep(): void {
  if (sweepQueued || !mounted) return;
  sweepQueued = true;
  requestAnimationFrame(() => {
    sweepQueued = false;
    resyncGlass();
  });
}

/** One pass: measure + attach cached filters, sweep dead ones, observe new
 *  panels with the ResizeObserver (covers w-0 hover panes growing later). */
export function resyncGlass(): void {
  if (!mounted) return;
  const liveIds = new Set<string>();
  document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
    resizeObserver?.observe(el);
    try {
      sync(el);
    } catch {
      /* keep plain CSS chain */
    }
    const id = byEl.get(el);
    if (id) liveIds.add(id);
  });
  pruneDead(liveIds);
}

export function mountGlassEngine(): void {
  if (mounted) return;
  mounted = true;
  resizeObserver = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      // Rebuild only once the size SETTLES — a tween's in-between sizes
      // would each key a new exact-size map (per-frame thrash). rAF-coalesce.
      el.dataset.pendingSize = `${el.offsetWidth}x${el.offsetHeight}`;
      if (!el.dataset.settleRaf) {
        el.dataset.settleRaf = '1';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.dataset.settleRaf = '';
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          // Quantize: rebuild only when the size moves by >=8px or crosses a
          // radius boundary on the quantized grid — animating pills/menus
          // stay on their current map (invisible stretch at 1px blur) and
          // snap to exact once they stop.
          const qw = Math.round(w / 8) * 8;
          const qh = Math.round(h / 8) * 8;
          const key = `${qw}x${qh}|${radiusOf(el, getComputedStyle(el), 21)}`;
          if (el.dataset.lastBucket !== key) {
            el.dataset.lastBucket = key;
            el.dataset.lastSize = `${w}x${h}`;
            try { sync(el); } catch { /* keep plain chain */ }
          }
        }));
      }
    }
  });
  attrObserver = new MutationObserver(() => scheduleSweep());
  attrObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  domObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (!m.addedNodes.length) continue;
      for (const n of m.addedNodes) {
        const el = n as HTMLElement | null;
        if (
          el &&
          el.nodeType === 1 &&
          (el.matches?.(GLASS_SELECTOR) || el.querySelector?.(GLASS_SELECTOR))
        ) {
          scheduleSweep();
          return;
        }
      }
    }
  });
  domObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
    resizeObserver!.observe(el);
    try {
      sync(el);
    } catch {
      /* plain chain */
    }
  });
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
