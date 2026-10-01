'use strict';
/* ════════════════════════════════════════════════════════════════════
   Liquid Glass engine — faithful port of kube.io/blog/liquid-glass-css-svg
   • surface functions        (article §Creating the Glass Surface)
   • displacement profile     (article §Vector Field, Zt — Snell refraction)
   • displacement map         (article §SVG Displacement Map, Qt)
   • specular map             (article §Specular Highlight — normal·light ring)
   • filter chain             (article §Combining — feImage/feDisplacementMap/
                              feColorMatrix/feComposite/feFuncA/feBlend)
   ════════════════════════════════════════════════════════════════════ */

let DPR = Math.min(window.devicePixelRatio || 1, 2);
const FID = 'lgf';
const IOR = 1.5;                     // glass refractive index (article default)

/* ── Surface height functions f(distanceFromSide 0→1) → height 0→1 ── */
const SURFACES = [
  { id:'convex_circle',   label:'Convex Circle',
    fn:s => Math.sqrt(1 - (1 - s) ** 2) },
  { id:'convex_squircle', label:'Convex Squircle',
    fn:s => (1 - (1 - s) ** 4) ** 0.25 },
  { id:'concave',         label:'Concave',
    fn:s => 1 - Math.sqrt(1 - (1 - s) ** 2) },
  { id:'lip',             label:'Lip',
    fn:s => { const a = (1 - (1 - s * 2) ** 4) ** 0.25,
                   b = 1 - Math.sqrt(1 - (1 - s) ** 2) + 0.1,
                   k = 6 * s ** 5 - 15 * s ** 4 + 10 * s ** 3;
              return a * (1 - k) + b * k; } }
];
const surfaceById = id => SURFACES.find(s => s.id === id) || SURFACES[1];

/* Snell refraction of a vertical ray about a 2-D surface normal.
   Identical to the article's refract(): returns null on total internal
   reflection, else the refracted direction [tx, ty] (ty > 0 = downward). */
function refract2D(nx, ny, eta) {
  const r = 1 - eta * eta * (1 - ny * ny);
  if (r < 0) return null;                       // total internal reflection
  const i = Math.sqrt(r);
  return [-(eta * ny + i) * nx, eta - (eta * ny + i) * ny];
}

/* Displacement profile: horizontal shift (px) of a ray that hits the
   bezel at normalized distance s from the border. 127-ray idea from the
   article; we sample 256 points and interpolate in the map builder.     */
function computeProfile(bezelPx, thicknessPx, surfaceFn, samples = 256) {
  const eta = 1 / IOR;
  const out = new Float64Array(samples);
  const cl = v => Math.min(1, Math.max(0, v));
  for (let k = 0; k < samples; k++) {
    const s = k / samples;
    const c = surfaceFn(s);                     // height at this point
    const eps = s < 1 ? 1e-4 : -1e-4;           // numeric derivative
    const u = (surfaceFn(cl(s + eps)) - c) / eps;
    const d = Math.hypot(u, 1);
    const n = refract2D(-u / d, -1 / d, eta);   // normal, rotated -90°
    if (n) {
      const depth = c * thicknessPx + bezelPx;  // ray origin height
      out[k] = n[0] * (depth / n[1]);
    } else out[k] = 0;
  }
  return out;
}

/* Rounded-rect border distance helpers — signed component form used by
   the article's Qt: l/d are distances from the inner inset rect edge.  */
function borderSDF(x, y, W, H, p) {
  const inL = x < p, inR = x >= W - p, inT = y < p, inB = y >= H - p;
  const l = inL ? x - p : inR ? x - (W - p) : 0;
  const m = inT ? y - p : inB ? y - (H - p) : 0;
  return [l, m];
}

