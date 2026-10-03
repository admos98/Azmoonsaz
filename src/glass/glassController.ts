/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — the playground's per-panel rebuild loop, sized to
 * the app. Reads physics from the CSS tokens (single source of truth —
 * --lens-* / --corner-* in src/index.css), keeps ONE SHARED <filter> per
 * unique geometry signature (cards in a grid reuse one graph), and wires each
 * panel's backdrop-filter to `blur() saturate() url(#own-id)` inline.
 *
 * Covers EVERY glass family: .lens/.pane/.drop AND .glx/.glx-strong/.glx-dark
 * — previously the card classes stayed on a static stretched-map fallback
 * that Chromium cannot render (external feImage hrefs never load inside
 * backdrop-filter chains; see docs/liquid-glass-engine-audit.md C2/C5).
 *
 * Perf contract (audit C6–C9, extended 2026-10):
 *  - no feGaussianBlur in the SVG chain — blur stays in the CSS chain (GPU);
 *  - map BUILDING + PNG ENCODING run in a small worker pool (mapWorker.ts) —
 *    the main thread never blocks on toDataURL (was 30-80ms per big panel);
 *  - maps come back as blob: object URLs (verified inside feImage +
 *    backdrop-filter; CSP img-src allows blob:) — no base64 inflation;
 *  - MAP DATA is cached (LRU) by geometry+physics signature. Theme flips and
 *    specular-strength tweaks only rebuild the cheap <filter> markup, never
 *    the maps;
 *  - viewport-lazy: panels farther than 600px off-screen keep the plain CSS
 *    chain and build their maps only when they approach the viewport;
 *  - maps build at min(display DPR, 1) capped to 1024px on the long side —
 *    gradient fields survive bilinear upscaling losslessly, the interior is
 *    flat-neutral, and the specular ring is defined in CSS px;
 *  - ResizeObserver rebuilds are rAF-coalesced + 120ms trailing-debounced;
 *  - MutationObserver sweeps are rAF-coalesced (max one pass per frame);
 *  - pruneDead is a single DOM pass, not one querySelectorAll per filter.
 *
 * Graceful degradation: if Workers/OffscreenCanvas are unavailable (or the
 * worker script fails to load), maps build synchronously on the main thread
 * as data URIs — same visuals, old cost profile. No-ops when the boot gate
 * says no lensing (data-lens/data-glass) — panels keep the plain CSS chain.
 */

import {
  buildDisplacementMap,
  buildFilterMarkup,
  buildSpecularMap,
  computeProfile,
  imageDataToURL,
  mapScaleFor,
  type LensParams,
} from './lensEngine';
import type { MapRequest } from './mapWorker';

let mounted = false;
let resizeObserver: ResizeObserver | null = null;
let attrObserver: MutationObserver | null = null;
let domObserver: MutationObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let container: SVGDefsElement | null = null;
/** el -> its shared filter id (so a resync can re-target the same slot). */
const byEl = new WeakMap<Element, string>();
/** filter signature -> shared filter id. Cards in a grid, rows, buttons —
 *  identical geometry + params share ONE <filter> (one graph, one decode). */
const bySig = new Map<string, string>();
let seq = 0;

/* ── worker pool: map building + PNG encode, off the main thread ── */
const workers: Worker[] = [];
let workerIdx = 0;
let workerBroken = false;
let reqSeq = 0;
/** reqId -> the exact request (also the recipe for the sync fallback). */
const inFlight = new Map<number, MapRequest>();

function pickWorker(): Worker | null {
  if (workerBroken) return null;
  if (workers.length) return workers[workerIdx++ % workers.length];
  try {
    const count = Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL('./mapWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = onMapResponse;
      w.onerror = () => markWorkersBroken();
      workers.push(w);
    }
    return workers[workerIdx++ % workers.length];
  } catch {
    workerBroken = true;
    return null;
  }
}

function markWorkersBroken(): void {
  if (workerBroken) return;
  workerBroken = true;
  for (const w of workers) w.terminate();
  workers.length = 0;
  // finish every pending map synchronously so panels don't wait forever
  for (const entry of [...mapCache.values()]) {
    if (entry.state === 'pending' && entry.req) buildSync(entry);
  }
}

/* ── map cache (LRU) — keyed by everything that changes MAP PIXELS ──
   Deliberately NOT keyed by dim/specOpacity/specSaturation: those only shape
   the cheap <filter> markup, so a theme flip re-dresses every panel without
   rebuilding a single map. */
