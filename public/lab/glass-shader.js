/**
 * WebGL2 glass renderer — the GPU path for the lens bend.
 *
 * WHY THIS EXISTS: url(#…) inside backdrop-filter has no GPU-compositor path
 * in Chromium. Chrome snapshots the backdrop and runs the SVG graph through
 * Skia on the RASTER path, per surface, per frame. Measured collapse on this
 * machine (RTX 3070): 6 panels 59.8fps -> 8 panels 21.6 -> 30 panels 15.5.
 * Safari never runs it at all (boot.js gates the lens to Chromium >= 138).
 *
 * Same math, different machine: sampleUV = uv - n*bend is a texture-lookup
 * offset the GPU does for free. This renderer consumes THE APP'S OWN maps (the
 * same ImageData maps.js builds for feImage) in the same order as
 * lensEngine.buildFilterMarkup(), so the comparison in the lab is meaningful.
 *
 * DRAW MODEL — one canvas for the whole page (Chrome caps live WebGL contexts
 * ~16, evicting oldest; a shared pass is cheaper anyway), two programs:
 *   1. bgProgram    — one quad over the viewport: the plate, with the scrolling
 *                     strip painted inside the scroll box's rect.
 *   2. glassProgram — one quad PER PANEL, so each fragment shades only its own
 *                     panel's pixels (30 draw calls is nothing; a per-pixel
 *                     loop over panels would not be).
 * The panels are DOM elements; the canvas sits fixed behind them and every
 * frame the renderer reads their rects. That is how the sticky bar and real
 * scrolling work with a GPU paint: the glass follows the element, not the
 * other way round.
 */

import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  dimStrength,
  isCircleRadius,
  mapCornerExp,
  mapScaleFor,
} from './maps.js';

const BG_VS = `#version 300 es
in vec2 a_corner;
void main() { gl_Position = vec4(a_corner * 2.0 - 1.0, 0.0, 1.0); }`;