/* ── Displacement map (R = Δx, G = Δy, 128 neutral, B unused, A 255) ── */
function buildDisplacementMap(wCss, hCss, radiusCss, bezelCss, profile) {
  const W = Math.max(2, Math.round(wCss * DPR));
  const H = Math.max(2, Math.round(hCss * DPR));
  const img = new ImageData(W, H);
  new Uint32Array(img.data.buffer).fill(0xFF008080);   // 128/128/? /255
  const p = Math.min(radiusCss * DPR, Math.min(W, H) / 2 - 1);
  const bez = Math.max(0.75, bezelCss * DPR);
  const gOut = (p + 1) ** 2, gIn = p * p, gLo = (p - bez) ** 2;
  const n = profile.length;
  let maxAbs = 0;
  for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(profile[i]));
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
      if (S > gIn) fade = Math.max(0, 1 - (t - p));  // 1px AA ring
      const rD = p - t;                              // distance from border
      const c = profile[Math.min(n - 1, (rD / bez * n) | 0)] || 0;
      const v = c / maxAbs;                          // normalized [-1,1]
      const ux = -l / t, uy = -m / t;                // inward unit vector
      const i = (y * W + x) * 4;
      d8[i]     = 128 + ux * v * 127 * fade;
      d8[i + 1] = 128 + uy * v * 127 * fade;
      d8[i + 2] = 0;
      d8[i + 3] = 255;
    }
  }
  return { img, maxAbs, W, H };
}

/* ── Specular map: white rim whose alpha = cos²(normal−light) × bump ──
   Reverse-engineered from the site's specular-map PNGs:
   top/bottom  A=191 R=220 · left/right A=64 R=128 with light at −60°,
   parabolic bump peaked 1 px inside the border, zero at the border.    */
function buildSpecularMap(wCss, hCss, radiusCss, angleDeg) {
  const W = Math.max(2, Math.round(wCss * DPR));
  const H = Math.max(2, Math.round(hCss * DPR));
  const img = new ImageData(W, H);
  const p = Math.min(radiusCss * DPR, Math.min(W, H) / 2 - 1);
  const gOut = (p + 1) ** 2;
  const L = angleDeg * Math.PI / 180;
  const ring = 2 * DPR;                    // bump support: 0 … 2·DPR px
  const peak = 1 * DPR;                    // bump peak position
  const d8 = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [l, m] = borderSDF(x, y, W, H, p);
      const S = l * l + m * m;
      if (S > gOut) continue;
      const t = Math.sqrt(S);
      if (t < 1e-6) continue;
      const rD = p - t;                    // distance from border
      if (rD > ring) continue;
      const k = (rD - peak) / peak;        // parabolic window
      const bump = 1 - k * k;
      if (bump <= 0) continue;
      const theta = Math.atan2(m, l);      // outward normal angle
      const cv = Math.cos(theta - L);
      const it = cv * cv * bump;           // cos² × bump
      const A = Math.min(255, Math.round(it * 255));
      if (A <= 0) continue;
      const G = Math.min(255, Math.round(Math.sqrt(it) * 255));
      const i = (y * W + x) * 4;
      d8[i] = G; d8[i + 1] = G; d8[i + 2] = G; d8[i + 3] = A;
    }
  }
  return img;
}

/* mini profile-icon path builder — same idea as the article's icons */
function profileIconPath(fn, size = 20, pad = 3) {
  const N = 24, out = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const c = Math.max(0, Math.min(1, fn(s)));
    const x = pad + s * (size - pad * 2);
    const y = size - (pad + c * (size - pad * 2));
    out.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return out.join(' ');
}


/* ══════════ part boundary (concatenated in order; CSP: external only) ══════════ */

'use strict';
/* ══════════════════ state & UI wiring ══════════════════ */

const $ = id => document.getElementById(id);
const P = {  // parameter state — defaults = site Searchbox demo + app RGB dim
  specOpacity:0.20, saturation:4, refraction:0.70, blur:1.0,
  angle:-60, glassBg:0, rgbDim:0.38,
  surface:'convex_squircle', bezel:14, thickness:66, scale:1,
  radius:21, w:320, h:42
};

