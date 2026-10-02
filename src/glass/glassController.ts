/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — the playground's per-panel rebuild loop, sized to
 * the app. Reads physics from the CSS tokens (single source of truth —
 * --lens-* in src/index.css), keeps ONE SHARED <filter> per unique geometry
 * signature (cards in a grid reuse one graph), and rewires each panel's
 * backdrop-filter to `blur() saturate() url(#own-id)` inline.
 *
 * Covers EVERY glass family: .lens/.pane/.drop AND .glx/.glx-strong/.glx-dark
 * — previously the card classes stayed on a static stretched-map fallback
 * that Chromium cannot render (external feImage hrefs never load inside
 * backdrop-filter chains; see docs/liquid-glass-engine-audit.md C2/C5).
 *
 * Perf contract (audit C6–C9):
 *  - no feGaussianBlur in the SVG chain — blur stays in the CSS chain (GPU);
 *  - maps build at clamped real DPR (1..2, never forced 2 on 1x displays);
 *  - ResizeObserver rebuilds are rAF-coalesced + 120ms trailing-debounced;
 *  - MutationObserver sweeps are rAF-coalesced (max one pass per frame);
 *  - pruneDead is a single DOM pass, not one querySelectorAll per filter.
 *
 * No-ops when the boot gate says no lensing (data-lens/data-glass) or when
 * prefers-reduced-transparency dropped the tier — panels keep the plain
 * blur+saturate CSS chain.
 */

import {
  buildDisplacementMap,
  buildFilterMarkup,
  buildSpecularMap,
  computeProfile,
  currentDPR,
  dimParams,
  effectiveScale,
  imageDataToURL,
  type LensParams,
} from './lensEngine';

let mounted = false;
let resizeObserver: ResizeObserver | null = null;
let attrObserver: MutationObserver | null = null;
let domObserver: MutationObserver | null = null;
let container: SVGDefsElement | null = null;
/** el -> its shared filter id (so a resync can re-target the same slot). */
const byEl = new WeakMap<Element, string>();
/** geometry signature -> shared filter id. Cards in a grid, rows, buttons —
 *  identical geometry + params share ONE <filter> (one graph, one decode). */
const bySig = new Map<string, string>();
let seq = 0;

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
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: [103, 100, 112],
  };
}

/** Parse a "14px" token; calc() strings return NaN → caller multiplies the
 *  base token itself (the old code silently lost the pane's 2× blur). */
function px(cs: CSSStyleDeclaration, name: string, fallback: number): number {
  const n = parseFloat(cs.getPropertyValue(name).trim());
  return Number.isFinite(n) ? n : fallback;
}

/** Family blur + saturate for the inline CSS chain. Blur is per family —
 *  the SVG chain no longer contains a feGaussianBlur. */
function chainOf(el: Element, cs: CSSStyleDeclaration): string {
  const lensBlur = px(cs, '--lens-blur', 1);
  const sat = (v: number) => (v === 1 ? '' : ` saturate(${v})`);
  if (el.classList.contains('glx-strong'))
    return `blur(${px(cs, '--glass-p-blur', 16).toFixed(2)}px)${sat(px(cs, '--glass-p-sat', 1.5))}`;
  if (el.classList.contains('glx-dark')) return 'blur(10px) saturate(1.4)';
  if (el.classList.contains('glx'))
    return `blur(${px(cs, '--glass-bg-blur', 8).toFixed(2)}px)${sat(px(cs, '--glass-bg-sat', 1.5))}`;
  if (el.classList.contains('lens'))
    return `blur(${(el.classList.contains('lens--menu') ? lensBlur * 3 : lensBlur).toFixed(2)}px)`;
  if (el.classList.contains('pane')) return `blur(${(lensBlur * 2).toFixed(2)}px)`;
  if (el.classList.contains('drop')) return `blur(${px(cs, '--drop-blur', 0.5).toFixed(2)}px)`;
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
  const dpr = currentDPR();
  // signature: everything that changes the FILTER. Blur/saturate live in the
  // CSS chain and are applied below without a rebuild.
  const sig = [kind, w | 0, h | 0, radius, p.bezel, p.thickness, p.refraction, p.scaleRatio, dpr, p.specAngle, p.specOpacity, p.specSaturation, p.dim].join('|');
  const chain = `${chainOf(el, cs)} url(#${'@'})`; // '@' = filter id placeholder
  // a panel that requested a filter is a backdrop root by definition — the
  // de-nest rule keys on this class to keep glass inside it flat
  if (!el.classList.contains('lg-root')) el.classList.add('lg-root');
  // 1) shared hit: a live filter already built for this exact signature
  const shared = bySig.get(sig);
  if (shared && document.getElementById(shared)) {
    byEl.set(el, shared);
    applyChain(el, chain.replace('@', shared));
    return;
  }
  // 2) else build a FRESH filter for this signature — never mutate an
  //    existing node: other elements may still reference it until their own
  //    sync retargets (param changes are per-element, not global).
  const id = `lg-${++seq}`;
  const withDim = kind !== 'drop' && p.dim > 0;
  const prof = computeProfile(p.bezel, p.thickness);
  const dm =
    kind === 'drop'
      ? buildDisplacementMap(w, h, Math.min(w, h) / 2, p.bezel, prof, dpr)
      : buildDisplacementMap(w, h, radius, p.bezel, prof, dpr);
  const dispURL = kind === 'pane' ? null : imageDataToURL(dm.img);
  const specURL = imageDataToURL(buildSpecularMap(w, h, radius, p.specAngle, dpr));
  const markup = buildFilterMarkup(id, dispURL, specURL, dm.maxAbs, p, withDim, w, h);
  ensuredContainer().insertAdjacentHTML('beforeend', markup);
  bySig.set(sig, id);
  byEl.set(el, id);
  applyChain(el, chain.replace('@', id));
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

/** One pass: measure + rebuild every currently-mounted glass element, then
 *  sweep dead filters. */
export function resyncGlass(): void {
  if (!mounted) return;
  const liveIds = new Set<string>();
  document.querySelectorAll<HTMLElement>(GLASS_SELECTOR).forEach((el) => {
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
  resizeObserver = new ResizeObserver((entries) => {
    for (const e of entries) queueResize(e.target as HTMLElement);
  });
  attrObserver = new MutationObserver(() => {
    // theme flips change the dim tokens → every signature changes
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
  clearTimeout(resizeTimer);
  resized.clear();
  bySig.clear();
}

// re-export so a future Settings tuner can live-import the pieces
export {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  dimParams,
  effectiveScale,
};
export type { LensParams };
