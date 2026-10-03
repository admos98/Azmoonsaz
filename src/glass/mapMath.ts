/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass map math — the playground's physics, DOM-FREE (runs on the
 * main thread AND inside the map worker; only ImageData/canvas primitives
 * that exist in both contexts are used).
 *
 * Render contract (proven in docs/liquid-glass-engine-audit.md — DO NOT
 * "simplify" any of these back):
 *  1. <filter> carries an EXPLICIT region (x=0 y=0 100% 100%). With the
 *     default region (-10%..120%) a percentage feImage subregion resolves
 *     against the region and the maps never paint where designed — the
 *     whole panel shifts by scale/2.
 *  2. feImage sizes are ABSOLUTE element px (the playground's contract).
 *     External file hrefs never load inside backdrop-filter chains; maps
 *     arrive as data URIs (sync fallback) or blob: object URLs (worker path,
 *     verified live in Chromium: feImage resolves blob: inside
 *     backdrop-filter, and CSP img-src already allows blob:).
 *  3. NO feGaussianBlur in the chain. Backdrop blur lives in the CSS chain
 *     (blur() saturate() url(#id)) — GPU-composited — and the SVG chain only
 *     bends the already-blurred backdrop, in the playground's order.
 *
 * Corner geometry — Apple's signature curve: CSS paints the panel with
 * corner-shape: superellipse(--corner-exp) (continuous curvature, no tangent
 * break where the arc meets the edge), so the refracted rim must follow the
 * SAME superellipse. PARAMETERIZATION (measured in Chromium 153 by hit-testing
 * rendered corners — scripts/corner_probe2.html): CSS `superellipse(k)` paints
 * |x|^n + |y|^n = 1 with n = 2^k — k=1 IS the circle (Chromium even serializes
 * the `round` keyword back out as superellipse(1)), k=3 paints n=8. The old
 * maps used n = k directly (a circle at k=2, a much-round n=3 curve at k=3),
 * so the rim ring departed from the panel corner exactly where the curve is
 * most visible — the user's "double corners" screenshots. borderSDF therefore
 * raises to n = 2^k (fast repeated-squaring path for the default k=3 → n=8).
 * Browsers WITHOUT corner-shape support paint circular corners — the engine
 * passes k=1 (n=2, exact circle) so the maps degrade with the paint.
 * Pills/circles/drops keep the exact circle regardless (circleMode), matching
 * the CSS-side `corner-shape: round` exemption.
 */

/** Glass refractive index (kube.io default). */
export const IOR = 1.5;

/** Profile samples per ring. */
export const SAMPLES = 256;

/** Upper bound on map side in px. Maps are smooth gradients; the browser
 *  upscales them to the element with bilinear filtering, so a 1024px cap on
 *  the long side keeps the rim mathematically identical while cutting the
 *  per-pixel loop + PNG encode by 4-16x on hero-size panels. */
export const MAX_MAP_SIDE = 1024;

/** Map px per CSS px. Gradients survive scaling perfectly (the interior is
 *  flat-neutral, the ring is a smooth ramp), so 1x is indistinguishable from
 *  2x here while being 4x cheaper — and the specular ring is defined in CSS
 *  px, so its on-screen width never changes. */
export function mapScaleFor(wCss: number, hCss: number): number {
  return Math.min(1, MAX_MAP_SIDE / Math.max(wCss, hCss, 1));
}

export interface LensParams {
  bezel: number; // px — ring width
  thickness: number; // px — how deep the glass rock sits
  refraction: number; // level
  scaleRatio: number; // overall multiplier
  specOpacity: number; // feFuncA slope on the specular highlight
  specSaturation: number; // feColorMatrix saturate inside the specular ring
  specAngle: number; // deg
  specPeak: number; // px — rim half-width (rim = 2 * specPeak CSS px)
  cornerExp: number; // superellipse exponent, must match CSS --corner-exp
  dim: number; // rgb-dim wash 0..1 (per theme)
  dimTint: [number, number, number]; // 0..255
}

function refract2D(nx: number, ny: number, eta: number): [number, number] | null {
  const r = 1 - eta * eta * (1 - ny * ny);
  if (r < 0) return null;
  const i = Math.sqrt(r);
  return [-(eta * ny + i) * nx, eta - (eta * ny + i) * ny];
}

const surface = (s: number): number => (1 - (1 - s) ** 4) ** 0.25; // squircle

/** Displacement profile: horizontal shift of a ray hitting the bezel at
 *  normalized distance s from the border. Monotone head + 2x box smooth. */
export function computeProfile(bezelPx: number, thicknessPx: number): Float64Array {
  const eta = 1 / IOR;
  const out = new Float64Array(SAMPLES);
  const cl = (v: number) => Math.min(1, Math.max(0, v));
  for (let k = 0; k < SAMPLES; k++) {
    const s = k / SAMPLES;
    const c = surface(s);
    const eps = s < 1 ? 1e-4 : -1e-4;
    const u = (surface(cl(s + eps)) - c) / eps;
    const d = Math.hypot(u, 1);
    const n = refract2D(-u / d, -1 / d, eta);
    out[k] = n ? n[0] * ((c * thicknessPx + bezelPx) / n[1]) : 0;
  }
  out[0] = out[1];
  for (let i = 2; i < SAMPLES; i++) {
    if (Math.abs(out[i]) > Math.abs(out[i - 1])) out[i] = out[i - 1];
  }
  for (let pass = 0; pass < 2; pass++) {
    const tmp = Float64Array.from(out);
    for (let i = 1; i < SAMPLES - 1; i++) {
      out[i] = (tmp[i - 1] + 2 * tmp[i] + tmp[i + 1]) / 4;
    }
  }
  out[SAMPLES - 1] = 0;
  return out;
}

/* ── Border SDF — signed axis distances + superellipse measure ───────────
   (l, m) = signed distances from the straight-edge lines (negative inside).
   Circles: border at hypot(l, m) == p. Superellipse(k): border where
   (u^k + v^k)^(1/k) == p with u = |l|, v = |m|; the inward normal and the
   true normal distance come from the gradient of that measure.
   Scratch vector avoids per-pixel allocation. Returns [rD, ux, uy, theta]:
   rD = distance inside the border (negative in the 1px AA fringe outside),
   (ux, uy) = unit inward normal, theta = outward normal angle (rad). */
const sdfOut = new Float64Array(4);

function borderSDF(
  l: number,
  m: number,
  p: number,
  k: number,
  circleMode: boolean,
): Float64Array {
  const u = l < 0 ? -l : l;
  const v = m < 0 ? -m : m;
  const sl = l < 0 ? -1 : 1;
  const sm = m < 0 ? -1 : 1;
  // Straight-edge zones: one axis distance is zero — normal is the axis.
  if (u === 0 || v === 0) {
    const s = u === 0 ? v : u; // distance-to-corner-line along the axis
    sdfOut[0] = p - s;
    if (v === 0) {
      sdfOut[1] = -sl;
      sdfOut[2] = 0;
      sdfOut[3] = Math.atan2(0, l);
    } else {
      sdfOut[1] = 0;
      sdfOut[2] = -sm;
      sdfOut[3] = Math.atan2(m, 0);
    }
    return sdfOut;
  }
  if (circleMode || k <= 1.0001) {
    const t = Math.sqrt(u * u + v * v);
    if (t < 1e-6) {
      sdfOut[0] = p;
      sdfOut[1] = 0;
      sdfOut[2] = -sm;
      sdfOut[3] = Math.atan2(m, l);
      return sdfOut;
    }
    sdfOut[0] = p - t;
    sdfOut[1] = -l / t;
    sdfOut[2] = -m / t;
    sdfOut[3] = Math.atan2(m, l);
    return sdfOut;
  }
  // Superellipse corner, Chromium parameterization: the painted curve is
  // |x|^n + |y|^n = 1 with n = 2^k (k = --corner-exp). Gradient math (same
  // shape as before, n in place of k):
  //   S        = (u^n + v^n)^(1/n)
  //   |grad S| = sqrt(u^(2n-2) + v^(2n-2)) / (u^n + v^n)^(1 - 1/n)
  //   rD       = (p - S) / |grad S|
  //   normal   ∝ (u^(n-1)·sign(l), v^(n-1)·sign(m))
  // Fast paths: n=8 (the app default, k=3) via repeated squaring; n=4 (k=2)
  // likewise; anything else falls back to Math.pow.
  const k3 = Math.abs(k - 3) < 1e-9; // n = 8 — the app default
  const k2 = !k3 && Math.abs(k - 2) < 1e-9; // n = 4
  let n: number, sum: number, S: number, ukm1: number, vkm1: number;
  if (k3) {
    const u2 = u * u;
    const v2 = v * v;
    const u8 = u2 * u2 * u2 * u2;
    const v8 = v2 * v2 * v2 * v2;
    sum = u8 + v8;
    S = Math.pow(sum, 0.125);
    ukm1 = u8 / u; // u^7
    vkm1 = v8 / v; // v^7
  } else if (k2) {
    const u2 = u * u;
    const v2 = v * v;
    const u4 = u2 * u2;
    const v4 = v2 * v2;
    sum = u4 + v4;
    S = Math.sqrt(Math.sqrt(sum));
    ukm1 = u4 / u; // u^3
    vkm1 = v4 / v; // v^3
  } else {
    n = Math.pow(2, k);
    const un = Math.pow(u, n);
    const vn = Math.pow(v, n);
    sum = un + vn;
    S = Math.pow(sum, 1 / n);
    ukm1 = Math.pow(u, n - 1);
    vkm1 = Math.pow(v, n - 1);
  }
  const W = Math.sqrt(ukm1 * ukm1 + vkm1 * vkm1);
  const inv = W > 0 ? 1 / W : 0;
  // (u^n+v^n)^(1-1/n) == S^(n-1) — the |grad S| correction factor
  const corr = k3
    ? S * S * S * S * S * S * S // S^7
    : k2
      ? S * S * S // S^3
      : Math.pow(S, n! - 1);
  sdfOut[0] = (p - S) * corr * inv;
  sdfOut[1] = -sl * ukm1 * inv;
  sdfOut[2] = -sm * vkm1 * inv;
  sdfOut[3] = Math.atan2(sm * vkm1, sl * ukm1);
  return sdfOut;
}

/** True when the element is a pill/circle (radius >= half the short side):
 *  CSS keeps those `corner-shape: round`, the map must agree. */
export function isCircleRadius(wCss: number, hCss: number, radiusCss: number): boolean {
  return radiusCss >= Math.min(wCss, hCss) / 2 - 0.75;
}

/** The corner exponent the MAPS must use for the corners CSS actually paints.
 *  Chromium paints superellipse(k) as n = 2^k; browsers without corner-shape
 *  support degrade every corner to a plain circle — k=1 (n=2) matches that
 *  exactly. Probe: scripts/corner_probe2.html (hit-tested Chromium 153). */
export function mapCornerExp(cssExp: number, cornerShapeSupported: boolean): number {
  return cornerShapeSupported ? Math.min(6, Math.max(1, cssExp)) : 1;
}

/** Displacement map (R = Δx, G = Δy, 128 neutral, B unused, A 255). Built at
 *  the element's CSS size × scale so the ring stays physical at any aspect —
 *  the exact routine the playground runs per tuning, now on the superellipse
 *  corner the panel is actually painted with. */
export function buildDisplacementMap(
  wCss: number,
  hCss: number,
  radiusCss: number,
  bezelCss: number,
  profile: Float64Array,
  scale: number = 1,
  cornerExp: number = 3,
): { img: ImageData; maxAbs: number; W: number; H: number } {
  const W = Math.max(2, Math.round(wCss * scale));
  const H = Math.max(2, Math.round(hCss * scale));
  const img = new ImageData(W, H);
  new Uint32Array(img.data.buffer).fill(0xff008080); // 128,128,0,255
  const p = Math.min(radiusCss * scale, Math.min(W, H) / 2 - 1);
  if (p <= 0) return { img, maxAbs: 1, W, H };
  const bez = Math.max(0.75, bezelCss * scale);
  const k = cornerExp;
  const circleMode = isCircleRadius(wCss * scale, hCss * scale, radiusCss * scale);
  const n = profile.length;
  let maxAbs = 0;
  for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(profile[i] || 0));
  if (maxAbs < 1e-6) maxAbs = 1;
  const d8 = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // signed axis distances from the straight-edge lines
      const l = x < p ? x - p : x >= W - p ? x - (W - p) : 0;
      const m = y < p ? y - p : y >= H - p ? y - (H - p) : 0;
      // fast reject on the straight-edge zones: the ring band lives within
      // [p - bez, p + 1) of the corner-line measure — everything else is the
      // neutral fill the Uint32Array painted. Corner-box pixels fall through
      // to the full SDF (only ~4·p² of them).
      const u = l < 0 ? -l : l;
      const v = m < 0 ? -m : m;
      if (u === 0 || v === 0) {
        const s = u > v ? u : v;
        if (s < p - bez || s >= p + 1) continue;
      }
      const sdf = borderSDF(l, m, p, k, circleMode);
      const rD = sdf[0];
      if (rD > bez || rD <= -1) continue;
      let fade = 1;
      if (rD < 0) fade = 1 + rD; // 1px AA ring outside the border
      const c = profile[Math.min(n - 1, Math.max(0, ((rD / bez) * n) | 0))] || 0;
      const val = c / maxAbs; // normalized [-1,1]
      const i = (y * W + x) * 4;
      d8[i] = 128 + sdf[1] * val * 127 * fade;
      d8[i + 1] = 128 + sdf[2] * val * 127 * fade;
      d8[i + 2] = 0;
      d8[i + 3] = 255;
    }
  }
  return { img, maxAbs, W, H };
}