const PRESETS = {          // exact values shown in the article's demos
  searchbox:{ specOpacity:0.20, saturation:4,  refraction:0.70, blur:1.0,
              surface:'convex_squircle', bezel:14, thickness:66,
              radius:21,  w:320, h:42,  glassBg:0, rgbDim:0 },
  switch:  { specOpacity:0.50, saturation:6,  refraction:1.00, blur:0.2,
             surface:'lip',            bezel:10, thickness:60,
             radius:32,  w:140, h:64,  glassBg:0, rgbDim:0 },
  slider:  { specOpacity:0.40, saturation:7,  refraction:1.00, blur:0.0,
             surface:'convex_circle',  bezel:10, thickness:60,
             radius:20,  w:280, h:40,  glassBg:0, rgbDim:0 },
  player:  { specOpacity:0.40, saturation:6,  refraction:1.00, blur:1.0,
             surface:'convex_circle',  bezel:20, thickness:80,
             radius:24,  w:300, h:200, glassBg:0.60, rgbDim:0 },
  magnifier:{specOpacity:0.50, saturation:9,  refraction:1.00, blur:0.0,
             surface:'convex_circle',  bezel:16, thickness:80,
             radius:75,  w:210, h:150, glassBg:0, rgbDim:0 },
  /* App panels — seeds from the app's measured spec (session 2026-09-30):
     A = notification banner: R≈12px, light blur ≈3px, transparent (dim only),
     rim reflects the nearest horizontal colour hard.
     B = menu panel: R≈24px, heavier blur ≈20px, transparent, rim is the
     fixed major background colour. Both start from the site's physics
     defaults (convex squircle bezel, IOR 1.5) — tune from here. */
  panelA: { specOpacity:0.45, saturation:8, refraction:0.70, blur:3.0,
            surface:'convex_squircle', bezel:12, thickness:66,
            radius:12, w:380, h:200, glassBg:0, rgbDim:0.38 },
  panelB: { specOpacity:0.35, saturation:6, refraction:0.70, blur:20.0,
            surface:'convex_squircle', bezel:16, thickness:70,
            radius:24, w:360, h:300, glassBg:0, rgbDim:0.44 }
};

/* ── URL-hash state: the address bar IS the shareable tuning ──
   Every parameter change rewrites #p=<encoded JSON>, so copying the
   URL hands the exact tuning back (or to the agent building the app). */
function encodeState() {
  const s = btoa(unescape(encodeURIComponent(JSON.stringify(P))));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeState(s) {
  try {
    const b = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b + '='.repeat((4 - b.length % 4) % 4)))));
  } catch { return null; }
}
function persist() {
  try { history.replaceState(null, '', '#p=' + encodeState()); } catch {}
}
/* push P back into every control (used on hash restore + presets) */
function syncUI() {
  for (const [id, f] of SLIDERS) {
    const el = $(id);
    if (el) { el.value = P[id]; $('o-' + id).textContent = fmt[f](P[id]); }
  }
  $('pw').value = P.w; $('ph').value = P.h;
  $('radius').max = Math.floor(Math.min(P.w, P.h) / 2);
  renderSurfaceButtons();
}

const fmt = {
  two:  v => (+v).toFixed(2),
  one:  v => (+v).toFixed(1),
  int:  v => Math.round(+v).toString(),
  deg:  v => Math.round(+v) + '°'
};

const supported = (() => {
  try {
    return CSS.supports('backdrop-filter', 'url(#x)') ||
           CSS.supports('-webkit-backdrop-filter', 'url(#x)');
  } catch { return false; }
})();

/* ── surface buttons ── */
function renderSurfaceButtons() {
  const box = $('surfaceBtns');
  box.innerHTML = '';
  for (const s of SURFACES) {
    const b = document.createElement('button');
    b.className = 'sbtn' + (s.id === P.surface ? ' on' : '');
    b.dataset.surface = s.id;
    b.innerHTML =
      `<svg viewBox="0 0 20 20"><path d="${profileIconPath(s.fn)}" fill="none"
        stroke="${s.id === P.surface ? '#0369a1' : '#8a8a8a'}" stroke-width="1.6"
        stroke-linecap="round"/></svg>${s.label}`;
    b.addEventListener('click', () => {
      P.surface = s.id;
      renderSurfaceButtons();
      schedule({ map:true, sim:true });
      persist();
    });
    box.appendChild(b);
  }
}

