/**
 * Glass lab — dev-only A/B for the liquid-glass lens.
 *
 * Same page, same panels, same backdrop artwork, two renderers:
 *   css    — the app's shipping path: blur() saturate() url(#id), the filter
 *            graph built by css-engine.js from the app's own maps.
 *   webgl  — glass-shader.js: the same maps uploaded as textures, the same
 *            chain evaluated in one fragment shader per panel.
 *   split  — BOTH at once: identical panels side by side in the "مقایسه"
 *            section, one column CSS, one column WebGL. For the eye. (fps is
 *            only meaningful in css/webgl modes; in split both pipelines run,
 *            so the meter reads the sum.)
 *
 * Dev-only by intent: nothing in src/ imports this, no gate scans public/, and
 * deleting public/lab/ removes it completely.
 */

import { CssEngine } from './css-engine.js';
import { GlassRenderer } from './glass-shader.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

/* ── the pinned recipe, read off the lab's own tokens ──────────────────── */
function readParams() {
  const cs = getComputedStyle(document.documentElement);
  const num = (name, fallback) => {
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    bezel: num('--lens-bezel', 14),
    thickness: num('--lens-thickness', 66),
    refraction: num('--lens-refraction-level', 0.7),
    scaleRatio: num('--lens-scale-ratio', 1),
    specOpacity: num('--lens-spec-opacity', 0.2),
    specSaturation: num('--lens-spec-saturation', 4),
    specAngle: num('--lens-spec-angle', -60),
    specPeak: num('--lens-spec-peak', 1),
    cornerExp: num('--corner-exp', 2),
    dim: num('--lens-dim', 0.1),
    dimTint: [31, 29, 41],
    /* These four were MISSING, and both absences were silently corrupting the
       A/B:
         · radius — css-engine.js:77 reads params.radius to size the maps. No
           value meant buildDisplacementMap(w, h, NaN, …): a degenerate map, so
           css mode was not running the app's real chain.
         · fillA1/fillA2/fillAngle — glass-shader.js:439-441 uploads them with
           gl.uniform1f(loc, undefined), which WebGL stores as NaN. The shader
           then computes col * NaN and every panel quad came out opaque BLACK.
       .lens/.pane/.drop carry --glass-fill: 0 (no gradient fill at all — their
       whole look is the backdrop filter), so the derived fill is 0. */
    fillA1: num('--glass-fill', 0),
    fillA2: num('--glass-fill', 0),
    fillAngle: num('--glass-p-angle', 180),
    radius: num('--lens-radius', 21),
    dpr: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    cornerShapeSupported: CSS.supports?.('corner-shape', 'superellipse(2)') === true,
    blur: 1,
    sat: 1.15,
  };
}

/* ── the scrolling artwork: one canvas, shared by both renderers ───────── */
const STRIP_W = 1400;
const STRIP_H = 2400;

/** Device pixels for a CSS size. The strip is uploaded as a texture and sampled
 *  1:1 against device pixels, so an unscaled canvas is magnified by `dpr` and
 *  loses high-frequency detail exactly like the plate raster did — the bend is
 *  only visible over detail, so this is the metric that would hide the fix. */
const stripScale = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));

