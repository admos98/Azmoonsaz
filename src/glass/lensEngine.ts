/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass map engine — EXACT port of the playground's physics
 * (playground.js: refract2D / computeProfile / buildDisplacementMap /
 * buildSpecularMap, convex_squircle only — the app's single surface). Maps are
 * generated AT RUNTIME per panel size, so a 326x64 hero and a 1240x800 section
 * get their own edge-weighted field instead of one pre-baked PNG being
 * stretched (the squash + misplaced-band bug).
 *
 * Render contract (proven in docs/liquid-glass-engine-audit.md — DO NOT
 * "simplify" any of these back):
 *  1. <filter> carries an EXPLICIT region (x=0 y=0 100% 100%). With the
 *     default region (-10%..120%) a percentage feImage subregion resolves
 *     against the region and the maps never paint where designed — the
 *     whole panel shifts by scale/2.
 *  2. feImage sizes are ABSOLUTE element px (the playground's contract).
 *     External file hrefs never load inside backdrop-filter chains; only
 *     data URIs do (the maps arrive as data URIs from imageDataToURL).
 *  3. NO feGaussianBlur in the chain. Backdrop blur lives in the CSS chain
 *     (blur() saturate() url(#id)) — GPU-composited — and the SVG chain only
 *     bends the already-blurred backdrop, in the playground's order.
 *
 * DOM-free: unit-testable. Strings that end up in SVG go through esc().
 */

const IOR = 1.5; // glass refractive index (kube.io default)
const SAMPLES = 256;

/** Maps are smooth gradients: clamp the build resolution to [1, 2] device px
 *  per CSS px. Never force 2 on a 1x display (4x pixels for nothing), never
 *  exceed 2 (unbounded cost on 3x phones). Resolved per build, not per
 *  session, so browser zoom re-resolves correctly. */
export function mapDPR(dpr: number = window.devicePixelRatio || 1): number {
  return Math.min(2, Math.max(1, dpr));
}

export interface LensParams {
  bezel: number; // px — ring width
  thickness: number; // px — how deep the glass rock sits
  refraction: number; // level
  scaleRatio: number; // overall multiplier
  specOpacity: number; // feFuncA slope on the specular highlight
  specSaturation: number; // feColorMatrix saturate inside the specular ring
  specAngle: number; // deg
  dim: number; // rgb-dim wash 0..1 (per theme)
  dimTint: [number, number, number]; // 0..255
}

/** generate[pan] one panel's filter — never cache across a param change. */
export function effectiveScale(maxAbs: number, p: LensParams): number {
  return 2 * maxAbs * p.refraction * p.scaleRatio;
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

/* Rounded-rect border distance — signed component form (article's Qt). */
function borderSDF(x: number, y: number, w: number, h: number, p: number): [number, number] {
  const l = x < p ? x - p : x >= w - p ? x - (w - p) : 0;
  const m = y < p ? y - p : y >= h - p ? y - (h - p) : 0;
  return [l, m];
}

/** Displacement map (R = Δx, G = Δy, 128 neutral, B unused, A 255). Built at
 *  the panel's REAL css size × dpr so the ring stays physical at any aspect —
 *  the exact routine the playground runs per tuning. */
export function buildDisplacementMap(
  wCss: number,
  hCss: number,
  radiusCss: number,
  bezelCss: number,
  profile: Float64Array,
  dpr: number = mapDPR(),
): { img: ImageData; maxAbs: number; W: number; H: number } {
  const W = Math.max(2, Math.round(wCss * dpr));
  const H = Math.max(2, Math.round(hCss * dpr));
  const img = new ImageData(W, H);
  new Uint32Array(img.data.buffer).fill(0xff008080); // 128,128,0,255
  const p = Math.min(radiusCss * dpr, Math.min(W, H) / 2 - 1);
  const bez = Math.max(0.75, bezelCss * dpr);
  const gOut = (p + 1) ** 2;
  const gIn = p * p;
  const gLo = (p - bez) ** 2;
  const n = profile.length;
  let maxAbs = 0;
  for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(profile[i] || 0));
  if (maxAbs < 1e-6) maxAbs = 1;
  const d8 = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [l, m] = borderSDF(x, y, W, H, p);
      const S = l * l + m * m;
      if (S > gOut || S < gLo) continue;
      const t = Math.sqrt(S);
      if (t < 1e-6) continue;
      let fade = 1;
      if (S > gIn) fade = Math.max(0, 1 - (t - p)); // 1px AA ring
      const rD = p - t; // distance from border
      const c = profile[Math.min(n - 1, ((rD / bez) * n) | 0)] || 0;
      const v = c / maxAbs; // normalized [-1,1]
      const ux = -l / t;
      const uy = -m / t; // inward unit vector
      const i = (y * W + x) * 4;
      d8[i] = 128 + ux * v * 127 * fade;
      d8[i + 1] = 128 + uy * v * 127 * fade;
      d8[i + 2] = 0;
      d8[i + 3] = 255;
    }
  }
  return { img, maxAbs, W, H };
}

/** Specular rim: white-ish grey, alpha = cos²(normal − light) × bump peaked
 *  1px inside the border, zero at the border (playground's reverse-engineered
 *  ring). Same size as the displacement map so both feImages line up. */
export function buildSpecularMap(
  wCss: number,
  hCss: number,
  radiusCss: number,
  angleDeg: number,
  dpr: number = mapDPR(),
): ImageData {
  const W = Math.max(2, Math.round(wCss * dpr));
  const H = Math.max(2, Math.round(hCss * dpr));
  const img = new ImageData(W, H);
  const p = Math.min(radiusCss * dpr, Math.min(W, H) / 2 - 1);
  const gOut = (p + 1) ** 2;
  const L = (angleDeg * Math.PI) / 180;
  const ring = 2 * dpr;
  const peak = 1 * dpr;
  const d8 = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [l, m] = borderSDF(x, y, W, H, p);
      const S = l * l + m * m;
      if (S > gOut) continue;
      const t = Math.sqrt(S);
      if (t < 1e-6) continue;
      const rD = p - t;
      if (rD > ring) continue;
      const k = (rD - peak) / peak; // parabolic window
      const bump = 1 - k * k;
      if (bump <= 0) continue;
      const theta = Math.atan2(m, l); // outward normal angle
      const cv = Math.cos(theta - L);
      const it = cv * cv * bump; // cos² × bump
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

/** One shared canvas for URL encoding — a fresh canvas per map was GC churn
 *  during rebuild storms. */
let urlCanvas: HTMLCanvasElement | null = null;

/** ImageData → data URL (the playground's toURL, canvas path). */
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

/* ── Filter builder — the playground's renderFilter() ordering, per panel ──
   The backdrop blur is NOT in here: it arrives pre-applied via the CSS chain
   (`backdrop-filter: blur() saturate() url(#id)`), so this chain receives the
   already-blurred backdrop as SourceGraphic and only bends/saturates/rims it.
   Region + absolute feImage sizes are the render contract (see header). */

const esc = (s: string | number) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A fresh <filter> markup string for one panel (lens = with displacement,
 *  pane = rim only, drop = disc, dim applied only when withDim). W/H are the
 *  element's CSS px — feImage sizes must match them EXACTLY. */
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
      <feFuncR type="linear" slope="${esc(r[0].toFixed(4))}" intercept="${esc(r[1].toFixed(4))}"/>
      <feFuncG type="linear" slope="${esc(g[0].toFixed(4))}" intercept="${esc(g[1].toFixed(4))}"/>
      <feFuncB type="linear" slope="${esc(b[0].toFixed(4))}" intercept="${esc(b[1].toFixed(4))}"/>`
    : `
      <feFuncR type="linear" slope="1" intercept="0"/>
      <feFuncG type="linear" slope="1" intercept="0"/>
      <feFuncB type="linear" slope="1" intercept="0"/>`;
  const displace = dispURL != null
    ? `
      <feImage href="${esc(dispURL)}" x="0" y="0" width="${esc(W)}" height="${esc(H)}" result="displacement_map"/>
      <feDisplacementMap in="SourceGraphic" in2="displacement_map"
               scale="${esc(effectiveScale(maxAbs, p).toFixed(3))}"
               xChannelSelector="R" yChannelSelector="G" result="displaced"/>`
    : `
      <feOffset in="SourceGraphic" dx="0" dy="0" result="displaced"/>`;
  return `<filter id="${esc(id)}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${displace}
      <feColorMatrix in="displaced" type="saturate" values="${esc(p.specSaturation)}" result="displaced_saturated"/>
      <feComponentTransfer in="displaced" result="rgb_dimmed">${dim}
      </feComponentTransfer>
      <feComponentTransfer in="displaced_saturated" result="saturated_dimmed">${dim}
      </feComponentTransfer>
      <feImage href="${esc(specURL)}" x="0" y="0" width="${esc(W)}" height="${esc(H)}" result="specular_layer"/>
      <feComposite in="saturated_dimmed" in2="specular_layer" operator="in" result="specular_saturated"/>
      <feComponentTransfer in="specular_layer" result="specular_faded">
        <feFuncA type="linear" slope="${esc(p.specOpacity)}"/>
      </feComponentTransfer>
      <feBlend in="specular_saturated" in2="rgb_dimmed" mode="normal" result="withSaturation"/>
      <feBlend in="specular_faded" in2="withSaturation" mode="normal"/>
    </filter>`;
}
