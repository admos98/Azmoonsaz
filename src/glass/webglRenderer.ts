/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WebGL2 glass renderer — the PRIMARY render path for the lens material.
 *
 * WHY THIS EXISTS: url(#…) inside backdrop-filter has no GPU-compositor path
 * in Chromium. Chrome snapshots the backdrop and runs the SVG graph through
 * Skia on the RASTER path, per surface, per frame. This renderer evaluates the
 * identical chain — the same maps, the same order as
 * lensEngine.buildFilterMarkup() — in one fragment shader per panel, and its
 * cost is FLAT across panel counts (lab-measured: 60fps at 45 panels, where
 * the CSS raster path collapsed to 15.5fps at 30).
 *
 * DRAW MODEL — one canvas for the whole page (Chrome caps live WebGL contexts
 * ~16, evicting oldest; a shared pass is cheaper anyway), two programs:
 *   1. bgProgram    — one quad over the viewport: the page plate.
 *   2. glassProgram — one quad PER PANEL, so each fragment shades only its own
 *                     panel's pixels (40 draw calls is nothing; a per-pixel
 *                     loop over panels would not be).
 * The canvas sits BETWEEN the page plate (z-0) and the content layer (z-10):
 * the DOM panels it serves drop their own backdrop-filter and stay transparent
 * frames, their text/controls remain DOM above the glass.
 *
 * Ported from the validated lab renderer (public/lab/glass-shader.js) with
 * the three defects found and fixed there carried over:
 *   1. borderDist sign convention (the corner mask);
 *   2. the canvas needs an explicit CSS size (replaced element);
 *   3. every texture is rasterized DPR-aware.
 * The lab's scrolling strip is deliberately absent: panels that float over
 * LIVE DOM (fixed/sticky/absolute — menus, modals, sticky bars) keep the CSS
 * path because the shader cannot sample live DOM above the canvas; everything
 * drawn here sits in-flow over the fixed page plate, which is the whole
 * backdrop. The controller keeps non-shell pages, nested panels and the glx*
 * families on the CSS path as well — the CSS engine keeps serving their
 * url() bend and bloom lines exactly as today.
 */

import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  dimParams,
  isCircleRadius,
  mapCornerExp,
  mapScaleFor,
  type LensParams,
} from './mapMath';

export type GlassKind = 'lens' | 'pane' | 'drop';

/** Everything one panel needs, in the lab's proven shape. `radius`, `dpr`
 *  and `cornerShapeSupported` feed the map build; the rest are shader
 *  uniforms. Built by the controller from the panel's computed style. */
export interface GlassPaintParams extends LensParams {
  blur: number;
  sat: number;
  fillA1: number;
  fillA2: number;
  fillAngle: number;
  radius: number;
  dpr: number;
  cornerShapeSupported: boolean;
}

/** Viewport-relative CSS px box (a DOMRect subset). */
export interface GlassRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const BG_VS = `#version 300 es
in vec2 a_corner;
void main() { gl_Position = vec4(a_corner * 2.0 - 1.0, 0.0, 1.0); }`;

const BG_FS = `#version 300 es
precision highp float;
uniform vec2  u_res;
uniform float u_dpr;
uniform sampler2D u_plate;
uniform vec2  u_plateSize;
out vec4 outColor;

vec2 plateUV(vec2 viewCss) {
  float ps = max(u_res.x / u_dpr / u_plateSize.x, u_res.y / u_dpr / u_plateSize.y);
  return (viewCss - (u_res / u_dpr) * 0.5) / (u_plateSize * ps) + 0.5;
}

void main() {
  vec2 viewCss = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;
  outColor = vec4(texture(u_plate, clamp(plateUV(viewCss), 0.0, 1.0)).rgb, 1.0);
}`;

const GLASS_VS = `#version 300 es
uniform vec2 u_res;
uniform vec2 u_rect;
uniform vec2 u_size;
in vec2 a_corner;
out vec2 v_local;
out vec2 v_view;
void main() {
  vec2 px = u_rect + a_corner * u_size;
  v_local = a_corner * u_size;
  v_view = px;
  vec2 ndc = vec2(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const GLASS_FS = `#version 300 es
precision highp float;
uniform vec2  u_res;
uniform vec2  u_size;
uniform float u_dpr;