/* ── slider bindings ── */
const SLIDERS = [
  ['specOpacity', 'two'], ['saturation', 'int'], ['refraction', 'two'],
  ['blur', 'one'], ['angle', 'deg'], ['glassBg', 'two'], ['rgbDim', 'two'],
  ['bezel', 'int'], ['thickness', 'int'], ['scale', 'two'], ['radius', 'int']
];
function bindSliders() {
  for (const [id, f] of SLIDERS) {
    const el = $(id), out = $('o-' + id);
    el.addEventListener('input', () => {
      P[id] = parseFloat(el.value);
      out.textContent = fmt[f](P[id]);
      if (id === 'specOpacity' || id === 'saturation' ||
          id === 'refraction'  || id === 'blur' || id === 'rgbDim' ||
          id === 'glassBg') {
        renderFilterAttrs();                       // attribute-only: instant
      } else if (id === 'angle') {
        schedule({ spec:true });                   // specular map only
      } else if (id === 'radius') {
        schedule({ spec:true, map:true, sim:true });
      } else {
        schedule({ map:true, sim:true });          // bezel/thickness/scale
      }
      persist();                                   // URL always carries the tuning
    });
  }
  for (const id of ['pw', 'ph']) {
    $(id).addEventListener('change', () => {
      P.w = Math.min(720, Math.max(60, Math.round(+$('pw').value || 320)));
      P.h = Math.min(320, Math.max(32, Math.round(+$('ph').value || 42)));
      $('pw').value = P.w; $('ph').value = P.h;
      $('radius').max = Math.floor(Math.min(P.w, P.h) / 2);
      if (P.radius > +$('radius').max) {
        P.radius = +$('radius').max;
        $('radius').value = P.radius;
        $('o-radius').textContent = P.radius;
      }
      schedule({ spec:true, map:true, sim:true });
      persist();
    });
  }
}

/* ── presets ── */
function bindPresets() {
  document.querySelectorAll('.pbtn').forEach(b => {
    b.addEventListener('click', () => {
      const pre = PRESETS[b.dataset.preset];
      if (!pre) return;
      Object.assign(P, pre);
      syncUI();
      schedule({ spec:true, map:true, sim:true });
      persist();
      toast(b.dataset.preset + ' preset');
    });
  });
}

/* ── stage backgrounds ── */
const PLATE = (pl, th) =>
  `assets/backgrounds/bg-${pl}-${th}.svg`;
let imageUrl = null;
function makeImageBackground() {          // vivid stress-test scene, no network
  const c = document.createElement('canvas');
  c.width = 1120; c.height = 720;
  const g = c.getContext('2d');
  const bands = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];
  for (let i = 0; i < 12; i++) {
    g.fillStyle = bands[i % bands.length];
    g.fillRect(i * 112 - 30, 0, 90, 720);
  }
  g.globalAlpha = 0.85;
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    g.arc(Math.random() * 1120, Math.random() * 720,
          18 + Math.random() * 60, 0, 7);
    g.fillStyle = ['#fff', '#111827', '#fde047'][i % 3];
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#111827';
  g.font = '900 190px system-ui';
  g.fillText('Aa', 60, 620);
  g.fillStyle = '#fff';
  g.font = '900 120px system-ui';
  g.fillText('Liquid', 640, 200);
  return c.toDataURL('image/png');
}
function bindStage() {
  const stage = $('stage');
  document.querySelectorAll('.chip.plate').forEach(ch => {
    ch.addEventListener('click', () => {
      document.querySelectorAll('.chip.plate').forEach(x => x.classList.remove('on'));
      ch.classList.add('on');
      $('imgBg').checked = false;
      stage.classList.remove('dark', 'light');
      stage.classList.add(ch.dataset.theme);
      stage.style.backgroundImage = `url("${PLATE(ch.dataset.plate, ch.dataset.theme)}")`;
    });
  });
  $('imgBg').addEventListener('change', e => {
    if (e.target.checked) {
      if (!imageUrl) imageUrl = makeImageBackground();
      stage.style.backgroundImage = `url("${imageUrl}")`;
    } else {
      const on = document.querySelector('.chip.plate.on') ||
                 document.querySelector('.chip.plate');
      on.click();
      return;
    }
  });
}


/* ══════════ part boundary (concatenated in order; CSP: external only) ══════════ */

'use strict';
/* ══════════════════ filter + maps + charts ══════════════════ */

let prof = null, mapInfo = null, dispURL = null, specURL = null;

/* effective physical displacement scale (CSS px) */
function effectiveScale() {
  return 2 * (mapInfo ? mapInfo.maxAbs : 1) * P.refraction * P.scale;
}

