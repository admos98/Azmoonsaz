/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Glass shader sources + GL context helpers — extracted verbatim from
 * webglRenderer.ts. The two programs' GLSL (bg pass + per-panel glass pass)
 * and the WebGL boilerplate (compile/program/texture upload). No renderer
 * state; GlassRenderer owns the GL objects these build.
 */

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

/** Vertical overscan, CSS px (--glass-ov on the canvas): the box extends
    this far past both viewport edges so the compositor sync translate has
    painted coverage to move into. 0 on engines without the sync. */
uniform float u_ov;

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
uniform float u_gsat;       // global saturate from the CSS chain (glx 1.5, lens 1)
uniform float u_alpha;       // the panel's own inline opacity (motion fades)

/* ── The parent frost (M2-A child-glass anchoring) ─────────────────────────
   A glass child INSIDE a canvas-drawn glass parent paints on the same
   station (one rect clock, one --glass-sync translate). What a CSS backdrop
   root passes down to a nested child is the parent's finished composite —
   dim wash + fill step over the blurred plate — so the child's backdrop
   here = plate, blurred, then the parent's FROZEN terms applied. The
   parent's rim displacement/specular are boundary-local and edge-weighted
   maps are zero in the interior, where children sit; skipping them keeps
   one extra map lookup out of the shader (documented approximation). */
uniform float u_pHas;        // 1 = a canvas-drawn parent owns this backdrop
uniform float u_pDim;        // the parent's --lens-dim wash strength
uniform float u_pDimTr;      // parent dim tint, 0..255
uniform float u_pDimTg;
uniform float u_pDimTb;
uniform float u_pDimLift;    // parent's dark white-veil weight
uniform float u_pFillA;      // the parent's fill alpha AT the child's position
uniform vec3  u_pFillTint;   // the parent's fill tint

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
  /* viewCss arrives in VIEWPORT space (the DOM plate layer's own space; the
     fragment flips out of canvas space by minus u_ov first). The plate box
     is the viewport (vw x vh) — the canvas is 2*u_ov taller, so the
     viewport height is u_res.y/dpr minus 2*u_ov. The sample must register
     with the CSS cover/center background of #app-teacher-shell::before:
     same box, same cover scale. */
  float pw = u_res.x / u_dpr;
  float ph = u_res.y / u_dpr - 2.0 * u_ov;
  float ps = max(pw / u_plateSize.x, ph / u_plateSize.y);
  return (viewCss - vec2(pw, ph) * 0.5) / (u_plateSize * ps) + 0.5;
}

vec3 backdropAt(vec2 viewCss) {
  return texture(u_plate, clamp(plateUV(viewCss), 0.0, 1.0)).rgb;
}

