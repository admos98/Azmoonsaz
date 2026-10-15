/**
 * CSS-mode engine — the app's real path, reproduced for the lab.
 *
 * This is glassController.ts reduced to what the comparison needs: for every
 * panel, build the displacement + specular maps, build the <filter> graph, and
 * apply `backdrop-filter: blur() saturate() url(#id)` inline. Same maps, same
 * chain, same order as the shipping engine.
 *
 * Two deliberate differences from the shipping controller, both required for
 * an honest A/B:
 *   1. No viewport gating (Lever A). The app parks offscreen panels on
 *      blur-only; the lab keeps every panel dressed so the cost being measured
 *      is the glass itself, not the gating.
 *   2. No worker. Maps build synchronously with the data-URI encoder, so a
 *      panel is either fully dressed or not dressed at all when the frame is
 *      captured — no async race between the two modes.
 */

import {
  buildDisplacementMap,
  buildFilterNode,
  buildSpecularMap,
  computeProfile,
  imageDataToBlobURL,
  mapCornerExp,
  mapScaleFor,
  releaseURLs,
} from './maps.js';

function ensuredDefs() {
  let svg = document.getElementById('lab-defs');
  if (svg && document.contains(svg)) return svg.querySelector('defs');
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'lab-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

export class CssEngine {
  constructor() {
    this.maps = new Map();
    this.dressed = new Set();
    this.seq = 0;
  }
  /** Map entry for one geometry. Async: blob encoding (the CSP-safe path) is
   *  async, and data: URLs are refused by the production img-src. */
  async mapsFor(kind, w, h, radius, params) {
    const key = `${kind}|${Math.round(w)}x${Math.round(h)}|${Math.round(radius)}`;
    const hit = this.maps.get(key);
    if (hit) return hit;
    const cornerExp = mapCornerExp(params.cornerExp, params.cornerShapeSupported);
    const prof = computeProfile(params.bezel, params.thickness);
    const r = Math.min(radius, Math.min(w, h) / 2 - 1);
    const scale = params.dpr * mapScaleFor(w, h);
    let dispURL = null;
    let maxAbs = 1;
    if (kind !== 'pane') {
      const dm = buildDisplacementMap(w, h, r, params.bezel, prof, scale, cornerExp);
      maxAbs = dm.maxAbs;
      dispURL = await imageDataToBlobURL(dm.img);
    }
    const specURL = await imageDataToBlobURL(
      buildSpecularMap(w, h, r, params.specAngle, scale, params.specPeak, cornerExp),
    );
    const entry = { dispURL, specURL, maxAbs };
    this.maps.set(key, entry);
    return entry;
  }

  /** Dress one panel exactly as the app does: maps -> filter graph -> inline
   *  backdrop-filter chain. `base` is the panel's CSS blur/saturate base. */
  async dress(el, kind, params, base) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const radius = params.radius;
    const entry = await this.mapsFor(kind, rect.width, rect.height, radius, params);
    const id = `lab-lg-${++this.seq}`;
    const withDim = kind !== 'drop' && params.dim > 0;
    const node = buildFilterNode(
      document,
      id,
      entry.dispURL,
      entry.specURL,
      entry.maxAbs,
      params,
      withDim,
      rect.width,
      rect.height,
    );
    ensuredDefs().appendChild(node);
    el.style.backdropFilter = `${base} url(#${id})`;
    el.style.webkitBackdropFilter = `${base} url(#${id})`;
    el.dataset.labFilter = id;
    this.dressed.add(el);
  }

  undressAll() {
    for (const el of this.dressed) {
      el.style.backdropFilter = '';
      el.style.webkitBackdropFilter = '';
      delete el.dataset.labFilter;
    }
    this.dressed.clear();
    const svg = document.getElementById('lab-defs');
    if (svg) svg.remove();
    this.maps.clear();
    releaseURLs(); // blob: URLs leak for the document lifetime otherwise
    this.seq = 0;
  }
}