/* write only the cheap attributes — no map rebuild */
function renderFilterAttrs() {
  const blurEl = document.querySelector(`#${FID} feGaussianBlur`);
  const dispEl = document.querySelector(`#${FID} feDisplacementMap`);
  const satEl  = document.querySelector(`#${FID} feColorMatrix`);
  const slopeEl= document.querySelector(`#${FID} feFuncA`);
  const bgEl   = $('glass');
  setDimFuncs();
  if (blurEl) blurEl.setAttribute('stdDeviation', P.blur);
  if (dispEl) dispEl.setAttribute('scale', effectiveScale().toFixed(3));
  if (satEl)  satEl.setAttribute('values', P.saturation);
  if (slopeEl)slopeEl.setAttribute('slope', P.specOpacity);
  applyGlassBg();
}
/* white veil fill (the site's Glass Background Opacity — panels keep it 0) */
function applyGlassBg() {
  const bgEl = $('glass');
  if (bgEl) bgEl.style.background =
    P.glassBg > 0 ? `rgba(255,255,255,${P.glassBg})` : '';
}

/* RGB-aware dim — per-channel alpha over a mid-grey tint, ratios from the
   app measurement (alpha 0.38R / 0.40G / 0.56B).  out = (1-a)*in + a*T, so
   white washes to warm grey while dark blue keeps its blue.            */
const DIM_TINT = [103/255, 100/255, 112/255];
function dimParams() {
  const base = P.rgbDim;
  return [                              // [slope, intercept] per channel
    [1 - base,            base * DIM_TINT[0]],
    [1 - base*1.0526,     base*1.0526 * DIM_TINT[1]],   // cap below
    [1 - Math.min(1, base*1.4737), Math.min(1, base*1.4737) * DIM_TINT[2]]
  ];
}
function setDimFuncs() {
  const [r, g, b] = dimParams();
  const all = (tag, pr) => document.querySelectorAll(`#${FID} ${tag}`)
    .forEach(el => { el.setAttribute('slope', pr[0].toFixed(4));
                     el.setAttribute('intercept', pr[1].toFixed(4)); });
  all('feFuncR', r); all('feFuncG', g); all('feFuncB', b);
}

/* full filter element rebuild with fresh map data-URLs */
function renderFilter() {
  $('filterDefs').innerHTML =
    `<filter id="${FID}" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${P.blur}"
                      result="blurred_source"/>
      <feImage href="${dispURL}" x="0" y="0"
               width="${P.w}" height="${P.h}" result="displacement_map"/>
      <feDisplacementMap in="blurred_source" in2="displacement_map"
               scale="${effectiveScale().toFixed(3)}"
               xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feColorMatrix in="displaced" type="saturate"
               values="${P.saturation}" result="displaced_saturated"/>
      <feComponentTransfer in="displaced" result="rgb_dimmed">
        <feFuncR type="linear" slope="${dimParams()[0][0].toFixed(4)}" intercept="${dimParams()[0][1].toFixed(4)}"/>
        <feFuncG type="linear" slope="${dimParams()[1][0].toFixed(4)}" intercept="${dimParams()[1][1].toFixed(4)}"/>
        <feFuncB type="linear" slope="${dimParams()[2][0].toFixed(4)}" intercept="${dimParams()[2][1].toFixed(4)}"/>
      </feComponentTransfer>
      <feComponentTransfer in="displaced_saturated" result="saturated_dimmed">
        <feFuncR type="linear" slope="${dimParams()[0][0].toFixed(4)}" intercept="${dimParams()[0][1].toFixed(4)}"/>
        <feFuncG type="linear" slope="${dimParams()[1][0].toFixed(4)}" intercept="${dimParams()[1][1].toFixed(4)}"/>
        <feFuncB type="linear" slope="${dimParams()[2][0].toFixed(4)}" intercept="${dimParams()[2][1].toFixed(4)}"/>
      </feComponentTransfer>
      <feImage href="${specURL}" x="0" y="0"
               width="${P.w}" height="${P.h}" result="specular_layer"/>
      <feComposite in="saturated_dimmed" in2="specular_layer"
               operator="in" result="specular_saturated"/>
      <feComponentTransfer in="specular_layer" result="specular_faded">
        <feFuncA type="linear" slope="${P.specOpacity}"/>
      </feComponentTransfer>
      <feBlend in="specular_saturated" in2="rgb_dimmed"
               mode="normal" result="withSaturation"/>
      <feBlend in="specular_faded" in2="withSaturation" mode="normal"/>
    </filter>`;
}

