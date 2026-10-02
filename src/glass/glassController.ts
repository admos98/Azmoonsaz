/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass controller — the playground's per-panel rebuild loop, sized to
 * the app. Reads physics from the CSS tokens (single source of truth —
 * --lens-* in src/index.css), keeps one sized <filter> per observed panel,
 * rewires that panel's backdrop-filter to url(#own-id). Rebuilds on resize
 * (ResizeObserver) and on theme flip (dim swaps light/dark). No-ops when the
 * boot gate says no lensing (data-lens/data-glass) or when prefers-reduced-
 * transparency dropped the tier — panels keep the static #lens/#pane
 * fallback baked into index.html.
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
let observer: ResizeObserver | null = null;
let attrObserver: MutationObserver | null = null;
let domObserver: MutationObserver | null = null;
let container: SVGDefsElement | null = null;
/** el -> its assigned filter id (so a resync can re-target the same slot). */
const byEl = new WeakMap<Element, string>();
/** filter id -> last build signature (skip redundant rebuilds). */
const cache = new Map<string, string>();
let seq = 0;

function cssNum(el: Element, name: string, fallback: number): number {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function readParams(el: HTMLElement): LensParams {
  const cs = getComputedStyle(el);
  // inline override wins (engine sets el.style.backdropFilter first)
  const cssVar = (name: string, fallback: number) => {
    const v = cs.getPropertyValue(name).trim() || el.style.getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    bezel: cssVar('--lens-bezel', 14),
    thickness: cssVar('--lens-thickness', 72),
    refraction: cssVar('--lens-refraction-level', 0.5),
    scaleRatio: cssVar('--lens-scale-ratio', 1),
    specOpacity: cssVar('--lens-spec-opacity', 0.34),
    specSaturation: cssVar('--lens-spec-saturation', 5),
    specAngle: cssVar('--lens-spec-angle', -55),
    dim: cssVar('--lens-dim', 0.15),
    dimTint: [103, 100, 112],
    blur: cssVar('--lens-blur', 1),
  };
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

function kindOf(el: Element): 'lens' | 'pane' | 'drop' | null {
  if (el.classList.contains('lens')) return 'lens';
  if (el.classList.contains('pane')) return 'pane';
  if (el.classList.contains('drop')) return 'drop';
  return null;
}

function sync(el: HTMLElement): void {
  const kind = kindOf(el);
  if (!kind) return;
  // boot gate: engine only runs where backdrop-filter:url() actually paints
  const root = document.documentElement;
  if (root.dataset.lens !== 'on' || root.dataset.glass === 'lite' || root.dataset.glass === 'off') return;
  const p = readParams(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < 2 || h < 2) return;
  const radius = cssNum(el, '--lens-radius', 21);
  const dpr = currentDPR();
  // signature: everything in the spatial region that changes the filter
  const sig = [kind, w | 0, h | 0, radius, p.bezel, p.thickness, p.refraction, p.scaleRatio, dpr, p.specAngle, p.specOpacity, p.specSaturation, p.dim, p.blur].join('|');
  let id = byEl.get(el);
  if (!id) {
    id = `lg-${++seq}`;
    byEl.set(el, id);
  }
  if (cache.get(id) === sig) return;
  const withDim = kind !== 'drop' && p.dim > 0;
  const prof = computeProfile(p.bezel, p.thickness);
  const dm = kind === 'drop'
    ? buildDisplacementMap(w, h, Math.min(w, h) / 2, p.bezel, prof)
    : buildDisplacementMap(w, h, radius, p.bezel, prof);
  const dispURL = kind === 'pane' ? null : imageDataToURL(dm.img);
  const specURL = imageDataToURL(buildSpecularMap(w, h, radius, p.specAngle));
  const holder = ensuredContainer();
  const node = document.getElementById(id);
  const markup = buildFilterMarkup(id, dispURL, specURL, dm.maxAbs, p, withDim);
  if (node) {
    node.outerHTML = markup;
  } else {
    holder.insertAdjacentHTML('beforeend', markup);
  }
  cache.set(id, sig);
  // engine owns the backdrop chain now — inline beats the utility's plain blur.
  // The .lg-root tag is the de-nest whitelist: a panel THAT REQUESTED a filter
  // is a backdrop root by definition, so glass inside it stays flat in the
  // de-nest rule; the rule keys on this class, not on guesswork.
  el.classList.add('lg-root');
  // inline url only — the filter's feGaussianBlur does the backdrop blur
  // (playground: backdrop-filter:url(#lgf) has no blur in CSS). Setting
  // blur() here too would double the softness.
  el.style.backdropFilter = `url(#${id})`;
}

/** Drop filters whose owning element is gone (unmounted routes) — they are
 *  pure style, but a long session should not accumulate dead nodes. */
function pruneDead(): void {
  if (!container) return;
  for (const node of Array.from(container.children)) {
    const id = node.getAttribute('id');
    if (!id || !id.startsWith('lg-')) continue;
    let alive = false;
    document.querySelectorAll<HTMLElement>('.lens, .pane, .drop').forEach((el) => {
      if (byEl.get(el) === id) alive = true;
    });
    if (!alive) {
      cache.delete(id);
      node.remove();
    }
  }
}

/** One pass: measure + rebuild every currently-mounted lens/pane/drop,
 *  then sweep dead filters. */
export function resyncGlass(): void {
  if (!mounted) return;
  pruneDead();
  document.querySelectorAll<HTMLElement>('.lens, .pane, .drop').forEach((el) => {
    try {
      sync(el);
    } catch {
      /* a panel that fails to build keeps its static fallback */
    }
  });
}

export function mountGlassEngine(): void {
  if (mounted) return;
  mounted = true;
  observer = new ResizeObserver((entries) => {
    for (const e of entries) sync(e.target as HTMLElement);
  });
  document.querySelectorAll<HTMLElement>('.lens, .pane, .drop').forEach((el) => {
    const blur = cssNum(el, '--lens-blur', 1);
    if (el.classList.contains('lens--menu')) el.style.setProperty('--lens-blur', (blur * 3).toFixed(2) + 'px');
    observer!.observe(el);
    try {
      sync(el);
    } catch {
      /* keep static fallback */
    }
  });
  // late-mounted panels (modals, lazy routes) + theme flips (dim tokens change)
  attrObserver = new MutationObserver(() => {
    document
      .querySelectorAll<HTMLElement>('.lens, .pane, .drop')
      .forEach((el) => {
        observer!.observe(el);
        try {
          sync(el);
        } catch {
          /* keep static fallback */
        }
      });
  });
  attrObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  domObserver = new MutationObserver((mutations) => {
    // fires on every DOM change; only run the resync when something with
    // .lens/.pane/.drop actually entered the tree — otherwise React renders
    // would keep re-measuring every panel.
    for (const m of mutations) {
      if (!m.addedNodes.length) continue;
      for (const n of m.addedNodes) {
        const el = n as HTMLElement | null;
        if (
          el &&
          el.nodeType === 1 &&
          (el.matches?.('.lens, .pane, .drop') ||
            el.querySelector?.('.lens, .pane, .drop'))
        ) {
          resyncGlass();
          return;
        }
      }
    }
  });
  domObserver.observe(document.body, { childList: true, subtree: true });
}

export function unmountGlassEngine(): void {
  mounted = false;
  observer?.disconnect();
  observer = null;
  attrObserver?.disconnect();
  attrObserver = null;
  domObserver?.disconnect();
  domObserver = null;
  cache.clear();
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
