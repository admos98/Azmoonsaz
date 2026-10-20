/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WebGL pipeline staging — extracted verbatim from glassController.ts.
 * Tier gate, drawable-class classification, placeability gate, shader
 * recipe, the inline paint-kill pair, track/untrack, and the themed plate
 * URL read. State (draw set, caches, gl readiness) is lent through the
 * PipelineHost bound in mountGlassEngine — data flows DOWN, no cycles.
 */
import { cssUnescape, plateURLFromComputed } from './cssUrl';
import { mapDPR } from './lensEngine';
import {
  CORNER_SHAPE_SUPPORTED,
  cssNum,
  dimLiftOf,
  dimTintOf,
  fillTintOf,
  radiusOf,
} from './glassTokens';
import type { GlassKind, GlassPaintParams } from './webglRenderer';

/** Host-bridge into the engine's live state. Bound once at mount. */
export interface PipelineHost {
  /** Draw-loop dirt flag — track/untrack mark it, glFrame clears it. */
  markDirty(): void;
  /** True once the plate texture is live (kill applies post-swap). */
  isGlReady(): boolean;
  /** The per-frame draw list (owned by the controller). */
  drawSet: Set<HTMLElement>;
  /** Last CSS chain per element (owned by the controller). */
  byEl: WeakMap<Element, string>;
  /** Last painted recipe per element (owned by the controller). */
  paintCache: WeakMap<HTMLElement, { kind: GlassKind; params: GlassPaintParams }>;
  /** The teacher shell lookup — placeability walks its ancestry. */
  shellAt(): HTMLElement | null;
}

let host: PipelineHost | null = null;

/** Bind the engine state. Idempotent — rebinding re-points the same hooks. */
export function bindPipeline(h: PipelineHost): void {
  host = h;
}

function markDirty(): void {
  host?.markDirty();
}

function glReady(): boolean {
  return host?.isGlReady() ?? false;
}

function shellAt(): HTMLElement | null {
  return host?.shellAt() ?? null;
}

/** Last raw computed --page-plate (the engine's exact serialization). */
let plateRaw = '';
/** True when that serialization carried CSS escapes and was decoded on
 *  read. Escaped input is not a fetchable URL (the `\` reads as a path
 *  separator) — leaving it verbatim killed every plate request on iPhone. */
let plateEsc = false;

/** Cheap change-signature: scroll + draw-set size only. Rect changes are
 *  signalled by the mutation/layout observers (they set the engine's dirt
 *  flag), never by per-frame getBoundingClientRect calls — that would
 *  reintroduce the layout thrash the two-phase flush exists to avoid. */
export function drawnSig(): string {
  return `${window.scrollY}|${(host?.drawSet ?? new Set()).size}`;
}

/** Serialization forensics for the ?perf=1 boot report. */
export function plateSerialization(): { plateRaw: string; plateEsc: boolean } {
  return { plateRaw, plateEsc };
}

function tierAllowsGlass(): boolean {
  const tier = document.documentElement.dataset.glass;
  return tier !== 'lite' && tier !== 'off';
}

/** Drawable class → kind. glx/glx-strong ARE shader-served now: their CSS
 *  url() graph through Skia was the dominant scroll cost on dense pages
 *  (questions: 1.55M px urlArea/frame). The shader runs the same chain;
 *  glx-dark stays CSS — it is the fixed ink field, not a plate-over panel.
 *  `?glxc=0` forces glx back to the CSS path — the A/B lever for parity
 *  captures (one variable: who paints the glx family). */
const GLX_ON_CSS: boolean = (() => {
  try {
    return new URLSearchParams(location.search).get('glxc') === '0';
  } catch {
    return false;
  }
})();