function makeStrip() {
  const k = stripScale();
  const c = document.createElement('canvas');
  c.width = Math.round(STRIP_W * k);
  c.height = Math.round(STRIP_H * k);
  const x = c.getContext('2d');
  // draw in CSS units; the scale maps them onto the DPR-sized buffer
  x.scale(k, k);
  const g = x.createLinearGradient(0, 0, 0, STRIP_H);
  g.addColorStop(0, '#f7f4ec');
  g.addColorStop(0.5, '#efe9dc');
  g.addColorStop(1, '#f7f4ec');
  x.fillStyle = g;
  x.fillRect(0, 0, STRIP_W, STRIP_H);

  // Dense, high-contrast content: the bend is only VISIBLE over detail. A
  // uniform field refracted is the identical image — that mistake produced a
  // 0.00 pixel delta on the scratch fixture.
  const rows = 46;
  const rowH = STRIP_H / rows;
  const pal = ['#1a1a2e', '#f5b301', '#2563eb', '#059669', '#e11d48', '#7c3aed'];
  for (let i = 0; i < rows; i++) {
    const y = i * rowH + 6;
    const h = rowH - 12;
    x.fillStyle = pal[i % pal.length];
    x.beginPath();
    x.roundRect(14, y, STRIP_W - 28, h, 14);
    x.fill();
    if (i % 3 === 0) {
      x.save();
      x.beginPath();
      x.roundRect(14, y, STRIP_W - 28, h, 14);
      x.clip();
      x.fillStyle = 'rgba(0,0,0,0.85)';
      for (let sx = 14; sx < STRIP_W - 28; sx += 14) x.fillRect(sx, y, 7, h);
      x.restore();
    }
    x.fillStyle = i % 3 === 0 ? '#ffffff' : 'rgba(255,255,255,0.92)';
    x.font = '700 28px system-ui, sans-serif';
    x.direction = 'rtl';
    x.fillText('سطر ' + (i + 1) + ' — آزمون شیشه مایع روی محتوای متحرک', STRIP_W - 40, y + h / 2 + 10);
  }
  return c;
}

const stripCanvas = makeStrip();

/** The strip is used as `background-image`, which img-src also governs, so a
 *  data: URL is refused under production CSP exactly like the feImage maps.
 *  Encode to a blob: URL in init() instead. */
async function stripBlobURL() {
  const blob = await new Promise((res) => stripCanvas.toBlob(res, 'image/png'));
  return blob ? URL.createObjectURL(blob) : '';
}

/* ── panel construction ─────────────────────────────────────────────────── */
const FEED_KINDS = ['lens', 'lens', 'pane', 'lens', 'glx', 'lens', 'pane'];

function classFor(kind) {
  if (kind === 'glx') return 'glx';
  if (kind === 'pane') return 'pane panel-pane';
  if (kind === 'frost') return 'frost panel-frost';
  if (kind === 'drop') return 'drop';
  return 'lens';
}

function panelMarkup(kind, label, cls) {
  return (
    `<div class="panel ${cls}" data-kind="${kind}">` +
    `<strong>${label}</strong> <span class="tag">${kind}</span>` +
    `<p class="muted">متن نمونه روی شیشه — برای سنجش خوانایی لبه‌ها.</p>` +
    '</div>'
  );
}

function buildFeed(n) {
  const feed = $('feed');
  feed.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const kind = FEED_KINDS[i % FEED_KINDS.length];
    feed.insertAdjacentHTML('beforeend', panelMarkup(kind, 'پنل ' + (i + 1), classFor(kind)));
  }
}

/** The same panels, identically built, for the split comparison view. */
function buildComparePair() {
  const grid = $('abgrid');
  grid.innerHTML = '<div data-ab="css"></div><div data-ab="webgl"></div>';
  const [cssHalf, glHalf] = grid.children;
  const pairs = [
    [cssHalf, 'CSS + SVG'],
    [glHalf, 'WebGL2'],
  ];
  for (const [host, tag] of pairs) {
    host.innerHTML =
      `<p class="muted" style="margin:0 0 8px">${tag}</p>` +
      ['lens', 'pane', 'lens'].map((k) => panelMarkup(k, tag, classFor(k))).join('');
  }
}

/* ── which panels each engine paints ───────────────────────────────────── */
const GLASS_SELECTOR = '.lens, .pane, .drop';

/** Which side an element belongs to in split mode; null when outside #abgrid. */
function abSide(el) {
  const host = el.closest('[data-ab]');
  return host ? host.dataset.ab : null;
}

/** Non-split: every glass panel belongs to both engines (CSS dresses them, the
 *  shader paints them) — the counts must match or the A/B is not like-for-like.
 *  Split: panels outside #abgrid default to the CSS side; each half of #abgrid
 *  goes to its own renderer. */
function targetsFor(engine) {
  const all = Array.from(document.querySelectorAll(GLASS_SELECTOR));
  if (root.dataset.render !== 'split') return all;
  return all.filter((el) => (abSide(el) ?? 'css') === engine);
}

