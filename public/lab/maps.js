/**
 * Liquid-glass map math — a faithful port of src/glass/mapMath.ts.
 *
 * WHY A PORT: the lab must run as a static page (Vite serves public/ verbatim,
 * Vercel ships it as-is), so it cannot import the app's TypeScript modules.
 * The math below is a line-by-line transcription of the app's source; the
 * numeric output is identical for identical inputs. If mapMath.ts changes,
 * this file must change with it — see the pinned-token block in glass-lab.css
 * for the other half of the contract.
 *
 * Render contract (copied from the app — do not "simplify"):
 *  1. <filter> carries an EXPLICIT region (x=0 y=0 100% 100%). With the default
 *     region a percentage feImage subregion resolves against the region.
 *  2. feImage sizes are ABSOLUTE element px.
 *  3. NO feGaussianBlur in the chain — backdrop blur lives in the CSS chain.
 */

export const IOR = 1.5;
export const SAMPLES = 256;
export const MAX_MAP_SIDE = 1024;

export function mapScaleFor(wCss, hCss) {
  return Math.min(1, MAX_MAP_SIDE / Math.max(wCss, hCss, 1));
}

function refract2D(nx, ny, eta) {
  const r = 1 - eta * eta * (1 - ny * ny);
  if (r < 0) return null;
  const i = Math.sqrt(r);
  return [-(eta * ny + i) * nx, eta - (eta * ny + i) * ny];
}

const surface = (s) => (1 - (1 - s) ** 4) ** 0.25; // squircle

