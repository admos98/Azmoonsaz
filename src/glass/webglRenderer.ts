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
 * Ported from the lab renderer (public/lab/glass-shader.js) with its three
 * fixed defects: borderDist sign convention, explicit canvas CSS size,
 * DPR-aware texture raster. Floating panels over live DOM keep the CSS path —
 * the shader samples only the in-flow page plate; nested children of drawn
 * panels join this path since the M2-A anchoring (see drawPanel). */

import {
  BG_VS,
  BG_FS,
  GLASS_VS,
  GLASS_FS,
  program,
  texFromCanvas,
  texFromImageData,
} from './webglShaders';
import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  dimStrength,
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
  /** The fill gradient's tint, 0..255 — the CSS `--glass-p-tint`. Light: a
   *  white frost; dark: a near-black wash. The shader must reproduce the
   *  gradient in the theme's own tint (glx carries its fill in CSS, so a
   *  hardcoded white would flip its dark appearance). */
  fillTint: [number, number, number];
  /** Global saturate from the element's CSS chain: glx/glx-strong carry
   *  `blur() saturate()`; lens chains carry none (1). Applied BEFORE the
   *  displacement, matching the CSS chain order. */
  gsat: number;
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

/** A canvas child's parent frost (M2-A anchoring): the frozen parent terms a
 *  CSS backdrop root passes down — its rect (for the fill gradient's t), the
 *  dim wash, and the fill alpha already mixed at the child's position. Built
 *  by the controller from the parent's own PaintEntry each frame. */
