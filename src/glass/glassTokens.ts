/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Glass token readers + shape helpers — extracted from glassController.ts
 * verbatim. Pure computed-style readers; no engine state.
 */

/** Every surface the engine considers glass. The nested test (isNestedGlass)
 *  and the engine's own sweeps agree on this exact selector. */
import type { LensParams } from './lensEngine';

const GLASS_SELECTOR = '.lens, .pane, .drop, .glx, .glx-strong, .glx-dark';


const CORNER_SHAPE_SUPPORTED =
  typeof CSS !== 'undefined' &&
  CSS.supports?.('corner-shape', 'superellipse(3)') === true;

function cssNum(cs: CSSStyleDeclaration, name: string, fallback: number): number {
  const v = parseFloat(cs.getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/** The dim tint (RGB 0..255) from --glass-dim-tint — "31 29 41" in light,
 *  "16 15 28" in the dark scope. The WASH TARGET: whites and highlights
 *  head for this colour (see mapMath's wash law). Unparseable input falls
 *  back to the light slate so the dim stays a tinted wash, never a grey
 *  lift. */
function dimTintOf(cs: CSSStyleDeclaration): [number, number, number] {
  const raw = cs.getPropertyValue('--glass-dim-tint').trim().split(/\s+/);
  const nums = raw.map((n) => parseFloat(n)).filter((n) => Number.isFinite(n));
  if (nums.length >= 3) return [nums[0], nums[1], nums[2]];
  return [31, 29, 41];
}

/** The dark white-veil lift from --glass-dim-lift ("0" light, "0.03" dark):
 *  a (1−x)²-weighted white tint that lifts ONLY the deepest darks ≈3.0/255
 *  so a dark material reads as its own faint layer over a dark backdrop
 *  ("in dark mode dimming is useless" — the wash alone moves nothing when
 *  backdrop ≈ tint). Whites stay untouched (veil weight 0 at 255). Light
 *  carries 0: a veil over warm paper would only grey it. */
function dimLiftOf(cs: CSSStyleDeclaration): number {
  const v = parseFloat(cs.getPropertyValue('--glass-dim-lift'));
  return Number.isFinite(v) ? Math.max(0, Math.min(0.25, v)) : 0;
}

/** The fill gradient's tint from --glass-p-tint (light 255 255 255, dark
 *  16 15 28). The shader reproduces the CSS fill in the THEME's tint so a
 *  drawn glx keeps its dark near-black body instead of flipping white. */
function fillTintOf(cs: CSSStyleDeclaration): [number, number, number] {
  const raw = cs.getPropertyValue('--glass-p-tint').trim().split(/\s+/);
  const nums = raw.map((n) => parseFloat(n)).filter((n) => Number.isFinite(n));
  if (nums.length >= 3) return [nums[0], nums[1], nums[2]];
  return [255, 255, 255];
}

function radiusOf(el: HTMLElement, cs: CSSStyleDeclaration, fallback: number): number {
  const raw = (cs.borderRadius || '').trim().split(/[\s/]+/)[0];
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  if (raw.endsWith('%')) return (n / 100) * Math.min(el.offsetWidth, el.offsetHeight);
  return n;
}

function kindOf(el: Element): 'lens' | 'pane' | 'drop' | null {
  if (el.classList.contains('lens')) return 'lens';
  if (el.classList.contains('pane')) return 'pane';
  if (el.classList.contains('drop')) return 'drop';
  if (el.classList.contains('glx-strong') || el.classList.contains('glx-dark') || el.classList.contains('glx'))
    return 'lens';
  return null;
}

/**
 * True when the element sits inside another glass surface. A parent with
 * backdrop-filter is a BACKDROP ROOT: the child can only sample the parent's
 * own flat fill, so a url() bend attached here bends a flat field (no visible
 * refraction) while the full ~10-primitive SVG graph still runs per frame per
 * surface. The engine never dresses these — their CSS quiet material owns
 * them, at zero filter cost.
 */
function isNestedGlass(el: Element): boolean {
  return !!el.parentElement?.closest?.(GLASS_SELECTOR);
}

/** The boot params: read the lens physics tokens off the document root once.
 *  (merged: former defaultParamsFromRoot + readParams duplicates in the controller) */
export function readParams(): LensParams {
  const cs = getComputedStyle(document.documentElement);
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
    // Girih optics (Meraj P0): the token is the ONLY switch — 0 disables the
    // wave entirely (byte-identical pre-Meraj maps). Fallback 0 keeps SSR,
    // tests and any scope that never defined the token on the old math.
    girihAmp: cssNum(cs, '--lens-girih', 0),
    girihFold: cssNum(cs, '--lens-girih-fold', 10),
  };
}

export {
  GLASS_SELECTOR,
  CORNER_SHAPE_SUPPORTED,
  cssNum,
  dimTintOf,
  dimLiftOf,
  fillTintOf,
  radiusOf,
  kindOf,
  isNestedGlass,
};