/* panel geometry */
function applyPanelGeometry() {
  const g = $('glass');
  g.style.width = P.w + 'px';
  g.style.height = P.h + 'px';
  g.style.borderRadius = P.radius + 'px';
}

/* ── rebuild scheduler (coalesced per frame, dirty flags) ── */
const dirty = { map:false, spec:false, sim:false };
let raf = 0;
function schedule(flags) {
  Object.assign(dirty, flags);
  if (!raf) raf = requestAnimationFrame(runRebuild);
}
function runRebuild() {
  raf = 0;
  try {
    if (dirty.map || dirty.spec) {
      applyPanelGeometry();
      const surface = surfaceById(P.surface).fn;
      prof = computeProfile(P.bezel, P.thickness, surface);
      if (dirty.map || !mapInfo) {
        mapInfo = buildDisplacementMap(P.w, P.h, P.radius, P.bezel, prof);
        dispURL = toURL(mapInfo.img);
        drawMapPreview();
      }
      specURL = toURL(buildSpecularMap(P.w, P.h, P.radius, P.angle));
      renderFilter();
      applyGlassBg();
      drawChart();
    }
    if (dirty.sim) drawSim();
    updateStatus();
  } catch (err) {
    console.error('rebuild failed:', err);
    $('status').textContent = 'rebuild error: ' + err.message;
  }
  dirty.map = dirty.spec = dirty.sim = false;
}
function toURL(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/* ── Radius Displacements chart ── */
function drawChart() {
  const cv = $('chartCanvas'), ctx = setupCanvas(cv);
  const W = cv.clientWidth, H = cv.clientHeight;
  ctx.clearRect(0, 0, W, H);
  if (!prof) return;
  const n = prof.length;
  let mx = 1e-6;
  for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(prof[i]));
  const padL = 34, padR = 8, padT = 10, padB = 16;
  const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
  const X = i => x0 + (x1 - x0) * i / (n - 1);
  const Y = v => (y0 + y1) / 2 - v / mx * (y0 - y1) / 2 * 0.92;
  // grid
  ctx.strokeStyle = '#ececec'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, (y0 + y1) / 2); ctx.lineTo(x1, (y0 + y1) / 2); ctx.stroke();
  for (const gy of [y1, (y0 + y1) / 2, y0]) {
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke();
  }
  // curve — purple gradient by magnitude (article colour coding)
  const grad = ctx.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, '#7c3aed'); grad.addColorStop(1, '#111827');
  ctx.strokeStyle = grad; ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = X(i), py = Y(prof[i]);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  // labels
  ctx.fillStyle = '#9ca3af'; ctx.font = '9px ui-monospace,monospace';
  ctx.fillText('+', 4, y1 + 8);
  ctx.fillText('0', 4, (y0 + y1) / 2 + 3);
  ctx.fillText('−', 4, y0 - 2);
  ctx.fillText(Math.round(mx * 10) / 10 + 'px', x0 + 3, y1 + 8);
  ctx.fillText(Math.round(P.bezel) + 'px', x1 - 30, y0 + 11);
}

/* ── Radius Simulation (ray-traced half-slice at one border) ──
   Geometry is exaggerated per-axis for readability (like the article's
   normalized arrows); colours still encode true displacement magnitude. */
