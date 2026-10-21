/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * M1 chrome pass — the floating glass panels (topbar pills, menus,
 * notifications, every fixed/sticky lens) bend on the SAME shader as the
 * big panels, via a SECOND fixed canvas (#glass-chrome). WebKit drops
 * url() inside backdrop-filter (bug 245510) — the CSS fall-through can
 * never serve the chrome on the phone; the shader can, on every engine.
 *
 * Plane geometry: the chrome canvas is fixed, z-29 — ABOVE the content
 * layer (z-10) and #glass-canvas (z-1), BELOW the chrome's own text and
 * controls (header z-30, dropdown containers z-60+). Transparent holes
 * let the composed content-plus-plate below show through; the shader
 * frosts FLOATING panels only.
 *
 * Stage 1 (this module): panels whose rect is viewport-stable shade from
 * the PLATE texture alone — the documented limitation; menus open over
 * calm plate most sessions. Stage 3 adds the DOM-delta texture.
 *
 * The controller drives exactly three calls — bootChrome (after the main
 * renderer boots), tickChrome (from the shared rAF, self-gating),
 * shutdownChrome (main teardown or a chrome context loss) — and reports
 * chromeStats(). All panel state (draw set, paint cache, dirty flags)
 * lives here; the controller carries zero chrome state.
 */

import { GlassRenderer } from './webglRenderer';
import type { GlassKind, GlassPaintParams } from './webglRenderer';
import {
  clearPaintKill,
  applyPaintKill,
  plateURLForTheme,
} from './glassPipeline';

/** A/B lever (?glxf=0) — same shape as ?glxc / the CSS-path levers. */
const CHROME_OFF: boolean = (() => {
  try {
    return new URLSearchParams(location.search).get('glxf') === '0';
  } catch {
    return false;
  }
})();

interface ChromeEntry {
  kind: GlassKind;
  params: GlassPaintParams;
}

let canvas: HTMLCanvasElement | null = null;
let renderer: GlassRenderer | null = null;
let ready = false; // the chrome plate texture is up; attr flipped
let broken = false; // chrome context loss — chrome stays CSS this session
const drawSet = new Set<HTMLElement>();
const paintCache = new WeakMap<HTMLElement, ChromeEntry>();
let dirty = false;
let lastDrawn = 0;
let lastFrameW = 0;
let lastFrameH = 0;

/** ?perf=1 snapshot — read through glassStats(). */
export function chromeStats(): {
  drawn: number;
  boot: 'pending' | 'ok' | 'broken' | 'off';
} {
  return {
    drawn: lastDrawn,
    boot: broken ? 'broken' : renderer ? 'ok' : CHROME_OFF ? 'off' : 'pending',
  };
}

/** True when the chrome planes need a paint (feeds the shared idle gate so
 *  an animating menu repaints even over a static main canvas). */
export function chromePending(): boolean {
  if (!renderer || !ready) return false;
  if (dirty) return true;
  if (drawSet.size === 0) return false;
  // Fading chrome panels repaint like main-path fades do.
  for (const el of drawSet) if (effectiveAlpha(el) < 0.999) return true;
  return false;
}

/** Boot the second plane. Called after the main renderer initializes —
 *  the boot probe + tier already gate WebGL2 capability for both. */
export function bootChrome(): void {
  if (canvas || broken || CHROME_OFF) return;
  const shell = document.getElementById('app-teacher-shell');
  if (!shell) return;
  try {
    canvas = document.createElement('canvas');
    canvas.id = 'glass-chrome';
    canvas.setAttribute('aria-hidden', 'true');
    shell.appendChild(canvas);
    const r = new GlassRenderer(canvas); // ov stays 0 — no sync translate
    canvas.addEventListener('webglcontextlost', () => shutdownChrome(true), false);
    renderer = r;
    const url = plateURLForTheme();
    if (url) void r.setPlate(url).catch(() => r.retryPlate(url));
  } catch {
    // A chrome context must not take the main pass down: CSS owns the
    // chrome this session, byte-identical with the pre-M1 fallback.
    canvas?.remove();
    canvas = null;
    renderer = null;
    broken = true;
  }
}

/** Theme flip: reload the chrome plate behind the load-id race guard. */
export function refreshChromePlate(): void {
  if (!renderer) return;
  const url = plateURLForTheme();
  void renderer.setPlate(url).catch(() => renderer?.retryPlate(url));
}

/** Per-frame draw. Piggybacks the controller's rAF; early-outs cheaply
 *  when the chrome planes are at rest (renderer-less, not ready, or the
 *  same idle key the main canvas uses). */
export function tickChrome(): void {
  const r = renderer;
  if (!r || !canvas || !canvas.isConnected) return;
  if (!ready && r.hasPlate) {
    ready = true;
    document.documentElement.dataset.glassChrome = 'webgl';
    dirty = true;
    // Atomic swap for the chrome plane: the canvas paints these panels
    // from here, their DOM backdrop-filter dies inline.
    for (const el of drawSet) applyPaintKill(el);
  }
  if (!ready) return;

  const before = `${canvas.width}x${canvas.height}`;
  r.resizeFrame();
  const resized = before !== `${canvas.width}x${canvas.height}`;
  if (resized) dirty = true;
  if (!dirty) return;
  dirty = false;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = 96;
  r.beginFrame();
  let drawn = 0;
  for (const el of drawSet) {
    if (!el.isConnected) {
      drawSet.delete(el);
      continue;
    }
    const entry = paintCache.get(el);
    if (!entry) continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -M || rect.top > vh + M || rect.right < -M || rect.left > vw + M) continue;
    if (rect.width < 2 || rect.height < 2) continue;
    try {
      r.drawPanel(
        entry.kind,
        // Floating rects are viewport-stable — no sync translate, no lead.
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        entry.params,
        effectiveAlpha(el),
      );
      drawn++;
    } catch {
      /* one bad geometry must not kill the loop */
    }
  }
  lastFrameW = canvas.width;
  lastFrameH = canvas.height;
  lastDrawn = drawn;
}