function webglKindOf(el: Element): GlassKind | null {
  const cl = el.classList;
  // glx* families: formerly CSS-only ("their bloom lines are CSS"). Their
  // url() graph through Skia is the dominant scroll cost on dense pages
  // (questions: 1.55M px urlArea per frame at ~13fps). The shader runs the
  // SAME chain (same maps, same order — webglRenderer docblock), and their
  // one CSS-only element, the inset bloom line, survives the swap because
  // the paint rule keeps box-shadow on glx (see base.css). glx-dark stays
  // CSS: it is the fixed ink field, not a plate-over panel.
  if (cl.contains('glx-dark')) return null;
  if (cl.contains('glx') || cl.contains('glx-strong')) {
    if (GLX_ON_CSS) return null;
    // glx inputs (`.field`) keep their CSS material: the glx gates exclude
    // .field everywhere (never engine targets — no url() to shed).
    if (cl.contains('field')) return null;
    return 'lens';
  }
  if (cl.contains('lens')) return 'lens';
  if (cl.contains('pane')) return 'pane';
  if (cl.contains('drop')) return 'drop';
  return null;
}

/** True when the panel's backdrop is provably the plate: in flow inside the
 *  shell, no fixed/sticky/absolute ancestor, no clip/scroll ancestor, no
 *  ancestor painting a fill or artwork over the plate plane. Conservative on
 *  purpose — a panel left on the CSS path is a smaller bug than a panel
 *  showing the wrong layer. */
function webglPlaceable(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  const ownPos = cs.position;
  if (ownPos === 'fixed' || ownPos === 'sticky' || ownPos === 'absolute') return false;
  const shell = shellAt();
  if (!shell) return false;
  let n = el.parentElement;
  while (n && n !== shell) {
    const acs = getComputedStyle(n);
    const p = acs.position;
    if (p === 'fixed' || p === 'sticky' || p === 'absolute') return false;
    if (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') return false;
    if (acs.backgroundImage !== 'none') return false;
    const bg = acs.backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) return false;
    n = n.parentElement;
  }
  return n === shell;
}

/** The panel's shader recipe — the same tokens chainOf() reads for the CSS
 *  chain, in numeric form. `sat` stays at the lab's 1.15: drawn families
 *  carry no saturate() in their base chains. dpr mirrors the CSS map build
 *  (mapDPR caps 1..2 by viewport). */
function paramsForWebgl(el: HTMLElement, cs: CSSStyleDeclaration): GlassPaintParams {
  const lensBlur = cssNum(cs, '--lens-blur', 1);
  const isGlx = el.classList.contains('glx') || el.classList.contains('glx-strong');
  const isGlxStrong = el.classList.contains('glx-strong');
  let blur: number;
  if (el.classList.contains('lens--menu')) blur = cssNum(cs, '--lens-menu-blur', 3);
  else if (el.classList.contains('pane')) blur = lensBlur * 2;
  else if (el.classList.contains('drop')) blur = cssNum(cs, '--drop-blur', 0.5);
  else if (isGlxStrong) blur = cssNum(cs, '--glass-p-blur', 16);
  else if (isGlx) blur = cssNum(cs, '--glass-bg-blur', 8);
  else blur = lensBlur;
  /* NO shader fill for glx (nor anyone): the element's OWN background
     gradient stays DOM-painted on the shader path (base.css keeps it for
     glx/glx-strong), compositing over the canvas exactly as it composited
     over the url() chain in CSS mode. Per-element overrides (a page rule
     with higher specificity replacing the utility gradient) are the
     cascade's to decide — a token-derived shader fill cannot see them and
     measured +6/255 off (glx-parity bisect). --glass-fill is 0 on the full
     tier, so this is inert machinery for lite/off tiers only. */
  /* Masked rim saturation stays at the lab's 1.15 for every drawn family.
     The CHAIN-level saturate (blur → saturate → url) is what glx/glx-strong
     carry — and now menus too (--lens-menu-sat, the vibrancy contract);
     it feeds u_gsat (applied after the displacement sample). */
  const sat = 1.15;
  let gsat = 1;
  if (isGlxStrong) gsat = cssNum(cs, '--glass-p-sat', 1.5);
  else if (isGlx) gsat = cssNum(cs, '--glass-bg-sat', 1.5);
  else if (el.classList.contains('lens--menu')) gsat = cssNum(cs, '--lens-menu-sat', 1.4);
  return {
    bezel: cssNum(cs, '--lens-bezel', 14),
    thickness: cssNum(cs, '--lens-thickness', 66),
    refraction: cssNum(cs, '--lens-refraction-level', 0.7),
    scaleRatio: cssNum(cs, '--lens-scale-ratio', 1),
    specOpacity: cssNum(cs, '--lens-spec-opacity', 0.2),
    specSaturation: cssNum(cs, '--lens-spec-saturation', 4),
    specAngle: cssNum(cs, '--lens-spec-angle', -60),
    specPeak: cssNum(cs, '--lens-spec-peak', 1),
    cornerExp: cssNum(cs, '--corner-exp', 3),
    dim: cssNum(cs, '--lens-dim', 0.15),
    dimTint: dimTintOf(cs),
    dimLift: dimLiftOf(cs),
    blur,
    /* Masked rim saturation stays at the lab's 1.15 for every drawn family.
       The CHAIN-level saturate (blur → saturate → url) is what only glx/glx-
       strong carry; it feeds u_gsat (applied after the displacement sample). */
    sat,
    gsat,
    fillA1: cssNum(cs, '--glass-fill', 0),
    fillA2: cssNum(cs, '--glass-fill', 0),
    fillAngle: cssNum(cs, '--glass-p-angle', 180),
    fillTint: fillTintOf(cs),
    radius: radiusOf(el, cs, cssNum(cs, '--lens-radius', 21)),
    dpr: mapDPR(),
    cornerShapeSupported: CORNER_SHAPE_SUPPORTED,
  };
}