/* 25-tap blur, CSS px radius. Chromium's backdrop blur is a true gaussian
   with sigma = radius/2; this is a cheap approximation. Two kernels:
     · radius < 4  — the original tight kernel (lens 1px, pane 2px, menu 3px,
       drop 0.5px): shipped & lab-validated at mean|d| 1.55; DO NOT TOUCH.
     · radius >= 4 — wide-radius kernel for the glx family (8/16/26px):
       taps at (±2σ, ±2σ), σ = radius/2, gaussian weights, normalized. The
       tight kernel at 8px measured mean|d| 7.66 vs Skia on the dev harness;
       this one fits the real gaussian (see glx-parity diff). */
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

  vec2 viewCss = v_view / u_dpr - vec2(0.0, u_ov);
  vec3 back = blurred(viewCss, u_blur);
  /* feDisplacementMap semantics: read the map at THIS pixel, offset the source
     sample by (R-0.5)*scale, (G-0.5)*scale. Same numbers feDisplacementMap
     receives from the same map bytes. */
  if (u_hasDisp > 0.5) {
    vec2 dm = texture(u_disp, v_local / u_size).rg;
    vec2 disp = (dm - 0.5) * u_dispScale;
    back = blurred(viewCss + disp, u_blur);
  }

  /* Parent frost (M2-A): a canvas child's backdrop samples the finished
     composite its parent layer shows — child blur lands on an already-
     dimmed, already-filled field, so the parent's dim + fill apply HERE,
     on the displaced plate sample that stands in for it (see uniform
     docblock). Order matches the CSS composite: dim, then fill. */
  if (u_pHas > 0.5) {
    vec3 pf = clamp(back, 0.0, 1.0);
    if (u_pDim > 0.0) {
      pf = pf + u_pDim * pf * (vec3(u_pDimTr, u_pDimTg, u_pDimTb) / 255.0 - pf);
      if (u_pDimLift > 0.0) {
        pf = pf + u_pDimLift * (vec3(1.0) - pf) * (vec3(1.0) - pf);
      }
    }
    if (u_pFillA > 0.0) {
      pf = mix(pf, u_pFillTint / 255.0, u_pFillA);
    }
    back = pf;
  }

  /* Chain saturate — CSS applies blur → saturate → url in order, so the
     saturate reads the DISPLACED image. Applied here, after the sample.
     Lens chains carry none (u_gsat = 1). */
  if (abs(u_gsat - 1.0) > 0.001) back = mix(vec3(luma(back)), back, u_gsat);

  /* saturate inside the specular mask, blended over the raw displaced backdrop */
  float spec = texture(u_spec, v_local / u_size).a;
  vec3 saturated = mix(vec3(luma(back)), back, u_sat);
  vec3 col = mix(back, saturated, spec);

  /* dim wash — INSIDE the url() chain (CSS dim input = withSaturation).
     Apple's highlight-weighted wash toward the tint:
         out = in + b·(in/255)·(tint − in)
     whites move the full distance toward the tint ("whites washed"), blacks
     never move (weight 0 — no grey floor), mids barely; every channel moves
     toward the SAME tint, so hue/saturation structure is preserved (dark
     tinted glass, not the uniform crush of a flat multiply). Clamp first:
     CSS clamps between filter primitives, so the input here is [0,1]. */
  if (u_dim > 0.0) {
    vec3 pre = clamp(col, 0.0, 1.0);
    col = pre + u_dim * pre * (vec3(u_dimTr, u_dimTg, u_dimTb) / 255.0 - pre);
    /* White-veil lift (dark theme): a (1−x)²-weighted white tint on the
       INPUT value — lifts ONLY the deepest darks (≈ u_dimLift·255 at black),
       EXACTLY zero at pure white (the wash's own domain). On dark backdrops
       the wash alone moves nothing (backdrop ≈ tint); this is what makes
       the material read as its own faint layer there — the "very very
       subtle white tint" — without greying mids or touching highlights.
       0 in light. Mirrors mapMath.dimChannel (input-weighted). */
    if (u_dimLift > 0.0) {
      vec3 u = vec3(1.0) - pre;
      col = col + u_dimLift * u * u;
    }
  }

  /* specular arc — the chain's final blend, over the dimmed result. */
  col = mix(col, vec3(1.0), spec * u_specOpacity);

  /* CSS paints the element's own background OVER its backdrop-filter output:
     the fill gradient composites LAST (bare lens fill = 0, so this renders
     on glx/glx-strong only). CSS gradient semantics exactly: dir =
     (sin θ, −cos θ) with y down, the magic-corner length, t 0→1 across the
     box; tint from --glass-p-tint so dark glx keeps its near-black body. */
  float ang = radians(u_fillAngle);
  vec2 dir = vec2(sin(ang), -cos(ang));
  float glen = max(1.0, abs(u_size.x * dir.x) + abs(u_size.y * dir.y));
  float t = clamp(dot(v_local - u_size * 0.5, dir) / glen + 0.5, 0.0, 1.0);
  col = mix(col, u_fillTint / 255.0, mix(u_fillA1, u_fillA2, t));
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

export {
  BG_VS,
  BG_FS,
  GLASS_VS,
  GLASS_FS,
  compile,
  program,
  newTex,
  texFromCanvas,
  texFromImageData,
};