interface MapEntry {
  state: 'pending' | 'ready' | 'failed';
  dispURL: string | null;
  specURL: string;
  maxAbs: number;
  /** URLs are ours (blob:) — must be revoked when evicted/cleared. */
  owned: boolean;
  /** Elements waiting for this map; re-synced (fresh params) on arrival. */
  waiters: Set<HTMLElement>;
  /** The request recipe — kept for the sync fallback after worker failure. */
  req: MapRequest | null;
}
const MAP_CACHE_CAP = 64;
const mapCache = new Map<string, MapEntry>();

function touchCache(mapSig: string): void {
  const e = mapCache.get(mapSig);
  if (e) {
    mapCache.delete(mapSig);
    mapCache.set(mapSig, e);
  }
}

/** Revoke blob URLs only when no live <filter> still references them. */
function revokeIfUnused(urls: Array<string | null>): void {
  if (!container) return;
  const live = new Set<string>();
  for (const node of container.children) {
    for (const img of node.querySelectorAll('feImage')) {
      const href = img.getAttribute('href');
      if (href) live.add(href);
    }
  }
  for (const u of urls) {
    if (u && u.startsWith('blob:') && !live.has(u)) URL.revokeObjectURL(u);
  }
}

function evictCache(): void {
  while (mapCache.size > MAP_CACHE_CAP) {
    const oldestKey = mapCache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    const entry = mapCache.get(oldestKey)!;
    mapCache.delete(oldestKey);
    if (entry.owned) revokeIfUnused([entry.dispURL, entry.specURL]);
  }
}

function buildSync(entry: MapEntry): void {
  const q = entry.req;
  if (!q) {
    entry.state = 'failed';
    return;
  }
  try {
    const prof = computeProfile(q.bezel, q.thickness);
    let dispURL: string | null = null;
    let maxAbs = 1;
    if (q.kind !== 'pane') {
      const radius = q.kind === 'drop' ? Math.min(q.w, q.h) / 2 : q.radius;
      const dm = buildDisplacementMap(q.w, q.h, radius, q.bezel, prof, q.scale, q.cornerExp);
      maxAbs = dm.maxAbs;
      dispURL = imageDataToURL(dm.img);
    }
    const specURL = imageDataToURL(
      buildSpecularMap(q.w, q.h, q.radius, q.specAngle, q.scale, q.specPeak, q.cornerExp),
    );
    entry.dispURL = dispURL;
    entry.specURL = specURL;
    entry.maxAbs = maxAbs;
    entry.state = 'ready';
    entry.owned = false; // data URIs — nothing to revoke
  } catch {
    entry.state = 'failed';
  }
  wakeWaiters(entry);
}

function wakeWaiters(entry: MapEntry): void {
  const waiting = [...entry.waiters];
  entry.waiters.clear();
  for (const el of waiting) {
    if (el.isConnected) sync(el); // re-sync: cache hit path attaches the filter
  }
}

function onMapResponse(e: MessageEvent): void {
  const resp = e.data as {
    reqId: number;
    dispBlob: Blob | null;
    specBlob: Blob | null;
    maxAbs: number;
    error?: string;
  };
  const req = inFlight.get(resp.reqId);
  if (!req) return;
  inFlight.delete(resp.reqId);
  const mapSig = mapSigOf(req);
  const entry = mapCache.get(mapSig);
  if (!entry || entry.state !== 'pending') return; // evicted / superseded
  if (resp.error || !resp.specBlob) {
    entry.state = 'failed';
  } else {
    entry.dispURL = resp.dispBlob ? URL.createObjectURL(resp.dispBlob) : null;
    entry.specURL = URL.createObjectURL(resp.specBlob);
    entry.maxAbs = resp.maxAbs;
    entry.owned = true;
    entry.state = 'ready';
  }
  wakeWaiters(entry);
}

function mapSigOf(q: MapRequest): string {
  return [
    q.kind,
    q.w,
    q.h,
    q.radius,
    q.bezel,
    q.thickness,
    q.refraction,
    q.scaleRatio,
    q.scale,
    q.specAngle,
    q.specPeak,
    q.cornerExp,
  ].join('|');
}

/* ── rAF-coalesced scheduling ── */
let sweepQueued = false;
function scheduleSweep(): void {
  if (sweepQueued || !mounted) return;
  sweepQueued = true;
  requestAnimationFrame(() => {
    sweepQueued = false;
    resyncGlass();
  });
}

/* ── resize debounce: rebuild maps only after the storm settles ── */
const resized = new Set<HTMLElement>();
let resizeTimer = 0;
function queueResize(el: HTMLElement): void {
  if (!mounted) return;
  resized.add(el);
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    for (const e of resized) {
      try {
        sync(e);
      } catch {
        /* a panel that fails to build keeps its plain CSS chain */
      }
    }
    resized.clear();
  }, 120);
}