/** Displacement profile: horizontal shift of a ray hitting the bezel. */
export function computeProfile(bezelPx, thicknessPx) {
  const eta = 1 / IOR;
  const out = new Float64Array(SAMPLES);
  const cl = (v) => Math.min(1, Math.max(0, v));
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

const sdfOut = new Float64Array(4);

function borderSDF(l, m, p, k, circleMode) {
  const u = l < 0 ? -l : l;
  const v = m < 0 ? -m : m;
  const sl = l < 0 ? -1 : 1;
  const sm = m < 0 ? -1 : 1;
  if (u === 0 || v === 0) {
    const s = u === 0 ? v : u;
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
  const k3 = Math.abs(k - 3) < 1e-9;
  const k2 = !k3 && Math.abs(k - 2) < 1e-9;
  let n, sum, S, ukm1, vkm1;
  if (k3) {
    const u2 = u * u;
    const v2 = v * v;
    const u8 = u2 * u2 * u2 * u2;
    const v8 = v2 * v2 * v2 * v2;
    sum = u8 + v8;
    S = Math.pow(sum, 0.125);
    ukm1 = u8 / u;
    vkm1 = v8 / v;
  } else if (k2) {
    const u2 = u * u;
    const v2 = v * v;
    const u4 = u2 * u2;
    const v4 = v2 * v2;
    sum = u4 + v4;
    S = Math.sqrt(Math.sqrt(sum));
    ukm1 = u4 / u;
    vkm1 = v4 / v;
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
  const corr = k3 ? S * S * S * S * S * S * S : k2 ? S * S * S : Math.pow(S, n - 1);
  sdfOut[0] = (p - S) * corr * inv;
  sdfOut[1] = -sl * ukm1 * inv;
  sdfOut[2] = -sm * vkm1 * inv;
  sdfOut[3] = Math.atan2(sm * vkm1, sl * ukm1);
  return sdfOut;
}

export function isCircleRadius(wCss, hCss, radiusCss) {
  return radiusCss >= Math.min(wCss, hCss) / 2 - 0.75;
}

export function mapCornerExp(cssExp, cornerShapeSupported) {
  return cornerShapeSupported ? Math.min(6, Math.max(1, cssExp)) : 1;
}

export function buildDisplacementMap(wCss, hCss, radiusCss, bezelCss, profile, scale = 1, cornerExp = 3) {
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
      const l = x < p ? x - p : x >= W - p ? x - (W - p) : 0;
      const m = y < p ? y - p : y >= H - p ? y - (H - p) : 0;
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
      if (rD < 0) fade = 1 + rD;
      const c = profile[Math.min(n - 1, Math.max(0, ((rD / bez) * n) | 0))] || 0;
      const val = c / maxAbs;
      const i = (y * W + x) * 4;
      d8[i] = 128 + sdf[1] * val * 127 * fade;
      d8[i + 1] = 128 + sdf[2] * val * 127 * fade;
      d8[i + 2] = 0;
      d8[i + 3] = 255;
    }
  }
  return { img, maxAbs, W, H };
}

export function buildSpecularMap(wCss, hCss, radiusCss, angleDeg, scale = 1, peakCss = 2, cornerExp = 3) {
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
      const kk = (rD - peak) / peak;
      const bump = 1 - kk * kk;
      if (bump <= 0) continue;
      const theta = sdf[3];
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

export function dimStrength(p) {
  return Math.max(0, Math.min(0.5, p.dim));
}

/** One channel of the wash, 0..255. Mirrors src/glass/mapMath.ts exactly. */
export function dimChannel(inp, b, tintCh, lift = 0) {
  const x = Math.max(0, Math.min(255, inp));
  const t = Math.max(0, Math.min(255, tintCh));
  const k = Math.max(0, Math.min(0.5, b));
  const w = x + k * (x / 255) * (t - x);
  /* White-veil lift (dark theme) — input-weighted (1−x)², mirrors mapMath:
     lifts deep darks ≈ L·255, exactly 0 at white. */
  const L = Math.max(0, Math.min(0.25, lift));
  if (L === 0) return w;
  const u = 1 - x / 255;
  return w + L * 255 * u * u;
}

/** feFunc tableValues for one channel: 33 samples, linear interpolation. */
export function dimTableValues(b, tintCh, lift = 0) {
  const n = 33;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push((dimChannel((255 * i) / (n - 1), b, tintCh, lift) / 255).toFixed(4));
  }
  return out.join(' ');
}

export function effectiveScale(maxAbs, p) {
  return 2 * maxAbs * p.refraction * p.scaleRatio;
}

let urlCanvas = null;

/**
 * PNG-encode an ImageData into a URL for feImage.
 *
 * CSP: production ships `img-src 'self' blob: https://*.supabase.co` — `data:`
 * is NOT allowed, so `toDataURL()` is refused by the browser and the whole
 * filter graph silently stops bending (measured: 103 CSP violations, bend gone,
 * only the un-filtered blur base left painting). The app solves this the same
 * way — see src/glass/mapWorker.ts, "blob: object URLs for feImage (Chromium
 * resolves blob: inside backdrop-filter; CSP img-src already allows blob:)".
 *
 * Blob URLs must be revoked or they leak for the document's lifetime. The
 * caller tracks and releases them via releaseURLs(); CSS mode rebuilds on every
 * theme/count/mode change, so an un-revoked set grows without bound.
 */
const liveURLs = new Set();

export function imageDataToURL(img) {
  if (!urlCanvas) urlCanvas = document.createElement('canvas');
  const c = urlCanvas;
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  const url = c.toDataURL('image/png'); // data: — kept for the blob: fallback path
  return url;
}

/** Blob-URL encoder: the CSP-safe path. `toBlob` is async. */
export function imageDataToBlobURL(img) {
  return new Promise((resolve, reject) => {
    if (!urlCanvas) urlCanvas = document.createElement('canvas');
    const c = urlCanvas;
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').putImageData(img, 0, 0);
    c.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob returned null'));
        return;
      }
      const url = URL.createObjectURL(blob);
      liveURLs.add(url);
      resolve(url);
    }, 'image/png');
  });
}

/** Revoke every blob URL this module handed out. */
export function releaseURLs() {
  for (const u of liveURLs) URL.revokeObjectURL(u);
  liveURLs.clear();
}