/** Specular rim: white-ish grey, alpha = cos²(normal − light) × parabolic
 *  bump peaked `peak` px inside the border, zero at the border (the
 *  playground's reverse-engineered ring, widened per the app's rim tune —
 *  rim width = 2 × specPeak CSS px). Same SDF as the displacement map so
 *  both feImages line up on the superellipse corner. */
export function buildSpecularMap(
  wCss: number,
  hCss: number,
  radiusCss: number,
  angleDeg: number,
  scale: number = 1,
  peakCss: number = 2,
  cornerExp: number = 3,
): ImageData {
  const W = Math.max(2, Math.round(wCss * scale));
  const H = Math.max(2, Math.round(hCss * scale));
  const img = new ImageData(W, H);
  const p = Math.min(radiusCss * scale, Math.min(W, H) / 2 - 1);
  if (p <= 0) return img;
  const L = (angleDeg * Math.PI) / 180;
  const peak = Math.max(0.5, peakCss * scale);
  const ring = peak * 2;
  const circleMode = isCircleRadius(wCss * scale, hCss * scale, radiusCss * scale);
  const k = cornerExp;
  const d8 = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = x < p ? x - p : x >= W - p ? x - (W - p) : 0;
      const m = y < p ? y - p : y >= H - p ? y - (H - p) : 0;
      const u = l < 0 ? -l : l;
      const v = m < 0 ? -m : m;
      if (u === 0 || v === 0) {
        const s = u > v ? u : v;
        if (s < p - ring || s >= p + 1) continue;
      }
      const sdf = borderSDF(l, m, p, k, circleMode);
      const rD = sdf[0];
      if (rD < 0 || rD > ring) continue;
      const kk = (rD - peak) / peak; // parabolic window
      const bump = 1 - kk * kk;
      if (bump <= 0) continue;
      const theta = sdf[3]; // outward normal angle
      const cv = Math.cos(theta - L);
      const it = cv * cv * bump;
      const A = Math.min(255, Math.round(it * 255));
      if (A <= 0) continue;
      const G = Math.min(255, Math.round(Math.sqrt(it) * 255));
      const i = (y * W + x) * 4;
      d8[i] = G;
      d8[i + 1] = G;
      d8[i + 2] = G;
      d8[i + 3] = A;
    }
  }
  return img;
}

/** Per-channel RGB-aware dim wash (ratios 1 : 1.0526 : 1.474 over the tint) —
 *  exact port of the playground's dimParams(). */
export function dimParams(p: LensParams): Array<[number, number]> {
  const b = p.dim;
  const t = p.dimTint;
  return [
    [1 - b, (b * t[0]) / 255],
    [1 - b * 1.0526, (b * 1.0526 * t[1]) / 255],
    [1 - Math.min(1, b * 1.4737), (Math.min(1, b * 1.4737) * t[2]) / 255],
  ];
}