uniform sampler2D u_plate;
uniform vec2  u_plateSize;

uniform float u_radius;
uniform float u_cornerExp;
uniform float u_circle;
uniform float u_maskProbe;   // dev probe: paint the inside mask instead of the glass

uniform sampler2D u_disp;
uniform sampler2D u_spec;
uniform float u_hasDisp;
uniform float u_dispScale;
uniform float u_blur;
uniform float u_sat;

uniform float u_fillA1;
uniform float u_fillA2;
uniform float u_fillAngle;
uniform float u_dim;
uniform float u_dimR;
uniform float u_dimG;
uniform float u_dimB;
uniform float u_specOpacity;
uniform float u_alpha;       // the panel's own inline opacity (motion fades)

in vec2 v_local;
in vec2 v_view;
out vec4 outColor;

float seMetric(float u, float v, float n) { return pow(pow(u, n) + pow(v, n), 1.0 / n); }

/* Signed distance to the border, device px, positive inside. Approximate at the
   corners (the app's borderSDF is the exact reference); used here only for the
   interior mask and the AA fringe.

   SIGN CONVENTION — get this wrong and the panel is painted SQUARE with the
   corners eaten out instead of rounded:
     flat branches return max(q.x, q.y) - r, which is ANTI-symmetric about the
     boundary: negative inside, positive outside. Match that in the corner case.
   The superellipse measure seMetric(t) is < 1 INSIDE the corner curve and > 1
   outside, so the distance must be (seMetric - 1) * r. Writing (1 - seMetric)
   inverts the corner against the edges: the bbox corner (which must be OUTSIDE
   the shape) reads as inside and gets painted, while the real arc interior reads
   as outside and is discarded — four square patches, visible on every lens panel.
   (The app's mapMath.borderSDF returns p - s / p - t, i.e. positive-inside, and
   the map path converts with a negate — the two conventions are not the same,
   which is what made this easy to transpose.) */
float borderDist(vec2 p, vec2 half_, float r, float n, float circle) {
  vec2 q = abs(p) - (half_ - vec2(r));
  if (q.x <= 0.0 || q.y <= 0.0) return max(q.x, q.y) - r;
  if (circle > 0.5) return length(q) - r;
  vec2 t = abs(q) / r;
  return (seMetric(t.x, t.y, n) - 1.0) * r;
}

vec2 plateUV(vec2 viewCss) {
  float ps = max(u_res.x / u_dpr / u_plateSize.x, u_res.y / u_dpr / u_plateSize.y);
  return (viewCss - (u_res / u_dpr) * 0.5) / (u_plateSize * ps) + 0.5;
}

vec3 backdropAt(vec2 viewCss) {
  return texture(u_plate, clamp(plateUV(viewCss), 0.0, 1.0)).rgb;
}

/* 25-tap blur, CSS px radius. Chromium's backdrop blur is a true gaussian; this
   is a cheap approximation — adequate for parity (lab: mean|d| 1.55, 0% of
   pixels changed) and its cost is FLAT across panel counts. */
