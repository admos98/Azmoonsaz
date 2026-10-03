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
 * SAME superellipse. The old maps used a circular SDF — the rim ring
 * departed from the panel corner exactly where the curve is most visible.
 * The SDF below measures distance-to-border on a superellipse of exponent k
 * (k=2 degenerates to the exact circle, which is what pills/circles/drops
 * keep — matching the CSS-side `corner-shape: round` exemption).
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
  if (circleMode || Math.abs(k - 2) < 1e-9) {
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
  // Superellipse(k) corner. u^(k-1) etc. — the shared (u^k+v^k) factors of
  // the gradient cancel between the direction and the distance, leaving:
  //   |grad S| = sqrt(u^(2k-2) + v^(2k-2)) / (u^k + v^k)^(1 - 1/k)
  //   rD       = (p - S) / |grad S|
  //   normal   ∝ (u^(k-1)·sign(l), v^(k-1)·sign(m))
  const k3 = Math.abs(k - 3) < 1e-9; // fast path: integer k = the app default
  const uk = k3 ? u * u * u : Math.pow(u, k);
  const vk = k3 ? v * v * v : Math.pow(v, k);
  const sum = uk + vk;
  const S = k3 ? Math.cbrt(sum) : Math.pow(sum, 1 / k);
  const ukm1 = k3 ? u * u : Math.pow(u, k - 1);
  const vkm1 = k3 ? v * v : Math.pow(v, k - 1);
  const W = Math.sqrt(ukm1 * ukm1 + vkm1 * vkm1);
  const inv = W > 0 ? 1 / W : 0;
  // (u^k+v^k)^(1-1/k) == S^2 at k=3 — the |grad S| correction factor
  const corr = k3 ? S * S : Math.pow(sum, 1 - 1 / k);
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
