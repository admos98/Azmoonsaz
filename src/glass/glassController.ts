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

/** Radius classes that actually ship in this app. 9999 = pill/drop (exact
 *  circle). Custom radii snap to the nearest class; a mismatch > 8px sets
 *  data-lens-snap on the element so DevTools explains it. */
const RADIUS_RUNGS = [8, 14, 21, 28, 64, 9999] as const;

/** Aspect classes — keeps the bezel ramp proportional under feImage stretch. */
type Aspect = 'wide' | 'tall' | 'square';

/** Canvas sizes per aspect class. Small on purpose: smooth gradients survive
 *  bilinear upscaling exactly (flat-neutral interior, smooth ring ramp). */
const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  wide: { w: 256, h: 160 },
  tall: { w: 160, h: 256 },
  square: { w: 200, h: 200 },
};

/* ───────────────────── Static map table ───────────────────── */

interface BucketEntry {
  dispURL: string | null; // null for 'pane' (rim-only by design)
  specURL: string;
  maxAbs: number;
}

/** `${kind}|${radius}|${aspect}` -> built maps. Built ONCE at boot. */
const MAP_TABLE = new Map<string, BucketEntry>();

/** `${kind}|${radius}|${aspect}|${w}x${h}|${dimBit}|${specOpacity}|${specSat}|${dim}` -> filter id */
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

function buildLadder(): void {
  const p = defaultParams ?? (defaultParams = defaultParamsFromRoot());
  const cornerExp = mapCornerExp(p.cornerExp, CORNER_SHAPE_SUPPORTED);
  const prof = computeProfile(p.bezel, p.thickness);
  for (const r of RADIUS_RUNGS) {
    for (const aspect of ['wide', 'tall', 'square'] as Aspect[]) {
      const { w, h } = ASPECT_SIZE[aspect];
      const radius = r >= 9999 ? Math.min(w, h) / 2 : Math.min(r, Math.min(w, h) / 2 - 1);
      for (const kind of ['lens', 'pane', 'drop'] as const) {
        const key = `${kind}|${r}|${aspect}`;
        if (MAP_TABLE.has(key)) continue;
        let dispURL: string | null = null;
        let maxAbs = 1;
        if (kind !== 'pane') {
          const dm = buildDisplacementMap(w, h, radius, p.bezel, prof, 1, cornerExp);
          maxAbs = dm.maxAbs;
          dispURL = imageDataToURL(dm.img);
        }
        const specURL = imageDataToURL(
          buildSpecularMap(w, h, radius, p.specAngle, 1, p.specPeak, cornerExp),
        );
        MAP_TABLE.set(key, { dispURL, specURL, maxAbs });
      }
    }
  }
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

/** Snap an element's radius to its ladder rung; flag big mismatches. */
function radiusClass(el: HTMLElement, cs: CSSStyleDeclaration): number {
  const r = radiusOf(el, cs, cssNum(cs, '--lens-radius', 21));
  const pill = el.offsetWidth > 0 && r >= Math.min(el.offsetWidth, el.offsetHeight) / 2 - 1;
  if (pill) return 9999;
  let best = RADIUS_RUNGS[0] as number;
  let bestD = Infinity;
  for (const rung of RADIUS_RUNGS) {
    if (rung >= 9999) continue;
    const d = Math.abs(rung - r);
    if (d < bestD) {
      bestD = d;
      best = rung;
    }
  }
  if (bestD > 8 && el.dataset) el.dataset.lensSnap = `${Math.round(r)}->${best}`;
  return best;
}

function aspectClass(w: number, h: number): Aspect {
  if (w >= h * 1.5) return 'wide';
  if (h >= w * 1.5) return 'tall';
  return 'square';
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
  const r = radiusClass(el, cs);
  const aspect = aspectClass(w, h);
  const chainBase = chainOf(el, cs);
  const withDim = kind !== 'drop' && p.dim > 0;

  const mapKey = `${kind}|${r}|${aspect}`;
  const entry = MAP_TABLE.get(mapKey);
  if (!entry) {
    applyChain(el, chainBase);
    return;
  }

  const filterKey = `${mapKey}|${w}x${h}|${withDim ? 1 : 0}|${p.specOpacity}|${p.specSaturation}|${p.dim.toFixed(3)}`;
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
  buildLadder();
  resizeObserver = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      // only a bucket change re-syncs — the map never rebuilds
      const cs = getComputedStyle(el);
      const r = radiusClass(el, cs);
      const bucket = `${r}|${aspectClass(el.offsetWidth, el.offsetHeight)}`;
      if (el.dataset.bucket !== bucket) {
        el.dataset.bucket = bucket;
        sync(el);
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