vec3 blurred(vec2 viewCss, float radius) {
  if (radius < 0.35) return backdropAt(viewCss);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      vec2 off = vec2(float(i), float(j)) * radius * 0.55;
      float w = exp(-float(i * i + j * j) / 4.0);
      acc += backdropAt(viewCss + off) * w;
      wsum += w;
    }
  }
  return acc / wsum;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  float n = pow(2.0, u_cornerExp);
  float d = borderDist(v_local - u_size * 0.5, u_size * 0.5, u_radius, n, u_circle);
  float aa = max(0.75, fwidth(d));
  float inside = 1.0 - smoothstep(-aa, aa, d);
  /* Dev probe: when enabled this pass paints the raw inside mask (R = inside,
     opaque) over the whole quad, with no discard, so a machine can read the
     exact painted shape with gl.readPixels. Screenshot-based edge detection is
     backdrop-dependent and flipped between runs; this cannot. */
  if (u_maskProbe > 0.5) { outColor = vec4(vec3(inside), 1.0); return; }
  if (inside <= 0.0) discard;

  vec2 viewCss = v_view / u_dpr;
  vec3 back = blurred(viewCss, u_blur);

  /* feDisplacementMap semantics: read the map at THIS pixel, offset the source
     sample by (R-0.5)*scale, (G-0.5)*scale. Same numbers feDisplacementMap
     receives from the same map bytes. */
  if (u_hasDisp > 0.5) {
    vec2 dm = texture(u_disp, v_local / u_size).rg;
    vec2 disp = (dm - 0.5) * u_dispScale;
    back = blurred(viewCss + disp, u_blur);
  }

  /* saturate inside the specular mask, blended over the raw displaced backdrop */
  float spec = texture(u_spec, v_local / u_size).a;
  vec3 saturated = mix(vec3(luma(back)), back, u_sat);
  vec3 col = mix(back, saturated, spec);

  /* linear-gradient(angle, tint/a1, tint/a2) */
  float ang = radians(u_fillAngle);
  vec2 dir = vec2(cos(ang), sin(ang));
  float t = clamp(dot(v_local / u_size - 0.5, dir) + 0.5, 0.0, 1.0);
  col = mix(col, vec3(1.0), mix(u_fillA1, u_fillA2, t));

  /* dim wash — dimParams() is a pure per-channel SCALE (slope, intercept 0):
     col *= slope. Lockstep with the CSS filter chain (buildFilterMarkup
     consumes the same dimParams() output), so both paths dim identically.
     Black stays black; the tint's channels set how hard each hue comes
     down (cool tint = dark tinted glass, no additive putty floor). */
  if (u_dim > 0.0) {
    col *= vec3(u_dimR, u_dimG, u_dimB);
  }

  col = mix(col, vec3(1.0), spec * u_specOpacity);
  outColor = vec4(col * inside * u_alpha, inside * u_alpha);   /* premultiplied */
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('createShader failed');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('createProgram failed');
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function newTex(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error('createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

function texFromCanvas(gl: WebGL2RenderingContext, src: HTMLCanvasElement): WebGLTexture {
  const t = newTex(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  return t;
}

/** The map textures: the app's ImageData uploaded as-is. R/G carry the
 *  displacement vector, alpha carries the specular intensity. */
function texFromImageData(gl: WebGL2RenderingContext, img: ImageData): WebGLTexture {
  const t = newTex(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    img.width,
    img.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(img.data.buffer),
  );
  return t;
}

/** One cached map pair for a geometry. */
interface MapEntry {
  disp: WebGLTexture | null;
  spec: WebGLTexture;
  maxAbs: number;
  hasDisp: boolean;
  cornerExp: number;
  circle: boolean;
  bytes: number;
}

/** Map-texture budget. The lab drew 24 fixed panels; the app has ~76 glass
 *  surfaces across pages and sizes keep appearing as you navigate
 *  (kind|WxH|radius), so the cache must evict or a long session leaks GPU
 *  memory. Oldest-first (Map insertion order), textures deleted on evict. */
const MAX_MAP_BYTES = 48 * 1024 * 1024;

/** Plate-load deadline. A stalled image (cold/evicted cache on mobile, or an
 *  engine that never fires onload/onerror) must not park the atomic swap
 *  forever — see setPlate(). */
const PLATE_LOAD_TIMEOUT_MS = 8000;
const PLATE_MAX_RETRIES = 2;
const PLATE_RETRY_DELAY_MS = 1200;

/** Every plate-load stage a load can stop at — reported verbatim so the
 *  ?perf=1 report names the failing step instead of a swallowed promise. */
type PlateStage =
  | 'pending'
  | 'ok'
  | 'img-err'
  | 'timeout'
  | 'no-2d'
  | 'raster-err'
  | 'tex-err'
  | 'bitmap-err';

/** Plate-load failure carrying its pipeline stage, so setPlate's chain can
 *  map any step to the telemetry values the ?perf=1 report reads. */
function plateFail(
  stage: Exclude<PlateStage, 'pending' | 'ok'>,
  msg: string,
): Error & { stage: string } {
  return Object.assign(new Error(msg), { stage });
}

/** Plate source chain for a plate URL: the SVG first, then its pre-rendered
 *  raster twin (`x.svg` → `x.2x.webp`, tools/render-plate-rasters.mjs).
 *  iPhone Safari refuses to decode this artwork through <img> — field report
 *  plate:'img-err' on every retry, with correct width/height on the root,
 *  while the same SVG paints fine as a CSS background. A raster decode is a
 *  path every engine supports. */
function plateSources(url: string): string[] {
  if (url.endsWith('.svg')) return [url, url.slice(0, -4) + '.2x.webp'];
  return [url];
}

/** One attempt in setPlate's chain: the vector/raster bytes through <img>,
 *  then the raster through fetch→createImageBitmap (a decode queue the
 *  engine can reach even when its <img> path is refused). */
interface PlateAttempt {
  kind: 'img' | 'bitmap';
  url: string;
  isRaster: boolean;
}

export class GlassRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private bgProg: WebGLProgram;
  private glassProg: WebGLProgram;
  private quad: WebGLBuffer;
  private bgCorner: number;
  private glCorner: number;
  private plateTex: WebGLTexture | null = null;
  private plateSize: [number, number] = [1, 1];
  private plateLoadId = 0;
  private maps = new Map<string, MapEntry>();
  private mapBytes = 0;
  private uniCache = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private frameW = 0;
  private frameH = 0;
  private frameDpr = 1;
  /** Dev-only: paint each panel's inside mask into R (deterministic corner
   *  verification via gl.readPixels). Never enabled in production paths. */
  maskProbe = false;

  /** Plate pipeline telemetry — the last stage the load reached. Travels into
   *  the ?perf=1 report (engine.plate) so a field failure names the step
   *  (img-err / timeout / no-2d / raster-err / tex-err) instead of vanishing
   *  into a swallowed promise. 'ok' once the texture is uploaded. */
  plateStage: PlateStage = 'pending';
  /** The URL the current plate stage belongs to (retry race guard). */
  plateURL = '';
  plateRetryCount = 0;
  /** Which source landed the plate texture: the vector plate via <img>
   *  ('svg'), the `.2x.webp` twin via <img> ('raster'), or the twin through
   *  the fetch→bitmap escape hatch ('bitmap'). Telemetry only — travels
   *  into the ?perf=1 report (engine.boot.plateSrc). */
  plateSrc: 'svg' | 'raster' | 'bitmap' | null = null;
  /** Chain trail of the LAST load cycle: 'svg:img-err', 'raster:img-err',
   *  'bitmap:bitmap-err' … names which source died at which stage. */
  plateTried: string[] = [];
  /** Final-failure forensics — per URL `name:status:bytes:decode`. Set by
   *  probePlate only when the whole chain failed; [] otherwise. */
  plateProbe: string[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.canvas = canvas;

    this.bgProg = program(gl, BG_VS, BG_FS);
    this.glassProg = program(gl, GLASS_VS, GLASS_FS);

    const quad = gl.createBuffer();
    if (!quad) throw new Error('createBuffer failed');
    this.quad = quad;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    this.bgCorner = gl.getAttribLocation(this.bgProg, 'a_corner');
    this.glCorner = gl.getAttribLocation(this.glassProg, 'a_corner');
  }

  /** Load the plate artwork and rasterize it at a DPR-aware size.
   *
   *  Two traps here, both of which make the backdrop look pixelated/soft while
   *  the CSS mode looks crisp (the CSS path scales the SVG as vectors):
   *   1. Rasterizing at a fixed size — the app plate's viewBox is 1600x1000,
   *      and an SVG with no width/height attributes reports a default
   *      replaced-element size (Chromium: 240x150), NOT the viewBox — and then
   *      stretching it over a wider viewport MAGNIFIES it. With LINEAR
   *      filtering and no mipmaps that reads as blurry, blocky texture.
   *      Rasterize at the size it will actually occupy instead, times DPR.
   *      (naturalWidth/naturalHeight share the viewBox aspect ratio, so the
   *      cover scale is safe to derive from them.)
   *  The raster is capped so a 4K viewport does not allocate a 30MP texture.
   *
   *  The whole chain is deadline-guarded because on some engines (reported:
   *  iPhone Safari) `onload` never fires and `onerror` never fires either —
   *  without the timeout the atomic swap would wait forever, glReady would
   *  stay false, and every panel would sit on the CSS material for the whole
   *  session with nothing in the report to say why. A stall is not fatal:
   *  the retry below re-enters the same guard.
   *
   *  SOURCE CHAIN: the SVG is tried first, then its committed `.2x.webp`
   *  raster twin; desktop engines keep the vector plate untouched, and
   *  plateSrc in the report names the source that won. (This chain was
   *  built chasing field `img-err` reports that were later traced to the
   *  computed --page-plate arriving CSS-escaped on iOS 26.6 — a corrupted
   *  URL before the network, not a decode refusal; see cssUrl.ts. The extra
   *  rungs stay as defense-in-depth against genuine decode failures.)
   *
   *  Last resort: fetch→createImageBitmap — a decode queue separate from
   *  <img>. If even that fails, probePlate() records fetch status/byte
   *  count and the decode error name per URL, so the next field report is
   *  decisive instead of a picture of a swallowed promise. */
  setPlate(url: string): Promise<void> {
    const id = ++this.plateLoadId;
    const imgs = plateSources(url);
    const attempts: PlateAttempt[] = imgs.map((u, i) => ({ kind: 'img', url: u, isRaster: i > 0 }));
    attempts.push({ kind: 'bitmap', url: imgs[imgs.length - 1], isRaster: imgs.length > 1 });
    this.plateTried = [];
    this.plateProbe = [];
    const attempt = (i: number, lastErr: unknown): Promise<void> => {
      if (id !== this.plateLoadId) return Promise.resolve(); // superseded
      if (i >= attempts.length) {
        void this.probePlate(imgs);
        return Promise.reject(
          lastErr instanceof Error ? lastErr : new Error(`plate load failed: ${url}`),
        );
      }
      const a = attempts[i];
      const tag = a.kind === 'bitmap' ? 'bitmap' : a.isRaster ? 'raster' : 'svg';
      const load =
        a.kind === 'bitmap'
          ? this.loadPlateBitmap(a.url, id)
          : this.loadPlateSource(a.url, id, a.isRaster);
      return load.catch((e) => {
        this.plateTried.push(`${tag}:${(e as { stage?: string }).stage ?? 'err'}`);
        return attempt(i + 1, e);
      });
    };
    return attempt(0, null);
  }

  /** One source attempt inside setPlate's chain. Resolves when the texture
   *  is up; a stale load (a newer setPlate won) resolves silently — the
   *  newer call owns every field. Rejects with a stage-tagged error. */
  private loadPlateSource(url: string, id: number, isRaster: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      const timer = setTimeout(() => {
        this.plateStage = 'timeout';
        finish(() => reject(plateFail('timeout', `plate load timed out: ${url}`)));
      }, PLATE_LOAD_TIMEOUT_MS);
      img.onload = () => {
        // a newer setPlate() landed first (theme flip during load) — drop this
        if (id !== this.plateLoadId) return finish(() => resolve());
        try {
          this.uploadRaster(
            img,
            img.naturalWidth || 1600,
            img.naturalHeight || 1000,
            isRaster ? 'raster' : 'svg',
          );
          finish(() => resolve());
        } catch (e) {
          // A stage-tagged failure (no-2d / tex-err above) already recorded
          // the precise step — the catch must not overwrite it with the
          // generic 'raster-err' (the pre-chain code did exactly that).
          if (e instanceof Error && 'stage' in e) {
            finish(() => reject(e));
          } else {
            this.plateStage = 'raster-err';
            finish(() => reject(plateFail('raster-err', e instanceof Error ? e.message : String(e))));
          }
        }
      };
      img.onerror = () => {
        this.plateStage = 'img-err';
        finish(() => reject(plateFail('img-err', `plate load failed: ${url}`)));
      };
      img.src = url;
    });
  }

  /** Rasterize a decoded source at the DPR-aware cover size and upload it as
   *  the plate texture. Shared by the <img> chain and the fetch→bitmap
   *  escape hatch (loadPlateBitmap). Throws a stage-tagged plateFail
   *  ('no-2d' / 'tex-err') so setPlate's trail names the failing step. */
  private uploadRaster(
    src: CanvasImageSource,
    nw: number,
    nh: number,
    srcName: 'svg' | 'raster' | 'bitmap',
  ): void {
    const dpr = this.frameDpr || Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const MAX_SIDE = 4096;
    const cover = Math.max((window.innerWidth * dpr) / nw, (window.innerHeight * dpr) / nh);
    let w = Math.round(nw * cover);
    let h = Math.round(nh * cover);
    const cap = MAX_SIDE / Math.max(w, h);
    if (cap < 1) {
      w = Math.round(w * cap);
      h = Math.round(h * cap);
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) {
      this.plateStage = 'no-2d';
      throw plateFail('no-2d', '2d context unavailable');
    }
    ctx.drawImage(src, 0, 0, w, h);
    if (this.plateTex) this.gl.deleteTexture(this.plateTex);
    // Drain stale errors so the check below only sees this upload.
    this.gl.getError();
    this.plateTex = texFromCanvas(this.gl, c);
    // A 0x0 or oversized raster uploads without a GL error and then
    // paints nothing — the swap would flip onto an empty backdrop.
    if (this.gl.getError() !== this.gl.NO_ERROR) {
      this.plateStage = 'tex-err';
      throw plateFail('tex-err', 'plate texture upload failed');
    }
    this.plateSize = [w, h];
    this.plateStage = 'ok';
    this.plateSrc = srcName;
    this.plateProbe = [];
  }

  /** fetch→createImageBitmap escape hatch — a decode queue separate from
   *  <img> (defense-in-depth; see setPlate's docblock: the original field
   *  failures were a corrupted URL, not a decode refusal). Lands the plate
   *  texture without ever touching <img>. */
  private loadPlateBitmap(url: string, id: number): Promise<void> {
    if (typeof createImageBitmap !== 'function') {
      return Promise.reject(plateFail('bitmap-err', 'createImageBitmap unavailable'));
    }
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      // Same deadline as the <img> path — a hung fetch must not park the
      // atomic swap forever (the exact bug PLATE_LOAD_TIMEOUT_MS prevents).
      const timer = setTimeout(() => {
        this.plateStage = 'timeout';
        finish(() => reject(plateFail('timeout', `bitmap load timed out: ${url}`)));
      }, PLATE_LOAD_TIMEOUT_MS);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw plateFail('bitmap-err', `bitmap fetch ${res.status}: ${url}`);
          return res.blob();
        })
        .then((blob) => createImageBitmap(blob))
        .then((bmp) => {
          try {
            finish(() => {
              if (id !== this.plateLoadId) {
                resolve(); // superseded — a newer setPlate owns every field
                return;
              }
              try {
                this.uploadRaster(bmp, bmp.width, bmp.height, 'bitmap');
                resolve();
              } catch (e) {
                reject(e);
              }
            });
          } finally {
            // Closed exactly once on every branch (upload is synchronous, so
            // the texture is already on the GPU by the time we get here).
            bmp.close();
          }
        })
        .catch((e) => finish(() => reject(e)));
    });
  }

  /** Final-failure forensics, recorded into the report (engine.boot.plateProbe):
   *  per candidate URL, the fetch status + byte count + createImageBitmap
   *  verdict. Separates the three failure classes the field can hit —
   *  network (fetch-err), server (status), decode (bmp-err:Name, with the
   *  error name <img>.onerror never exposes) — so the next field report is
   *  actionable instead of another round-trip guess. */
  private async probePlate(urls: string[]): Promise<void> {
    const out: string[] = [];
    for (const u of urls) {
      const name = u.split('/').pop() || u;
      try {
        const res = await fetch(u);
        const buf = await res.arrayBuffer();
        let bmp = 'bmp-skip';
        if (typeof createImageBitmap === 'function') {
          try {
            const b = await createImageBitmap(
              new Blob([buf], { type: res.headers.get('content-type') || '' }),
            );
            bmp = `bmp:${b.width}x${b.height}`;
            b.close();
          } catch (e) {
            bmp = `bmp-err:${e instanceof Error ? e.name : 'err'}`;
          }
        }
        out.push(`${name}:${res.status}:${buf.byteLength}:${bmp}`);
      } catch {
        out.push(`${name}:fetch-err`);
      }
    }
    this.plateProbe = out;
  }

  /** Retry a stalled/failed plate load with a bounded, delayed backoff. Two
   *  attempts, 1.2s apart — enough to ride out a cold/evicted-cache stall on
   *  mobile without hammering the network or blocking the swap forever. */
  retryPlate(url: string): void {
    this.plateRetryCount++;
    if (this.plateRetryCount > PLATE_MAX_RETRIES) return;
    setTimeout(() => {
      if (url !== this.plateURL) return; // a theme flip won the race
      void this.setPlate(url).catch(() => this.retryPlate(url));
    }, PLATE_RETRY_DELAY_MS);
  }

  /** Build (and cache) the displacement+specular maps for one geometry, using
   *  the app's own mapMath. `params` is the pinned token recipe. */
  private mapsFor(kind: GlassKind, w: number, h: number, params: GlassPaintParams): MapEntry {
    const radius = params.radius;
    const key = `${kind}|${Math.round(w)}x${Math.round(h)}|${Math.round(radius)}`;
    const hit = this.maps.get(key);
    if (hit) {
      // refresh LRU order (Map iterates insertion order: newest last)
      this.maps.delete(key);
      this.maps.set(key, hit);
      return hit;
    }
    const cornerExp = mapCornerExp(params.cornerExp, params.cornerShapeSupported);
    const prof = computeProfile(params.bezel, params.thickness);
    const r = Math.min(radius, Math.min(w, h) / 2 - 1);
    const scale = params.dpr * mapScaleFor(w, h);
    let disp: WebGLTexture | null = null;
    let maxAbs = 1;
    let bytes = 0;
    if (kind !== 'pane') {
      const dm = buildDisplacementMap(w, h, r, params.bezel, prof, scale, cornerExp);
      maxAbs = dm.maxAbs;
      disp = texFromImageData(this.gl, dm.img);
      bytes += dm.img.width * dm.img.height * 4;
    }
    const specImg = buildSpecularMap(w, h, r, params.specAngle, scale, params.specPeak, cornerExp);
    const entry: MapEntry = {
      disp,
      spec: texFromImageData(this.gl, specImg),
      maxAbs,
      hasDisp: kind !== 'pane',
      cornerExp,
      circle: kind === 'drop' || isCircleRadius(w, h, radius),
      bytes: bytes + specImg.width * specImg.height * 4,
    };
    this.maps.set(key, entry);
    this.mapBytes += entry.bytes;
    this.evictMaps();
    return entry;
  }

  /** Drop oldest map entries until the byte budget fits. Never evicts the
   *  entry just inserted (evictMaps runs after set), so a single oversized
   *  geometry still draws. */
  private evictMaps(): void {
    while (this.mapBytes > MAX_MAP_BYTES && this.maps.size > 1) {
      const oldest = this.maps.keys().next();
      if (oldest.done) break;
      const key = oldest.value;
      const entry = this.maps.get(key);
      this.maps.delete(key);
      if (!entry) continue;
      if (entry.disp) this.gl.deleteTexture(entry.disp);
      this.gl.deleteTexture(entry.spec);
      this.mapBytes -= entry.bytes;
    }
  }

  /** Resize the drawing buffer to the canvas' CSS size × DPR. `u_res` is the
   *  buffer in device px; every CSS-px uniform is derived from it (u_dpr
   *  divides back). Reads clientWidth/clientHeight — the canvas' CSS 100%
   *  size — not window.inner*: they can differ (scrollbars, mobile bars) and
   *  a mismatch would scale the whole backdrop. */
  private resize(): { w: number; h: number; dpr: number } {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.frameW = w;
    this.frameH = h;
    this.frameDpr = dpr;
    return { w, h, dpr };
  }

  private uni(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let programCache = this.uniCache.get(p);
    if (!programCache) {
      programCache = new Map();
      this.uniCache.set(p, programCache);
    }
    if (!programCache.has(name)) {
      programCache.set(name, this.gl.getUniformLocation(p, name));
    }
    return programCache.get(name) ?? null;
  }

  private bindTex(p: WebGLProgram, name: string, tex: WebGLTexture | null, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.uni(p, name), unit);
  }

  /** Start a frame: resize + clear to fully transparent. */
  beginFrame(): void {
    this.resize();
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /** Wipe the canvas without drawing (used when the engine tears down). */
  clear(): void {
    this.resize();
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /** Backdrop pass: the page plate, cover-scaled and centred, over the whole
   *  viewport. Same geometry as the CSS plate layer (background-size: cover). */
  drawBackdrop(): void {
    const gl = this.gl;
    if (!this.plateTex) return;
    gl.useProgram(this.bgProg);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.bgCorner);
    gl.vertexAttribPointer(this.bgCorner, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.uni(this.bgProg, 'u_res'), this.frameW, this.frameH);
    gl.uniform1f(this.uni(this.bgProg, 'u_dpr'), this.frameDpr);
    gl.uniform2f(this.uni(this.bgProg, 'u_plateSize'), this.plateSize[0], this.plateSize[1]);
    this.bindTex(this.bgProg, 'u_plate', this.plateTex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** One panel. `rect` is a viewport-relative DOMRect subset in CSS px.
   *  `alpha` follows the panel's (and its wrappers') inline opacity so motion
   *  fades animate the glass with the same curve the DOM content fades with. */
  drawPanel(kind: GlassKind, rect: GlassRect, params: GlassPaintParams, alpha = 1): void {
    const gl = this.gl;
    const dpr = this.frameDpr;
    const entry = this.mapsFor(kind, rect.width, rect.height, params);
    const p = this.glassProg;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.glCorner);
    gl.vertexAttribPointer(this.glCorner, 2, gl.FLOAT, false, 0, 0);

    /* NaN guard: gl.uniform1f(loc, undefined) stores NaN, the shader paints
       col * NaN, and the panel comes out opaque black with NO error anywhere.
       Coerce here so a missing param degrades to a visible default instead. */
    const f1 = (name: string, v: number) => gl.uniform1f(this.uni(p, name), Number.isFinite(v) ? v : 0);
    gl.uniform2f(this.uni(p, 'u_res'), this.frameW, this.frameH);
    gl.uniform1f(this.uni(p, 'u_dpr'), dpr);
    gl.uniform2f(this.uni(p, 'u_rect'), rect.left * dpr, rect.top * dpr);
    gl.uniform2f(this.uni(p, 'u_size'), rect.width * dpr, rect.height * dpr);
    gl.uniform1f(
      this.uni(p, 'u_radius'),
      Math.min(params.radius, Math.min(rect.width, rect.height) / 2) * dpr,
    );
    gl.uniform1f(this.uni(p, 'u_cornerExp'), entry.cornerExp);
    gl.uniform1f(this.uni(p, 'u_circle'), entry.circle ? 1 : 0);
    gl.uniform1f(this.uni(p, 'u_hasDisp'), entry.hasDisp ? 1 : 0);
    gl.uniform1f(
      this.uni(p, 'u_dispScale'),
      2 * entry.maxAbs * params.refraction * params.scaleRatio,
    );
    f1('u_blur', params.blur);
    f1('u_sat', params.sat);
    f1('u_fillA1', params.fillA1);
    f1('u_fillA2', params.fillA2);
    f1('u_fillAngle', params.fillAngle);
    const [dr, dg, db] = dimParams(params);
    f1('u_dim', kind === 'drop' ? 0 : params.dim);
    gl.uniform1f(this.uni(p, 'u_dimR'), dr[0]);
    gl.uniform1f(this.uni(p, 'u_dimG'), dg[0]);
    gl.uniform1f(this.uni(p, 'u_dimB'), db[0]);
    f1('u_specOpacity', params.specOpacity);
    f1('u_alpha', alpha);
    gl.uniform1f(this.uni(p, 'u_maskProbe'), this.maskProbe ? 1 : 0);
    gl.uniform2f(this.uni(p, 'u_plateSize'), this.plateSize[0], this.plateSize[1]);
    this.bindTex(p, 'u_plate', this.plateTex, 0);
    this.bindTex(p, 'u_disp', entry.disp || this.plateTex, 1);
    this.bindTex(p, 'u_spec', entry.spec, 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  get mapCount(): number {
    return this.maps.size;
  }

  get plateDims(): [number, number] {
    return this.plateSize;
  }

  /** True once the plate artwork has landed as a texture. Until then the
   *  canvas must stay hidden (an alpha-less backbuffer is opaque black) and
   *  the CSS material keeps showing. */
  get hasPlate(): boolean {
    return this.plateTex !== null;
  }

  dispose(): void {
    const gl = this.gl;
    for (const e of this.maps.values()) {
      if (e.disp) gl.deleteTexture(e.disp);
      gl.deleteTexture(e.spec);
    }
    this.maps.clear();
    this.mapBytes = 0;
    if (this.plateTex) gl.deleteTexture(this.plateTex);
    this.plateTex = null;
    this.uniCache.clear();
    // Free the context slot (Chrome caps live contexts ~16). The canvas is
    // single-use after this — the engine always builds a fresh one.
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