const BG_FS = `#version 300 es
precision highp float;
uniform vec2  u_res;
uniform float u_dpr;
uniform sampler2D u_plate;
uniform vec2  u_plateSize;
uniform sampler2D u_strip;
uniform vec2  u_stripSize;
uniform vec4  u_scrollRect;   // x,y,w,h in CSS px
uniform float u_scrollY;      // scrollTop in CSS px
out vec4 outColor;

vec2 plateUV(vec2 viewCss) {
  float ps = max(u_res.x / u_dpr / u_plateSize.x, u_res.y / u_dpr / u_plateSize.y);
  return (viewCss - (u_res / u_dpr) * 0.5) / (u_plateSize * ps) + 0.5;
}

void main() {
  vec2 viewCss = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;
  vec2 r = u_scrollRect.xy;
  vec2 s = u_scrollRect.zw;
  if (viewCss.x >= r.x && viewCss.x <= r.x + s.x && viewCss.y >= r.y && viewCss.y <= r.y + s.y) {
    vec2 uv = vec2((viewCss.x - r.x) / u_stripSize.x, (viewCss.y - r.y + u_scrollY) / u_stripSize.y);
    if (uv.y <= 1.0) { outColor = vec4(texture(u_strip, uv).rgb, 1.0); return; }
  }
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
uniform sampler2D u_strip;
uniform vec2  u_stripSize;
uniform vec4  u_scrollRect;
uniform float u_scrollY;

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
uniform vec3  u_fillTint;   // the fill gradient's tint (255 255 255 light / 16 15 28 dark)
uniform float u_dim;
uniform float u_dimTr;      // dim tint, 0..255 (the wash target)
uniform float u_dimTg;
uniform float u_dimTb;
uniform float u_dimLift;    // dark white-veil: (1−x)² white tint on deep darks
uniform float u_specOpacity;
uniform float u_gsat;       // chain saturate (glx 1.5, lens 1)

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
  vec2 r = u_scrollRect.xy;
  vec2 s = u_scrollRect.zw;
  if (viewCss.x >= r.x && viewCss.x <= r.x + s.x && viewCss.y >= r.y && viewCss.y <= r.y + s.y) {
    vec2 uv = vec2((viewCss.x - r.x) / u_stripSize.x, (viewCss.y - r.y + u_scrollY) / u_stripSize.y);
    if (uv.y <= 1.0) return texture(u_strip, uv).rgb;
  }
  return texture(u_plate, clamp(plateUV(viewCss), 0.0, 1.0)).rgb;
}

/* 25-tap blur, CSS px radius. Chromium's backdrop blur is a true gaussian; this
   is a cheap approximation — adequate for an A/B, and its cost is FLAT across
   panel counts, which is the property under test. */
/* 25-tap blur — mirrors webglRenderer.ts: tight kernel below 4px (the
   validated lens family), wide gaussian-fitting kernel at glx radii. */
vec3 blurred(vec2 viewCss, float radius) {
  if (radius < 0.35) return backdropAt(viewCss);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  if (radius < 4.0) {
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        vec2 off = vec2(float(i), float(j)) * radius * 0.55;
        float w = exp(-float(i * i + j * j) / 4.0);
        acc += backdropAt(viewCss + off) * w;
        wsum += w;
      }
    }
  } else {
    float s = radius * 0.5;
    for (int i = -3; i <= 3; i++) {
      for (int j = -3; j <= 3; j++) {
        vec2 off = vec2(float(i), float(j)) * s;
        float w = exp(-float(i * i + j * j) / 2.0);
        acc += backdropAt(viewCss + off) * w;
        wsum += w;
      }
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

  /* Chain saturate — CSS order blur → saturate → url: reads the DISPLACED
     image. Only glx/glx-strong chains carry it (u_gsat ≥ 1; lens 1). */
  if (abs(u_gsat - 1.0) > 0.001) back = mix(vec3(luma(back)), back, u_gsat);

  /* saturate inside the specular mask, blended over the raw displaced backdrop */
  float spec = texture(u_spec, v_local / u_size).a;
  vec3 saturated = mix(vec3(luma(back)), back, u_sat);
  vec3 col = mix(back, saturated, spec);

  /* dim wash — Apple's highlight-weighted wash toward the tint (mirrors
     webglRenderer): whites move the full distance, blacks never move, all
     channels converge on ONE tint (hue survives). Dark adds the white-veil
     lift — input-weighted (1−x)², deep darks only, 0 at white. */
  if (u_dim > 0.0) {
    vec3 pre = clamp(col, 0.0, 1.0);
    col = pre + u_dim * pre * (vec3(u_dimTr, u_dimTg, u_dimTb) / 255.0 - pre);
    if (u_dimLift > 0.0) {
      vec3 u = vec3(1.0) - pre;
      col = col + u_dimLift * u * u;
    }
  }

  /* specular arc — the chain's final blend, over the dimmed result. */
  col = mix(col, vec3(1.0), spec * u_specOpacity);

  /* CSS paints the element's own background OVER its backdrop-filter output:
     the fill gradient composites LAST (bare lens fill = 0, so this renders
     on glx/glx-strong only). CSS gradient semantics exactly, theme tint. */
  float ang = radians(u_fillAngle);
  vec2 dir = vec2(sin(ang), -cos(ang));
  float glen = max(1.0, abs(u_size.x * dir.x) + abs(u_size.y * dir.y));
  float t = clamp(dot(v_local - u_size * 0.5, dir) / glen + 0.5, 0.0, 1.0);
  col = mix(col, u_fillTint / 255.0, mix(u_fillA1, u_fillA2, t));
  outColor = vec4(col * inside, inside);   /* premultiplied */
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function newTex(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

function texFromCanvas(gl, src) {
  const t = newTex(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  return t;
}

/** The map textures: the app's ImageData uploaded as-is. R/G carry the
 *  displacement vector, alpha carries the specular intensity. */
function texFromImageData(gl, img) {
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

export class GlassRenderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true, // pixel verification / screenshots
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.canvas = canvas;

    this.bgProg = program(gl, BG_VS, BG_FS);
    this.glassProg = program(gl, GLASS_VS, GLASS_FS);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    this.bgCorner = gl.getAttribLocation(this.bgProg, 'a_corner');
    this.glCorner = gl.getAttribLocation(this.glassProg, 'a_corner');

    this.plateTex = null;
    this.plateSize = [1, 1];
    this.stripTex = null;
    this.stripSize = [1, 1];
    this.maskProbe = false; // dev: paint the inside mask (R) for deterministic corner tests
    this.maps = new Map();
  }

  /** Load the plate SVG and rasterize it at a DPR-aware size.
   *
   *  Two traps here, both of which make the backdrop look pixelated/soft while
   *  the CSS mode looks crisp (the CSS path scales the SVG as vectors):
   *   1. Rasterizing at a fixed size — the viewBox is 1600x1000, and an SVG with
   *      no width/height attributes reports a default replaced-element size
   *      (Chromium: 240x150), NOT the viewBox — and then stretching it over a
   *      wider viewport MAGNIFIES it. With LINEAR filtering and no mipmaps that
   *      reads as blurry, blocky texture. Rasterize at the size it will actually
   *      occupy instead, times DPR. (naturalWidth/naturalHeight share the
   *      viewBox's 1.6 aspect ratio, so the cover scale is safe to derive from
   *      them.)
   *  The raster is capped so a 4K viewport does not allocate a 30MP texture. */
  async setPlate(url) {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`plate load failed: ${url}`));
      i.src = url;
    });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const MAX_SIDE = 4096;
    const cover = Math.max(
      (window.innerWidth * dpr) / (img.naturalWidth || 1600),
      (window.innerHeight * dpr) / (img.naturalHeight || 1000),
    );
    let w = Math.round((img.naturalWidth || 1600) * cover);
    let h = Math.round((img.naturalHeight || 1000) * cover);
    const cap = MAX_SIDE / Math.max(w, h);
    if (cap < 1) {
      w = Math.round(w * cap);
      h = Math.round(h * cap);
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    if (this.plateTex) this.gl.deleteTexture(this.plateTex);
    this.plateTex = texFromCanvas(this.gl, c);
    this.plateSize = [w, h];
  }

  /** The scrolling strip: one canvas artwork, used as a CSS background in CSS
   *  mode and as a texture here — one source, so the A/B is honest.
   *
   *  `stripSize` is deliberately the CSS size, not the canvas pixel size: both
   *  UV paths divide CSS coordinates by it, and the texture's own resolution is
   *  irrelevant to UV (0..1 spans the whole image whatever its pixel count).
   *  Keeping it in CSS px while the texture is DPR-scaled is what gives one
   *  texel per device pixel. */
  setStrip(canvasEl, cssW, cssH) {
    if (this.stripTex) this.gl.deleteTexture(this.stripTex);
    this.stripTex = texFromCanvas(this.gl, canvasEl);
    this.stripSize = [cssW, cssH];
  }

  /** Build (and cache) the displacement+specular maps for one geometry, using
   *  the mapMath port. `params` is the pinned token recipe. */
  mapsFor(kind, w, h, radius, params) {
    const key = `${kind}|${Math.round(w)}x${Math.round(h)}|${Math.round(radius)}|${params.girihAmp || 0}x${params.girihFold || 10}`;
    const hit = this.maps.get(key);
    if (hit) return hit;
    const cornerExp = mapCornerExp(params.cornerExp, params.cornerShapeSupported);
    const prof = computeProfile(params.bezel, params.thickness);
    const r = Math.min(radius, Math.min(w, h) / 2 - 1);
    const scale = params.dpr * mapScaleFor(w, h);
    let disp = null;
    let maxAbs = 1;
    if (kind !== 'pane') {
      const dm = buildDisplacementMap(w, h, r, params.bezel, prof, scale, cornerExp, params.girihAmp || 0, params.girihFold || 10);
      maxAbs = dm.maxAbs;
      disp = texFromImageData(this.gl, dm.img);
    }
    const specImg = buildSpecularMap(w, h, r, params.specAngle, scale, params.specPeak, cornerExp);
    const entry = {
      disp,
      spec: texFromImageData(this.gl, specImg),
      maxAbs,
      hasDisp: kind !== 'pane',
      cornerExp,
      circle: kind === 'drop' || isCircleRadius(w, h, radius),
    };
    this.maps.set(key, entry);
    return entry;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(window.innerWidth * dpr));
    const h = Math.max(2, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return { w, h, dpr };
  }

  bindTex(prog, name, tex, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  /** Wipe the canvas. Called when leaving webgl/split mode so the last painted
   *  frame does not stay baked behind the CSS panels. */
  clear() {
    const { w, h } = this.resize();
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /** Backdrop pass: plate everywhere, scrolling strip inside its rect.
   *  scroll = { rect: [x,y,w,h] CSS px, top: scrollTop in CSS px }. */
  drawBackdrop(scroll) {
    const gl = this.gl;
    const { w, h, dpr } = this.resize();
    gl.useProgram(this.bgProg);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.bgCorner);
    gl.vertexAttribPointer(this.bgCorner, 2, gl.FLOAT, false, 0, 0);

    const u = (n) => gl.getUniformLocation(this.bgProg, n);
    gl.uniform2f(u('u_res'), w, h);
    gl.uniform1f(u('u_dpr'), dpr);
    gl.uniform2f(u('u_plateSize'), this.plateSize[0], this.plateSize[1]);
    gl.uniform2f(u('u_stripSize'), this.stripSize[0], this.stripSize[1]);
    gl.uniform4f(u('u_scrollRect'), ...scroll.rect);
    gl.uniform1f(u('u_scrollY'), scroll.top);
    this.bindTex(this.bgProg, 'u_plate', this.plateTex, 0);
    this.bindTex(this.bgProg, 'u_strip', this.stripTex, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** One panel. `rect` is a DOMRect (CSS px), `params` the token recipe. */
  drawPanel(kind, rect, radius, params, scroll) {
    const gl = this.gl;
    const { w, h, dpr } = this.resize();
    const entry = this.mapsFor(kind, rect.width, rect.height, radius, params);
    const p = this.glassProg;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.glCorner);
    gl.vertexAttribPointer(this.glCorner, 2, gl.FLOAT, false, 0, 0);

    const u = (n) => gl.getUniformLocation(p, n);
    /* NaN guard: gl.uniform1f(loc, undefined) stores NaN, the shader paints
       col * NaN, and the panel comes out opaque black with NO error anywhere.
       Coerce here so a missing param degrades to a visible default instead. */
    const f1 = (name, v) => gl.uniform1f(u(name), Number.isFinite(v) ? v : 0);
    gl.uniform2f(u('u_res'), w, h);
    gl.uniform1f(u('u_dpr'), dpr);
    gl.uniform2f(u('u_rect'), rect.left * dpr, rect.top * dpr);
    gl.uniform2f(u('u_size'), rect.width * dpr, rect.height * dpr);
    gl.uniform1f(u('u_radius'), Math.min(radius, Math.min(rect.width, rect.height) / 2) * dpr);
    gl.uniform1f(u('u_cornerExp'), entry.cornerExp);
    gl.uniform1f(u('u_circle'), entry.circle ? 1 : 0);
    gl.uniform1f(u('u_hasDisp'), entry.hasDisp ? 1 : 0);
    gl.uniform1f(u('u_dispScale'), 2 * entry.maxAbs * params.refraction * params.scaleRatio);
    f1('u_blur', params.blur);
    f1('u_sat', params.sat);
    f1('u_gsat', params.gsat);
    f1('u_fillA1', params.fillA1);
    f1('u_fillA2', params.fillA2);
    f1('u_fillAngle', params.fillAngle);
    gl.uniform3f(u('u_fillTint'), params.fillTint[0], params.fillTint[1], params.fillTint[2]);
    const b = dimStrength({ dim: params.dim, dimTint: params.dimTint });
    f1('u_dim', kind === 'drop' ? 0 : b);
    gl.uniform1f(u('u_dimTr'), params.dimTint[0]);
    gl.uniform1f(u('u_dimTg'), params.dimTint[1]);
    gl.uniform1f(u('u_dimTb'), params.dimTint[2]);
    f1('u_dimLift', params.dimLift ?? 0);
    f1('u_specOpacity', params.specOpacity);
    gl.uniform1f(u('u_maskProbe'), this.maskProbe ? 1 : 0);
    gl.uniform4f(u('u_scrollRect'), ...scroll.rect);
    gl.uniform1f(u('u_scrollY'), scroll.top);

    gl.uniform2f(u('u_plateSize'), this.plateSize[0], this.plateSize[1]);
    gl.uniform2f(u('u_stripSize'), this.stripSize[0], this.stripSize[1]);
    this.bindTex(p, 'u_plate', this.plateTex, 0);
    this.bindTex(p, 'u_strip', this.stripTex, 1);
    this.bindTex(p, 'u_disp', entry.disp || this.plateTex, 2);
    this.bindTex(p, 'u_spec', entry.spec, 3);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    const gl = this.gl;
    for (const e of this.maps.values()) {
      if (e.disp) gl.deleteTexture(e.disp);
      if (e.spec) gl.deleteTexture(e.spec);
    }
    this.maps.clear();
    if (this.plateTex) gl.deleteTexture(this.plateTex);
    if (this.stripTex) gl.deleteTexture(this.stripTex);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