/** Tear the chrome plane down (main teardown or a chrome context loss).
 *  `lost` marks a context loss — permanent for the session; the MAIN pass
 *  is never touched from here (independent shutdown). */
export function shutdownChrome(lost: boolean): void {
  if (lost) broken = true;
  if (renderer) {
    renderer.plateURL = ''; // stop pending plate retries on a dead renderer
    try {
      renderer.dispose();
    } catch {
      /* context already gone */
    }
  }
  renderer = null;
  if (canvas) {
    canvas.remove();
    canvas = null;
  }
  ready = false;
  dirty = false;
  lastDrawn = 0;
  document.documentElement.removeAttribute('data-glass-chrome');
  for (const el of Array.from(drawSet)) untrackChrome(el);
}

/** Track a floating panel into the chrome draw set. data-glass-chrome (NOT
 *  data-glass-paint, whose CSS block transparents backgrounds on the MAIN
 *  plane's terms) + the same inline paint kill: the shader replaces the
 *  panel's filter, its DOM text/controls stay untouched. */
export function trackChrome(el: HTMLElement, kind: GlassKind, params: GlassPaintParams): void {
  paintCache.set(el, { kind, params });
  drawSet.add(el);
  dirty = true;
  if (el.dataset.glassChrome !== 'webgl') el.dataset.glassChrome = 'webgl';
  clearPaintKill(el);
  if (ready) applyPaintKill(el);
}

/** Untrack: back to the CSS material byte-for-byte (attr off, kill off). */
export function untrackChrome(el: HTMLElement): void {
  drawSet.delete(el);
  dirty = true;
  clearPaintKill(el);
  if (el.dataset.glassChrome) delete el.dataset.glassChrome;
}

/** Effective opacity INCLUDING fading wrappers (motion sets opacity on the
 *  animated node or its ancestors; the product up to the shell is the
 *  paint alpha) — same contract as the controller's effectiveAlpha for in-
 *  flow panels, walking to the shell instead of a controller-local cache. */
function effectiveAlpha(el: HTMLElement): number {
  let a = 1;
  let n: HTMLElement | null = el;
  let guard = 0;
  const shell = document.getElementById('app-teacher-shell');
  while (n && n !== shell && guard++ < 32) {
    const o = parseFloat(getComputedStyle(n).opacity);
    if (Number.isFinite(o) && o < 1) {
      a *= o;
      if (a < 0.01) return 0;
    }
    n = n.parentElement;
  }
  return a;
}

/** The floating gate: the panel the MAIN pass refused (fixed/sticky/
 *  absolute chain) becomes a chrome panel when its backdrop is provably
 *  unrestricted glass over the plate — no occluding ancestor paint, no
 *  clipped ancestor (smaller-downgrade-than-wrong-pixels, per the contract;
 *  a refused panel keeps today's CSS material). Dialogs are excluded by
 *  construction: a modal lens sits over the veil-blur field — its backdrop
 *  is not the plate and it already carries its own frost (M2c range). */
export function chromeEligible(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  const ownPos = cs.position;
  if (ownPos !== 'fixed' && ownPos !== 'sticky' && ownPos !== 'absolute') return false;
  if (el.closest('[role="dialog"], [role="alertdialog"]')) return false;
  const shell = document.getElementById('app-teacher-shell');
  let n = el.parentElement;
  while (n && n !== shell) {
    const acs = getComputedStyle(n);
    const p = acs.position;
    if (p !== 'fixed' && p !== 'sticky' && p !== 'absolute' && p !== 'relative') {
      // An in-flow static ancestor below a floating panel means the rect
      // is NOT viewport-stable (it scrolls) — the main pass owns it or the
      // panel is inside a portal; refuse rather than mis-anchor it.
      return false;
    }
    if (acs.overflowX !== 'visible' || acs.overflowY !== 'visible') return false;
    if (acs.backgroundImage !== 'none') return false;
    const bg = acs.backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) return false;
    n = n.parentElement;
  }
  return n === shell;
}

/** Resized flag for the ?perf=1 report (buffer dimensions last frame). */
export function chromeFrameSize(): [number, number] {
  return [lastFrameW, lastFrameH];
}