function drawSim() {
  const cv = $('simCanvas'), ctx = setupCanvas(cv);
  const W = cv.clientWidth, H = cv.clientHeight;
  ctx.clearRect(0, 0, W, H);
  const surface = surfaceById(P.surface).fn;
  const bez = Math.max(1, P.bezel), th = P.thickness;
  const Hmax = th + bez;
  const padL = 14, padR = 14, padT = 16, groundY = H - 30;
  const sx = (W - padL - padR) * 0.52 / bez;          // dome ≈ half width
  const sy = (groundY - padT) / Math.max(10, Hmax);
  const borderX = padL;
  const X = d => borderX + d * sx;
  const Y = h => groundY - h * sy;
  let maxD = 1e-6;
  for (let i = 0; i < prof.length; i++) maxD = Math.max(maxD, Math.abs(prof[i]));
  // glass body
  ctx.beginPath();
  ctx.moveTo(X(0), groundY);
  for (let i = 0; i <= 60; i++) {
    const d = bez * i / 60;
    ctx.lineTo(X(d), Y(surface(d / bez) * th + bez));
  }
  ctx.lineTo(X(bez), groundY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(125,180,255,.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,130,246,.6)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // background line
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL - 6, groundY); ctx.lineTo(W - padR + 6, groundY); ctx.stroke();
  // rays
  const K = 9, armMax = (W - padL - padR) * 0.42;
  for (let k = 0; k < K; k++) {
    const d = bez * (k + 0.5) / K;
    const hSurf = surface(d / bez) * th + bez;
    const idx = Math.min(prof.length - 1, (d / bez * prof.length) | 0);
    const disp = prof[idx] || 0;
    const mag = Math.min(1, Math.abs(disp) / maxD);
    const col = `hsl(${262 - mag * 10} ${30 + mag * 55}% ${30 + (1 - mag) * 32}%)`;
    // no-glass ghost tick where the ray would have landed
    ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(d), groundY - 4); ctx.lineTo(X(d), groundY + 4); ctx.stroke();
    // incident (vertical, faint) + refracted segment
    ctx.strokeStyle = col; ctx.lineWidth = 1.15;
    ctx.globalAlpha = 0.38;
    ctx.beginPath(); ctx.moveTo(X(d), padT); ctx.lineTo(X(d), Y(hSurf)); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(X(d), Y(hSurf));
    ctx.lineTo(X(d), groundY);
    ctx.stroke();
    // displacement arrow: origin tick → landing, colour = magnitude
    const arm = 5 + mag * armMax;
    const ay = groundY + 11;
    ctx.strokeStyle = `hsl(262 ${38 + mag * 48}% ${52 - mag * 24}%)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(X(d), ay); ctx.lineTo(X(d) + arm, ay);
    ctx.stroke();
    const ax = X(d) + arm;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(ax - 4.5, ay - 3);
    ctx.moveTo(ax, ay); ctx.lineTo(ax - 4.5, ay + 3);
    ctx.stroke();
  }
  // labels
  ctx.fillStyle = '#9ca3af'; ctx.font = '9.5px ui-monospace,monospace';
  ctx.fillText('border', borderX - 10, H - 4);
  ctx.fillText('glass', X(bez) + 6, groundY - 6);
  ctx.fillText('background', W - padR - 58, groundY - 6);
  if (maxD < 0.5) {
    ctx.fillStyle = '#b91c1c';
    ctx.fillText('≈ no refraction at current settings', padL + 40, padT + 2);
  }
}

/* ── Displacement Map preview ── */
function drawMapPreview() {
  const cv = $('mapCanvas'), ctx = setupCanvas(cv);
  const W = cv.clientWidth, H = cv.clientHeight;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  if (!mapInfo) return;
  const off = document.createElement('canvas');
  off.width = mapInfo.W; off.height = mapInfo.H;
  off.getContext('2d').putImageData(mapInfo.img, 0, 0);
  const sc = Math.min(W / mapInfo.W, H / mapInfo.H);
  const dw = mapInfo.W * sc, dh = mapInfo.H * sc;
  ctx.drawImage(off, (W - dw) / 2, (H - dh) / 2, dw, dh);
  $('mapMeta').textContent = `${mapInfo.W}×${mapInfo.H} · max Δ ${mapInfo.maxAbs.toFixed(1)}px`;
}

function setupCanvas(cv) {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 300, h = cv.clientHeight || 150;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) {
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return ctx;
}

function updateStatus() {
  const st = supported
    ? `filter live · max displacement ${mapInfo ? mapInfo.maxAbs.toFixed(1) : '—'}px · ` +
      `scale ${(mapInfo ? mapInfo.maxAbs : 0) * P.refraction * P.scale * 2 | 0}px · ` +
      `dpr ${DPR} · bezel ${P.bezel}px · ${surfaceById(P.surface).label}`
    : 'fallback mode — no backdrop refraction outside Chromium';
  $('status').textContent = st;
}

/* ── export ── */
function tokensCSS() {
  return `/* Liquid Glass — kube.io replica values */
--lg-surface: ${P.surface};
--lg-bezel: ${P.bezel}px;
--lg-thickness: ${P.thickness}px;
--lg-corner-radius: ${P.radius}px;
--lg-refraction-level: ${P.refraction.toFixed(2)};
--lg-scale-ratio: ${P.scale.toFixed(2)};
--lg-blur-level: ${P.blur.toFixed(1)}px;
--lg-specular-opacity: ${P.specOpacity.toFixed(2)};
--lg-specular-saturation: ${P.saturation};
--lg-specular-angle: ${P.angle}deg;
--lg-glass-bg-opacity: ${P.glassBg.toFixed(2)};
--lg-rgb-dim: ${P.rgbDim.toFixed(2)};
/* backdrop-filter: url(#liquid-glass-filter);  — Chromium only */`;
}
function tokensJSON() {
  return JSON.stringify({ ...P, maxDisplacementPx: mapInfo ? +mapInfo.maxAbs.toFixed(2) : null }, null, 2);
}
function tokensAppCSS() {
  return `/* ── 1:1 onto existing app tokens (src/index.css) ── */
--panel-a-blur: ${P.blur.toFixed(1)}px;              /* Blur Level */
--panel-a-dim-a: ${P.rgbDim.toFixed(2)};              /* RGB Dim — per-channel wash (white→grey, blue survives) */
--glass-edge-base: ${P.specOpacity.toFixed(2)};       /* Specular Opacity (rim weight) */
--glass-edge-hot: ${P.specOpacity.toFixed(2)};        /* keep = base on panels */

/* ── new physics params for the panel lens filter (kube.io chain) ── */
--panel-lens-surface: ${P.surface};
--panel-lens-bezel: ${P.bezel}px;
--panel-lens-thickness: ${P.thickness}px;
--panel-lens-refraction-level: ${P.refraction.toFixed(2)};
--panel-lens-scale-ratio: ${P.scale.toFixed(2)};
--panel-lens-spec-opacity: ${P.specOpacity.toFixed(2)};
--panel-lens-spec-saturation: ${P.saturation};
--panel-lens-spec-angle: ${P.angle}deg;
--panel-lens-radius: ${P.radius}px;
--panel-lens-size: ${P.w}px ${P.h}px;
/* max displacement: ${(mapInfo ? mapInfo.maxAbs.toFixed(1) : '—')}px
   backdrop-filter: blur(${P.blur.toFixed(1)}px) saturate(...) url(#panel-lens) — Chromium only */`;
}
function bindExport() {
  $('copyBtn').addEventListener('click', () => copy(tokensCSS(), 'CSS tokens copied'));
  $('copyJsonBtn').addEventListener('click', () => copy(tokensJSON(), 'JSON copied'));
  $('copyAppBtn').addEventListener('click', () => copy(tokensAppCSS(), 'App tokens copied'));
}
function copy(text, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta);
  ta.select(); try { document.execCommand('copy'); } catch {}
  ta.remove(); done();
}
let toastT = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1600);
}


/* ══════════ part boundary (concatenated in order; CSP: external only) ══════════ */

'use strict';
/* ══════════════════ boot ══════════════════ */
(function boot() {
  const stage = $('stage');
  stage.style.backgroundImage = `url("${PLATE('e', 'light')}")`;

  renderSurfaceButtons();
  bindSliders();
  bindPresets();
  bindStage();
  bindExport();

  if (!supported) {
    $('banner').classList.add('show');
    $('browserBadge').textContent = 'Non-Chromium: fallback mode';
    $('browserBadge').classList.add('bad');
    $('glass').classList.add('fallback');
  } else {
    $('browserBadge').textContent = 'Chromium-only demo';
  }

  // restore a shared tuning from the URL hash (#p=...) before first build
  if (location.hash.startsWith('#p=')) {
    const st = decodeState(location.hash.slice(3));
    if (st) { Object.assign(P, st); syncUI(); }
  }

  window.addEventListener('resize', () => {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    if (d !== DPR) {           // browser zoom changed — maps must be rebuilt
      DPR = d;
      schedule({ map:true, spec:true, sim:true });
      return;
    }
    schedule({ sim:true });
    drawMapPreview(); drawChart();
  });

  // first build
  schedule({ map:true, spec:true, sim:true });
  persist();
})();