/* ── engines ────────────────────────────────────────────────────────────── */
const cssEngine = new CssEngine();
let renderer = null;
let rafId = 0;

function kindOf(el) {
  if (el.classList.contains('drop')) return 'drop';
  if (el.classList.contains('pane')) return 'pane';
  return 'lens';
}

/** The base blur/saturate chain each family carries in the app. */
function chainBase(el) {
  const cs = getComputedStyle(el);
  const num = (n, f) => {
    const v = parseFloat(cs.getPropertyValue(n));
    return Number.isFinite(v) ? v : f;
  };
  if (el.classList.contains('lens--menu')) return `blur(${num('--lens-menu-blur', 6).toFixed(2)}px)`;
  if (el.classList.contains('pane')) return `blur(${(num('--lens-blur', 1) * 2).toFixed(2)}px)`;
  if (el.classList.contains('drop')) return `blur(${num('--drop-blur', 0.5).toFixed(2)}px)`;
  return `blur(${num('--lens-blur', 1).toFixed(2)}px)`;
}

/** Numeric form of the same chain, for the shader uniforms. */
function paramsFor(el, base) {
  const p = readParams();
  const m = /blur\(([\d.]+)px\)/.exec(base);
  p.blur = m ? parseFloat(m[1]) : 1;
  const s = /saturate\(([\d.]+)\)/.exec(base);
  p.sat = s ? parseFloat(s[1]) : 1.15;
  const cs = getComputedStyle(el);
  if (el.classList.contains('lens--menu')) {
    p.dim *= 1.4;
    /* #menu is .lens.lens--menu.glx-dark — a lens by selector, but its filled
       look comes from .glx-dark: linear-gradient(a1+boost1, a2+boost2) plus a
       plain blur(10px) saturate(1.4). The shader paints it, so it must receive
       those strengths; without this it renders as a bare lens and looks nothing
       like the CSS side in split/AB. */
    const num = (n, f) => {
      const v = parseFloat(cs.getPropertyValue(n));
      return Number.isFinite(v) ? v : f;
    };
    p.fillA1 = num('--glass-p-a1', 0) + num('--glass-p-boost1', 0);
    p.fillA2 = num('--glass-p-a2', 0) + num('--glass-p-boost2', 0);
    p.blur = 10;
    p.sat = 1.4;
  }
  return p;
}

async function dressCss() {
  for (const el of targetsFor('css')) {
    const base = chainBase(el);
    try {
      await cssEngine.dress(el, kindOf(el), paramsFor(el, base), base);
    } catch {
      /* keep the CSS base */
    }
  }
}

function scrollState() {
  const box = $('scrollbox');
  const r = box.getBoundingClientRect();
  return { rect: [r.left, r.top, r.width, r.height], top: box.scrollTop };
}

function drawWebgl() {
  if (!renderer) return;
  const scroll = scrollState();
  renderer.drawBackdrop(scroll);
  for (const el of targetsFor('webgl')) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -80 || r.top > window.innerHeight + 80) continue;
    if (r.width < 2 || r.height < 2) continue;
    const radius = parseFloat(getComputedStyle(el).borderRadius) || 21;
    try {
      renderer.drawPanel(kindOf(el), r, radius, paramsFor(el, chainBase(el)), scroll);
    } catch (e) {
      console.error('drawPanel failed', e);
    }
  }
}

/* ── fps meter ──────────────────────────────────────────────────────────── */
let frames = [];
let last = performance.now();
let benchRunning = false;
let frameNo = 0;

function meterText() {
  const s = frames.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1) || 16.7;
  const fps = 1000 / mean;
  const p95 = s.length > 20 ? s[Math.floor(s.length * 0.95)] : 0;
  const worst = s[s.length - 1] || 0;
  window.__lab = { fps: +fps.toFixed(1), p95: +p95.toFixed(1), worst: +worst.toFixed(1) };
  return (
    `روش ${root.dataset.render}   تم ${root.dataset.theme}\n` +
    `پنل ${targetsFor('css').length}   ${window.innerWidth}x${window.innerHeight} @${(window.devicePixelRatio || 1).toFixed(1)}x\n` +
    `fps ${fps.toFixed(1)}   p95 ${p95.toFixed(1)}ms   worst ${worst.toFixed(1)}ms`
  );
}

