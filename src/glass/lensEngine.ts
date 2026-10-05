/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass filter builder — the playground's renderFilter() ordering.
 *
 * The map MATH lives in mapMath.ts (DOM-free, shared across the engine so
 * maps build + PNG-encode OFF the main thread). This module keeps the parts
 * that own document policy:
 *   - mapDPR/currentDPR — the display-conditional map resolution;
 *   - buildFilterMarkup — the <filter> string, whose exact shape is pinned
 *     by src/test/config/glassMaterial.test.ts (render contract);
 *   - imageDataToURL — the SYNCHRONOUS fallback encoder (data URIs) used
 *     only when Worker/OffscreenCanvas are unavailable. The fast path hands
 *     ImageData to the worker and gets PNG Blobs back; controller turns
 *     those into blob: object URLs, which Chromium resolves inside feImage
 *     under backdrop-filter (verified live; CSP img-src allows blob:).
 *
 * Render contract (proven in docs/liquid-glass-engine-audit.md — DO NOT
 * "simplify" any of these back):
 *  1. <filter> carries an EXPLICIT region (x=0 y=0 100% 100%). With the
 *     default region (-10%..120%) a percentage feImage subregion resolves
 *     against the region and the maps never paint where designed — the
 *     whole panel shifts by scale/2.
 *  2. feImage sizes are ABSOLUTE element px (the playground's contract).
 *     External file hrefs never load inside backdrop-filter chains; only
 *     data:/blob: URLs do.
 *  3. NO feGaussianBlur in the chain. Backdrop blur lives in the CSS chain
 *     (blur() saturate() url(#id)) — GPU-composited — and the SVG chain only
 *     bends the already-blurred backdrop, in the playground's order.
 */

import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  dimParams,
  mapCornerExp,
  mapScaleFor,
  type LensParams,
} from './mapMath';

export {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  dimParams,
  mapCornerExp,
  mapScaleFor,
};
export type { LensParams };

/** Maps are smooth gradients: clamp the display DPR to [1, 2] device px per
 *  CSS px. Never force 2 on a 1x display (4x pixels for nothing), never
 *  exceed 2 (unbounded cost on 3x phones). Resolved per build, not per
 *  session, so browser zoom re-resolves correctly. mapScaleFor() then caps
 *  the actual map against MAX_MAP_SIDE (gradients survive that scaling
 *  perfectly — the interior is flat-neutral and the ring is a smooth ramp). */
export function mapDPR(dpr: number = window.devicePixelRatio || 1): number {
  return Math.min(2, Math.max(1, dpr));
}

/** generate[pan] one panel's filter — never cache across a param change. */
export function effectiveScale(maxAbs: number, p: LensParams): number {
  return 2 * maxAbs * p.refraction * p.scaleRatio;
}

/** One shared canvas for URL encoding — a fresh canvas per map was GC churn
 *  during rebuild storms. */
let urlCanvas: HTMLCanvasElement | null = null;

/** ImageData → data URL (the SYNC fallback path; the worker path returns
 *  Blobs that the controller turns into object URLs). */
export function imageDataToURL(img: ImageData): string {
  if (!urlCanvas) urlCanvas = document.createElement('canvas');
  const c = urlCanvas;
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function currentDPR(): number {
  return mapDPR();
}

const esc = (s: string | number) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A fresh <filter> markup string for one panel (lens = with displacement,
 *  pane = rim only, drop = disc, dim applied only when withDim). W/H are the
 *  element's CSS px — feImage sizes must match them EXACTLY. The map images
 *  themselves may be smaller (mapScaleFor cap): feImage scales them to W×H,
 *  which is loss-free for smooth gradient fields.
 *
 *  CHAIN SHAPE (perf lever 1, 2026-10-05): the saturate-boosted branch is
 *  masked by the specular alpha and blended over the RAW displaced backdrop;
 *  the rgb-dim wash runs ONCE, AFTER that blend — instead of dimming both
 *  branches before it (two feComponentTransfer passes). dim(x) = slope·x +
 *  intercept is affine and the blend weights sum to 1, so the reorder is
 *  algebraically exact for any backdrop alpha; Chromium clamps the shared
 *  feColorMatrix node before either chain consumes it, so even the
 *  saturate-overflow path (s=4 pushes pure primaries >1) stays in range.
 *  Measured in Chromium on a primary-heavy pattern: max 2/255 LSB, mean
 *  0.14 (scratch/filter-equiv-probe.html). Saves one full-res pass per
 *  frame per panel — two when withDim=false, where the identity dim CTs
 *  are no longer emitted at all. */
export function buildFilterMarkup(
  id: string,
  dispURL: string | null,
  specURL: string,
  maxAbs: number,
  p: LensParams,
  withDim: boolean,
  W: number,
  H: number,
): string {
  const [r, g, b] = dimParams(p);
  const dim = withDim
    ? `
      <feComponentTransfer in="withSaturation" result="dimmed">
        <feFuncR type="linear" slope="${esc(r[0].toFixed(4))}" intercept="${esc(r[1].toFixed(4))}"/>
        <feFuncG type="linear" slope="${esc(g[0].toFixed(4))}" intercept="${esc(g[1].toFixed(4))}"/>
        <feFuncB type="linear" slope="${esc(b[0].toFixed(4))}" intercept="${esc(b[1].toFixed(4))}"/>
      </feComponentTransfer>`
    : '';
  // withDim=false: no dim CT at all (the old chain emitted two identity
  // feComponentTransfer passes there — pure full-res cost, zero pixels).
  const dimDst = withDim ? 'dimmed' : 'withSaturation';
  const displace =
    dispURL != null
      ? `
      <feImage href="${esc(dispURL)}" x="0" y="0" width="${esc(W)}" height="${esc(H)}" result="displacement_map"/>
      <feDisplacementMap in="SourceGraphic" in2="displacement_map"
               scale="${esc(effectiveScale(maxAbs, p).toFixed(3))}"
               xChannelSelector="R" yChannelSelector="G" result="displaced"/>`
      : `
      <feOffset in="SourceGraphic" dx="0" dy="0" result="displaced"/>`;
  return `<filter id="${esc(id)}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${displace}
      <feColorMatrix in="displaced" type="saturate" values="${esc(p.specSaturation)}" result="displaced_saturated"/>
      <feImage href="${esc(specURL)}" x="0" y="0" width="${esc(W)}" height="${esc(H)}" result="specular_layer"/>
      <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="rim_saturated"/>
      <feBlend in="rim_saturated" in2="displaced" mode="normal" result="withSaturation"/>${dim}
      <feComponentTransfer in="specular_layer" result="specular_faded">
        <feFuncA type="linear" slope="${esc(p.specOpacity)}"/>
      </feComponentTransfer>
      <feBlend in="specular_faded" in2="${dimDst}" mode="normal"/>
    </filter>`;
}