/** Kill the DOM backdrop-filter INLINE (both spellings, !important).
 *  The stylesheet strip rule cannot be trusted for this: production
 *  minification drops its standard declaration (dist ships the -webkit-
 *  form only) and Chrome does not honor that form — every drawn panel kept
 *  blurring the canvas underneath ("the big panels stutter": double paint
 *  over the largest surfaces). Inline !important wins everywhere; applied
 *  at the atomic swap (and to panels tracked after it), removed on
 *  untrack / teardown. */
function applyPaintKill(el: HTMLElement): void {
  el.style.setProperty('backdrop-filter', 'none', 'important');
  el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
}

function clearPaintKill(el: HTMLElement): void {
  el.style.removeProperty('backdrop-filter');
  el.style.removeProperty('-webkit-backdrop-filter');
}

/** Track a panel into the per-frame draw list. The engine writes NO inline
 *  backdrop-filter in WebGL mode: any chain from an earlier CSS flush is
 *  cleared and the stylesheet keeps showing the material until the atomic
 *  swap turns [data-glass-paint] panels transparent. */
function trackWebgl(el: HTMLElement, kind: GlassKind, params: GlassPaintParams): void {
  if (!host) return;
  host.paintCache.set(el, { kind, params });
  host.drawSet.add(el);
  markDirty();
  if (el.dataset.glassPaint !== 'webgl') el.dataset.glassPaint = 'webgl';
  clearPaintKill(el); // a stale CSS chain or an old kill must not survive re-track
  if (glReady()) applyPaintKill(el); // post-swap tracks kill immediately
  if (el.dataset.lastQuickKey) delete el.dataset.lastQuickKey;
  host.byEl.delete(el);
}

function untrackWebgl(el: HTMLElement): void {
  if (!host) return;
  host.drawSet.delete(el);
  markDirty();
  clearPaintKill(el);
  if (el.dataset.glassPaint) delete el.dataset.glassPaint;
}

/** Read the themed plate URL. The computed value is DECODED before use:
 *  iOS 26.6 serializes a computed custom property with CSS escapes applied
 *  (field: `url(/backgrounds/bg-d-light\.svg)`) — taken verbatim, the `\`
 *  reads as a fetch-path separator and every plate request died before the
 *  network (img-err on both <img> sources, fetch-err in the probe) while the
 *  file itself decoded fine by hand. The lab page bends on the same iPhone
 *  because it never crosses this boundary (URL is a string literal there).
 *  plateRaw/plateEsc carry the serialization into the ?perf=1 report. */
function plateURLForTheme(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--page-plate').trim();
  plateRaw = raw;
  plateEsc = cssUnescape(raw) !== raw;
  return plateURLFromComputed(raw);
}

export {
  tierAllowsGlass,
  webglKindOf,
  webglPlaceable,
  paramsForWebgl,
  applyPaintKill,
  clearPaintKill,
  trackWebgl,
  untrackWebgl,
  plateURLForTheme,
};