/**
 * Build the <filter> graph with createElementNS — NEVER via innerHTML.
 * A <filter> string written through innerHTML into a plain <div> lands in the
 * HTML namespace: url(#id) then resolves to nothing and the bend silently
 * no-ops (measured on the scratch fixture, filterChildCount 1 vs 2). The
 * namespace-safe constructor removes that failure mode entirely.
 *
 * Chain shape mirrors buildFilterMarkup(): displace -> saturate -> mask by the
 * specular alpha -> blend over the raw displaced backdrop -> dim wash -> blend
 * the faded specular on top.
 */
export function buildFilterNode(doc, id, dispURL, specURL, maxAbs, p, withDim, W, H) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name) => doc.createElementNS(NS, name);

  const filter = el('filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  let prev = 'SourceGraphic';
  if (dispURL != null) {
    const img = el('feImage');
    img.setAttribute('href', dispURL);
    img.setAttribute('x', '0');
    img.setAttribute('y', '0');
    img.setAttribute('width', String(W));
    img.setAttribute('height', String(H));
    img.setAttribute('result', 'displacement_map');
    filter.appendChild(img);
    const disp = el('feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'displacement_map');
    disp.setAttribute('scale', effectiveScale(maxAbs, p).toFixed(3));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', 'displaced');
    filter.appendChild(disp);
  } else {
    const off = el('feOffset');
    off.setAttribute('in', 'SourceGraphic');
    off.setAttribute('dx', '0');
    off.setAttribute('dy', '0');
    off.setAttribute('result', 'displaced');
    filter.appendChild(off);
  }

  const sat = el('feColorMatrix');
  sat.setAttribute('in', 'displaced');
  sat.setAttribute('type', 'saturate');
  sat.setAttribute('values', String(p.specSaturation));
  sat.setAttribute('result', 'displaced_saturated');
  filter.appendChild(sat);

  const spec = el('feImage');
  spec.setAttribute('href', specURL);
  spec.setAttribute('x', '0');
  spec.setAttribute('y', '0');
  spec.setAttribute('width', String(W));
  spec.setAttribute('height', String(H));
  spec.setAttribute('result', 'specular_layer');
  filter.appendChild(spec);

  const comp = el('feComposite');
  comp.setAttribute('in', 'displaced_saturated');
  comp.setAttribute('in2', 'specular_layer');
  comp.setAttribute('operator', 'in');
  comp.setAttribute('result', 'rim_saturated');
  filter.appendChild(comp);

  const blend = el('feBlend');
  blend.setAttribute('in', 'rim_saturated');
  blend.setAttribute('in2', 'displaced');
  blend.setAttribute('mode', 'normal');
  blend.setAttribute('result', 'withSaturation');
  filter.appendChild(blend);
  prev = 'withSaturation';

  if (withDim) {
    const b = dimStrength(p);
    const ct = el('feComponentTransfer');
    ct.setAttribute('in', prev);
    ct.setAttribute('result', 'dimmed');
    const add = (ch, i) => {
      const f = el('feFunc' + ch);
      f.setAttribute('type', 'table');
      f.setAttribute('tableValues', dimTableValues(b, p.dimTint[i], p.dimLift));
      ct.appendChild(f);
    };
    add('R', 0);
    add('G', 1);
    add('B', 2);
    filter.appendChild(ct);
    prev = 'dimmed';
  }

  const fade = el('feComponentTransfer');
  fade.setAttribute('in', 'specular_layer');
  fade.setAttribute('result', 'specular_faded');
  const fa = el('feFuncA');
  fa.setAttribute('type', 'linear');
  fa.setAttribute('slope', String(p.specOpacity));
  fade.appendChild(fa);
  filter.appendChild(fade);

  const finalBlend = el('feBlend');
  finalBlend.setAttribute('in', 'specular_faded');
  finalBlend.setAttribute('in2', prev);
  finalBlend.setAttribute('mode', 'normal');
  filter.appendChild(finalBlend);

  return filter;
}