/* ── viewport gate: panels build maps only as they approach the screen ── */
const nearViewport = new WeakSet<HTMLElement>();
const ioTracked = new WeakSet<HTMLElement>();

function cssNum(cs: CSSStyleDeclaration, name: string, fallback: number): number {
  const n = parseFloat(cs.getPropertyValue(name).trim());
  return Number.isFinite(n) ? n : fallback;
}

/** First length of a border-radius shorthand ("14px", "28px 28px", "50%"). */
function radiusOf(el: HTMLElement, cs: CSSStyleDeclaration, fallback: number): number {
  const raw = (cs.borderRadius || '').trim().split(/[\s/]+/)[0];
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  if (raw.endsWith('%')) return (n / 100) * Math.min(el.offsetWidth, el.offsetHeight);
  return n;
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

/** Family blur + saturate for the inline CSS chain. Blur is per family —
 *  the SVG chain no longer contains a feGaussianBlur. */
function chainOf(el: Element, cs: CSSStyleDeclaration): string {
  const lensBlur = cssNum(cs, '--lens-blur', 1);
  const sat = (v: number) => (v === 1 ? '' : ` saturate(${v})`);
  if (el.classList.contains('glx-strong'))
    return `blur(${cssNum(cs, '--glass-p-blur', 16).toFixed(2)}px)${sat(cssNum(cs, '--glass-p-sat', 1.5))}`;
  if (el.classList.contains('glx-dark')) return 'blur(10px) saturate(1.4)';
  if (el.classList.contains('glx'))
    return `blur(${cssNum(cs, '--glass-bg-blur', 8).toFixed(2)}px)${sat(cssNum(cs, '--glass-bg-sat', 1.5))}`;
  if (el.classList.contains('lens'))
    return `blur(${(el.classList.contains('lens--menu') ? lensBlur * 3 : lensBlur).toFixed(2)}px)`;
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

const GLASS_SELECTOR = '.lens, .pane, .drop, .glx, .glx-strong, .glx-dark';

function kindOf(el: Element): 'lens' | 'pane' | 'drop' | null {
  if (el.classList.contains('lens')) return 'lens';
  if (el.classList.contains('pane')) return 'pane';
  if (el.classList.contains('drop')) return 'drop';
  // card families ride the same per-panel engine (bend + specular rim)
  if (el.classList.contains('glx-strong') || el.classList.contains('glx-dark') || el.classList.contains('glx'))
    return 'lens';
  return null;
}

function sync(el: HTMLElement): void {
  const kind = kindOf(el);
  if (!kind) return;
  // boot gate: engine only runs where backdrop-filter:url() actually paints
  const root = document.documentElement;
  if (root.dataset.lens !== 'on' || root.dataset.glass === 'lite' || root.dataset.glass === 'off') return;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < 2 || h < 2) return; // hidden / not laid out — skip, keep CSS chain
  const cs = getComputedStyle(el); // ONE style read per element per pass
  const p = readParams(cs);
  const radius = radiusOf(el, cs, cssNum(cs, '--lens-radius', 21));
  const scale = mapScaleFor(w, h);
  const chainBase = chainOf(el, cs); // blur/saturate — no url() yet
  // a panel that requested a filter is a backdrop root by definition — the
  // de-nest rule keys on this class to keep glass inside it flat
  if (!el.classList.contains('lg-root')) el.classList.add('lg-root');

  const req: MapRequest = {
    reqId: 0, // assigned when actually dispatched to a worker
    kind,
    w,
    h,
    radius,
    bezel: p.bezel,
    thickness: p.thickness,
    refraction: p.refraction,
    scaleRatio: p.scaleRatio,
    specAngle: p.specAngle,
    specPeak: p.specPeak,
    cornerExp: p.cornerExp,
    scale,
  };
  const mapSig = mapSigOf(req);

  // VIEWPORT GATE — a panel farther than one screen of scroll keeps the plain
  // CSS chain (same geometry, no rim yet); the worker builds its maps the
  // moment the IntersectionObserver sees it approach, long before it paints.
  if (!nearViewport.has(el)) {
    applyChain(el, chainBase);
    return;
  }

  // filter signature = map identity + markup-only params
  const withDim = kind !== 'drop' && p.dim > 0;
  const filterSig = [mapSig, withDim, p.specOpacity, p.specSaturation, p.dim].join('|');

  let entry = mapCache.get(mapSig);
  if (!entry) {
    entry = { state: 'pending', dispURL: null, specURL: '', maxAbs: 1, owned: false, waiters: new Set(), req };
    mapCache.set(mapSig, entry);
    evictCache();
    const worker = pickWorker();
    if (worker) {
      req.reqId = ++reqSeq;
      inFlight.set(req.reqId, req);
      worker.postMessage(req);
    } else {
      buildSync(entry); // rare fallback path — ready synchronously
    }
  } else {
    touchCache(mapSig);
  }

  if (entry.state === 'ready') {
    attachFilter(el, filterSig, entry, chainBase, p, withDim, w, h);
  } else if (entry.state === 'pending') {
    entry.waiters.add(el);
    applyChain(el, chainBase); // plain blur until the worker answers
  } else {
    applyChain(el, chainBase); // failed build — keep the graceful CSS chain
  }
}

/** Shared-filter lookup, else one fresh <filter> for this signature. */
function attachFilter(
  el: HTMLElement,
  filterSig: string,
  entry: MapEntry,
  chainBase: string,
  p: LensParams,
  withDim: boolean,
  w: number,
  h: number,
): void {
  if (entry.state !== 'ready') return;
  const shared = bySig.get(filterSig);
  if (shared && document.getElementById(shared)) {
    byEl.set(el, shared);
    applyChain(el, `${chainBase} url(#${shared})`);
    return;
  }
  // build a FRESH filter for this signature — never mutate an existing node:
  // other elements may still reference it until their own sync retargets.
  const id = `lg-${++seq}`;
  const markup = buildFilterMarkup(id, entry.dispURL, entry.specURL, entry.maxAbs, p, withDim, w, h);
  ensuredContainer().insertAdjacentHTML('beforeend', markup);
  bySig.set(filterSig, id);
  byEl.set(el, id);
  applyChain(el, `${chainBase} url(#${id})`);
}

/** Set the inline chain only when it actually changed — a blind write on
 *  every sweep invalidates style for every glass element for nothing. */
function applyChain(el: HTMLElement, chain: string): void {
  if (el.style.backdropFilter !== chain) el.style.backdropFilter = chain;
}

/** Drop filters whose owning elements are all gone (unmounted routes) — one
 *  DOM pass, not one querySelectorAll per filter. */
function pruneDead(liveIds: Set<string>): void {
  if (!container) return;
  for (const node of Array.from(container.children)) {
    const id = node.getAttribute('id');
    if (!id || !id.startsWith('lg-')) continue;
    if (!liveIds.has(id)) {
      node.remove();
      for (const [sig, owned] of bySig) {
        if (owned === id) bySig.delete(sig);
      }
    }
  }
}

/** One pass: measure + (re)build every currently-mounted glass element, then
 *  sweep dead filters. */
export function resyncGlass(): void {
  if (!mounted) return;
  const liveIds = new Set<string>();
  document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
    if (intersectionObserver && !ioTracked.has(el)) {
      ioTracked.add(el);
      intersectionObserver.observe(el);
    }
    try {
      sync(el);
    } catch {
      /* a panel that fails to build keeps its plain CSS chain */
    }
    const id = byEl.get(el);
    if (id) liveIds.add(id);
  });
  pruneDead(liveIds);
}