function tickMeter() {
  const now = performance.now();
  frames.push(now - last);
  last = now;
  if (frames.length > 240) frames.shift();
  if (!benchRunning) $('hud').textContent = meterText();
}

function loop() {
  rafId = requestAnimationFrame(loop);
  if (root.dataset.render !== 'css') drawWebgl();
  frameNo++;
  tickMeter();
}

/** Scroll drive: fixed distance per frame, so fps is the only variable.
 *  Waits for the rAF loop to actually be producing frames first — a bench that
 *  starts inside setMode()'s async gap would otherwise sample an empty array and
 *  report the 16.7ms fallback as a real number. */
async function waitForLoop(minFrames = 12, timeoutMs = 5000) {
  const t0 = performance.now();
  while (frameNo < minFrames) {
    if (performance.now() - t0 > timeoutMs) break;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return frameNo >= minFrames;
}

async function driveScroll(ms, axis) {
  const live = await waitForLoop();
  return new Promise((resolve) => {
    const box = axis === 'box' ? $('scrollbox') : null;
    let y = 0;
    const t0 = performance.now();
    frames = [];
    const step = () => {
      y += 24;
      if (box) {
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) box.scrollTop = 0;
        else box.scrollTop = y;
      } else if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 4) {
        window.scrollTo(0, 0);
      } else {
        window.scrollTo(0, y);
      }
      if (performance.now() - t0 < ms) {
        requestAnimationFrame(step);
        return;
      }
      const s = frames.slice(8).sort((a, b) => a - b);
      if (s.length < 10) {
        resolve({ fps: null, p95: null, worst: null, live: false, n: s.length });
        return;
      }
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      resolve({
        fps: +(1000 / mean).toFixed(1),
        p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1),
        worst: +(s[s.length - 1] || 0).toFixed(1),
        live,
        n: s.length,
      });
    };
    requestAnimationFrame(step);
  });
}

/* ── switching ──────────────────────────────────────────────────────────── */
const plateURL = () =>
  root.dataset.theme === 'dark' ? '/backgrounds/bg-d-dark.svg' : '/backgrounds/bg-d-light.svg';

async function ensureRenderer() {
  if (renderer) return renderer;
  renderer = new GlassRenderer($('gl'));
  await renderer.setPlate(plateURL());
  renderer.setStrip(stripCanvas, STRIP_W, STRIP_H);
  return renderer;
}

/* Serialises dress/undress work. Making dress() async for blob-URL encoding
   introduced a real race: the count and mode selects can fire two overlapping
   passes, which interleave at each await and append duplicate <filter> nodes
   (measured: 40 filters for 21 panels instead of 20). Every mutation now runs
   through one chain, so a new pass always starts after the previous finished. */
let modeChain = Promise.resolve();
function enqueue(fn) {
  modeChain = modeChain.then(fn, fn);
  return modeChain;
}

function setMode(mode) {
  return enqueue(() => setModeNow(mode));
}

async function setModeNow(mode) {
  cancelAnimationFrame(rafId);
  cssEngine.undressAll();
  frames = [];
  last = performance.now();
  root.dataset.render = mode;

  if (mode === 'css') {
    // Do NOT dispose the renderer here. dispose() calls WEBGL_lose_context, and a
    // <canvas> can never hand out a second context after that — so every later
    // switch back to webgl would silently get a lost context (getShaderInfoLog
    // returns null, nothing draws, benches read n/a). Keep one context for the
    // life of the page; css mode just clears it and stops drawing.
    if (renderer) renderer.clear();
    await dressCss();
  } else {
    await ensureRenderer();
    if (mode === 'split') await dressCss(); // the CSS half keeps its real chain
  }
  rafId = requestAnimationFrame(loop);
  return { mode, ok: true };
}

async function redress() {
  await enqueue(async () => {
    cssEngine.undressAll();
    if (root.dataset.render === 'css' || root.dataset.render === 'split') await dressCss();
  });
}