export interface ParentPaint {
  rect: GlassRect;
  dim: number;
  dimTint: [number, number, number];
  dimLift: number;
  fillA: number;
  fillTint: [number, number, number];
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

/** Map-texture budget: the app has ~76 glass surfaces and geometry keys keep
 *  appearing, so the cache must evict or a long session leaks GPU memory. */
const MAX_MAP_BYTES = 48 * 1024 * 1024;

/** Plate-load deadline — a stalled image must not park the atomic swap
 *  forever (see setPlate). */
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
 *  raster twin (`x.svg` → `x.2x.webp`, tools/render-plate-rasters.mjs). The
 *  raster twin is a path every engine decodes (theiPhone <img> refusals that
 *  built this chain were later traced to the escaped URL — see cssUrl.ts). */
function plateSources(url: string): string[] {
  if (url.endsWith('.svg')) return [url, url.slice(0, -4) + '.2x.webp'];
  return [url];
}

/** One setPlate attempt: the bytes through <img>, then the raster through
 *  fetch→createImageBitmap (a decode queue separate from <img>). */
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
  /** Vertical overscan in CSS px (--glass-ov): the canvas box extends this
   *  far past both viewport edges (compositor sync headroom). 0 disables —
   *  panel rects and the plate sample then map 1:1, the pre-sync geometry. */
  ov = 0;

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
    /* alpha:true — GLASS-ONLY canvas (compositor sync): everything outside
       the painted panels must be transparent so the DOM plate layer shows
       through; the shader outputs premultiplied alpha (the pre-sync build
       painted the plate itself, alpha:false). */
    const gl = canvas.getContext('webgl2', {
      alpha: true,
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
   *  Why DPR-aware: an SVG with no width/height reports a default replaced-
   *  element size (Chromium 240x150), NOT its viewBox — stretching that over
   *  a viewport MAGNIFIES it (LINEAR filter, no mipmaps → blocky texture).
   *  Rasterize at the size the cover actually occupies, times DPR; capped so
   *  a 4K viewport does not allocate a 30MP texture.
   *
   *  Deadline-guarded: some engines (iPhone Safari) fire neither onload nor
   *  onerror — without the timeout the atomic swap would wait forever and
   *  every panel would sit on the CSS material with nothing in the report
   *  saying why. A stall is not fatal: retryPlate re-enters the same guard.
   *
   *  Source chain: the SVG first, then its committed `.2x.webp` raster twin,
   *  then fetch→createImageBitmap (a decode queue separate from <img>). The
   *  extra rungs stay as defense-in-depth — the field `img-err` reports that
   *  built this chain were eventually traced to the iOS-escaped URL (see
   *  cssUrl.ts), not to a decode refusal. Full failure forensics in
   *  probePlate(): per-URL fetch status, byte count, decode verdict. */
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

  /** One source attempt inside setPlate's chain; a stale load (a newer
   *  setPlate won) resolves silently. Rejects with a stage-tagged error. */
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
   *  <img>; same deadline guard as the <img> path. */
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

  /** Final-failure forensics (engine.boot.plateProbe), recorded only when the
   *  whole chain failed: per URL `name:status:bytes:decode` — separating
   *  network / server / decode classes so the next field report is decisive. */
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

  /** Retry a stalled/failed plate load: two attempts, 1.2s apart — enough to
   *  ride out a cold-cache stall on mobile without hammering the network. */
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
      const dm = buildDisplacementMap(w, h, r, params.bezel, prof, scale, cornerExp, params.girihAmp, params.girihFold);
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
   *  buffer in device px; every CSS-px uniform is derived from it. Reads
   *  clientWidth/clientHeight (the canvas' CSS 100% size), not window.inner*:
   *  they can differ (scrollbars, mobile bars) — a mismatch would scale the
   *  whole backdrop. */
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

  /** Resize only (public, for the controller's idle gate). A real buffer
   *  re-allocation means the browser cleared it — the caller marks the
   *  frame dirty. */
  resizeFrame(): void {
    this.resize();
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
   *  fades animate the glass like the DOM content fades. `parent` (M2-A) is
   *  non-null only for a canvas child: it freezes the parent's dim + fill
   *  into the child's backdrop. */
  drawPanel(
    kind: GlassKind,
    rect: GlassRect,
    params: GlassPaintParams,
    alpha = 1,
    parent?: ParentPaint | null,
  ): void {
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

    /* NaN guard: uniform1f(loc, undefined) stores NaN — the shader paints
       col * NaN and the panel comes out opaque black with NO error. */
    const f1 = (name: string, v: number) => gl.uniform1f(this.uni(p, name), Number.isFinite(v) ? v : 0);
    gl.uniform2f(this.uni(p, 'u_res'), this.frameW, this.frameH);
    gl.uniform1f(this.uni(p, 'u_dpr'), dpr);
    gl.uniform1f(this.uni(p, 'u_ov'), this.ov);
    gl.uniform2f(this.uni(p, 'u_rect'), rect.left * dpr, (rect.top + this.ov) * dpr);
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
    gl.uniform3f(
      this.uni(p, 'u_fillTint'),
      params.fillTint[0],
      params.fillTint[1],
      params.fillTint[2],
    );
    const b = dimStrength(params);
    f1('u_dim', kind === 'drop' ? 0 : b);
    gl.uniform1f(this.uni(p, 'u_dimTr'), params.dimTint[0]);
    gl.uniform1f(this.uni(p, 'u_dimTg'), params.dimTint[1]);
    gl.uniform1f(this.uni(p, 'u_dimTb'), params.dimTint[2]);
    gl.uniform1f(this.uni(p, 'u_dimLift'), params.dimLift ?? 0);
    f1('u_specOpacity', params.specOpacity);
    f1('u_gsat', params.gsat);
    /* Parent frost (M2-A canvas children): the controller composes the
       parent's frozen terms; when a parent carried the draw, forward them.
       u_pHas gates the shader block; zero when no parent is bound. */
    f1('u_pHas', parent ? 1 : 0);
    if (parent) {
      f1('u_pDim', parent.dim);
      gl.uniform1f(this.uni(p, 'u_pDimTr'), Number.isFinite(parent.dimTint[0]) ? parent.dimTint[0] : 31);
      gl.uniform1f(this.uni(p, 'u_pDimTg'), Number.isFinite(parent.dimTint[1]) ? parent.dimTint[1] : 29);
      gl.uniform1f(this.uni(p, 'u_pDimTb'), Number.isFinite(parent.dimTint[2]) ? parent.dimTint[2] : 41);
      gl.uniform1f(this.uni(p, 'u_pDimLift'), Number.isFinite(parent.dimLift) ? parent.dimLift : 0);
      f1('u_pFillA', parent.fillA);
      gl.uniform3f(
        this.uni(p, 'u_pFillTint'),
        parent.fillTint[0],
        parent.fillTint[1],
        parent.fillTint[2],
      );
    }
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