export function mountGlassEngine(): void {
  if (mounted) return;
  mounted = true;
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      let woke = false;
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          if (!nearViewport.has(el)) {
            nearViewport.add(el);
            woke = true; // newly-arrived panel — build its maps now
          }
        } else {
          nearViewport.delete(el);
        }
      }
      if (woke) scheduleSweep();
    },
    // one screen of lead: the worker finishes long before the panel scrolls in
    { rootMargin: '600px 600px 600px 600px' },
  );
  resizeObserver = new ResizeObserver((entries) => {
    for (const e of entries) queueResize(e.target as HTMLElement);
  });
  attrObserver = new MutationObserver(() => {
    // theme flips change the dim tokens → every filter signature changes,
    // but the MAP cache keys exclude dim — filters re-dress, maps survive.
    scheduleSweep();
  });
  attrObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  domObserver = new MutationObserver((mutations) => {
    // fires on every DOM change; only sweep when something with a glass class
    // actually entered the tree — otherwise React renders would keep
    // re-measuring every panel.
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
    if (intersectionObserver) {
      ioTracked.add(el);
      intersectionObserver.observe(el);
    }
    resizeObserver!.observe(el);
    try {
      sync(el);
    } catch {
      /* keep plain CSS chain */
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
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  clearTimeout(resizeTimer);
  resized.clear();
  bySig.clear();
  for (const entry of mapCache.values()) {
    if (entry.owned) {
      for (const u of [entry.dispURL, entry.specURL]) {
        if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
      }
    }
  }
  mapCache.clear();
  inFlight.clear();
  for (const w of workers) w.terminate();
  workers.length = 0;
}

// re-export so a future Settings tuner can live-import the pieces
export {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  mapScaleFor,
} from './lensEngine';
export type { LensParams } from './lensEngine';