async function applyTheme(theme) {
  root.dataset.theme = theme;
  if (renderer) renderer.setPlate(plateURL()).catch(() => {});
  await redress();
}

/* ── wiring ─────────────────────────────────────────────────────────────── */
async function runBench(axis) {
  benchRunning = true;
  $('hud').textContent = 'در حال سنجش…';
  const r = await driveScroll(3000, axis);
  benchRunning = false;
  const label = axis === 'box' ? 'اسکرول نوار محتوا' : 'اسکرول کل صفحه';
  if (r.fps === null) {
    $('hud').textContent = `${label} — روش ${root.dataset.render}\nسنجش نامعتبر: فقط ${r.n} فریم ثبت شد`;
    return r;
  }
  const verdict = r.fps >= 55 ? 'روان' : r.fps >= 40 ? 'قابل قبول' : 'کند';
  $('hud').textContent =
    `${label} — روش ${root.dataset.render}\n` +
    `fps ${r.fps}   p95 ${r.p95}ms   worst ${r.worst}ms   ← ${verdict}\n` +
    `(${r.n} فریم نمونه · ۵۵ به بالا روان، ۴۰ تا ۵۵ قابل قبول، زیر ۴۰ کند)`;
  return r;
}

async function init() {
  buildFeed(12);
  buildComparePair();

  const plate = $('plate');
  plate.style.backgroundImage = `url('${plateURL()}')`;
  plate.style.backgroundSize = 'cover';
  plate.style.backgroundPosition = 'center';

  const strip = $('scrollstrip');
  const stripURL = await stripBlobURL();
  strip.style.backgroundImage = stripURL ? `url('${stripURL}')` : '';
  strip.style.backgroundSize = `${STRIP_W}px ${STRIP_H}px`;
  strip.style.height = STRIP_H + 'px';

  rafId = requestAnimationFrame(loop);
  await setMode('css');

  $('mode').addEventListener('change', (e) => {
    setMode(e.target.value).catch((err) => {
      benchRunning = true;
      $('hud').textContent = 'webgl failed: ' + err.message;
    });
  });
  $('theme').addEventListener('change', (e) => applyTheme(e.target.value));
  $('count').addEventListener('change', async (e) => {
    buildFeed(parseInt(e.target.value, 10));
    buildComparePair();
    await setMode(root.dataset.render);
  });

  $('bench').addEventListener('click', () => runBench('page'));
  $('scrolltest').addEventListener('click', () => runBench('box'));

  $('menubtn').addEventListener('click', () => {
    const m = $('menu');
    const open = m.dataset.open === '1';
    m.dataset.open = open ? '0' : '1';
    $('menubtn').setAttribute('aria-expanded', String(!open));
  });
  const closePopup = () => {
    $('popup').dataset.open = '0';
    $('popup-scrim').dataset.open = '0';
  };
  $('popupbtn').addEventListener('click', () => {
    $('popup').dataset.open = '1';
    $('popup-scrim').dataset.open = '1';
  });
  $('popupclose').addEventListener('click', closePopup);
  $('popup-scrim').addEventListener('click', closePopup);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopup();
  });

  window.__labBench = runBench;
  window.__labSetMode = setMode;
  window.__labPlate = () =>
    renderer && renderer.plateSize ? { w: renderer.plateSize[0], h: renderer.plateSize[1] } : null;
  /** Deterministic corner verification: with the probe on, each panel paints its
   *  inside-mask into R with no discard, so gl.readPixels reads the exact painted
   *  shape regardless of backdrop content. */
  window.__labMaskProbe = (on) => {
    if (renderer) renderer.maskProbe = !!on;
  };
  window.__labDump = () => ({
    mode: root.dataset.render,
    theme: root.dataset.theme,
    cssPanels: targetsFor('css').length,
    webglPanels: targetsFor('webgl').length,
    gl: !!renderer,
    filters: document.querySelectorAll('#lab-defs filter').length,
  });
  window.__labReady = true;
}

init().catch((e) => {
  $('hud').textContent = 'init failed: ' + e.message;
  window.__labReady = 'error';
});
