/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * M1 chrome pass (attempt 2) — the floating glass panels (topbar pills,
 * menus, notifications) bend on the SAME shader as the big panels, via a
 * SECOND fixed canvas (#glass-chrome). WebKit drops url() inside
 * backdrop-filter (bug 245510) — the CSS fall-through can never serve the
 * chrome on the phone; the shader can, on every engine.
 *
 * Attempt 1 (b5413fa) broke the MENU RIMS by half-applying the material
 * divorce: its strip rule kept the DOM gradient fill and the inset
 * box-shadow rims over a shader that paints fill + specular arc + rim
 * itself — double rim, double fill. Attempt 2 adopts the MAIN plane's
 * exact recipe (base.css [data-glass-paint='webgl']): filter kill +
 * box-shadow none + background transparent + ::after none — the shader
 * paints the whole body, the DOM keeps only the box and its content.
 *
 * Plane geometry: the chrome canvas is fixed, z-29 — ABOVE the content
 * layer (z-10) and #glass-canvas (z-1), BELOW the chrome's own text and
 * controls (header z-30, dropdown containers z-60+). The shader frosts
 * FLOATING panels only.
 *
 * Stage 1: panels whose rect is viewport-stable shade from the PLATE
 * texture alone — menus open over calm plate most sessions; Stage 3 adds
 * the DOM-delta texture if the delta proves visible.
 *
 * The controller drives exactly three calls — bootChrome (after the main
 * renderer boots), tickChrome (from the shared rAF, self-gating),
 * shutdownChrome (main teardown or a chrome context loss). All panel
 * state lives here; the controller carries zero chrome state.
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
/** A plate load (setPlate chain) is in flight — tickChrome uses this to
 *  distinguish a stalled first load (re-kick) from a settled zero. */
let loading = false;
let lastKick = 0;

/** ?perf=1 snapshot — read through glassStats(). `boot: 'ok'` means the
 *  renderer EXISTS; `ready` means the plate texture landed and panels are
 *  actually drawn — the pair isolates a plate-load stall from a draw bug. */
export function chromeStats(): {
  drawn: number;
  boot: 'pending' | 'ok' | 'broken' | 'off';
  ready: boolean;
} {
  return {
    drawn: lastDrawn,
    boot: broken ? 'broken' : renderer ? 'ok' : CHROME_OFF ? 'off' : 'pending',
    ready,
  };
}

/** Chrome surface dump for the ?perf=1 report (attempt-4 dig): every
 *  tracked panel's live rect, content height (rect vs children — a 0-child
 *  height means the DOM text failed, not the shader), attr state, paint
 *  params, and the chrome plate/renderer state. Read-only. */
export function chromeDebug(): unknown {
  const panels: unknown[] = [];
  for (const el of drawSet) {
    const r = el.getBoundingClientRect();
    let childSum = 0;
    for (const c of el.children) {
      const cr = c.getBoundingClientRect();
      childSum += cr.height;
    }
    const cs = getComputedStyle(el);
    panels.push({
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      ownPos: cs.position,
      childH: Math.round(childSum),
      attr: el.dataset.glassChrome ?? null,
      kill: el.style.backdropFilter || null,
      kind: paintCache.get(el)?.kind ?? null,
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
      opacity: cs.opacity,
      anim: getComputedStyle(el).animationName,
    });
  }
  return {
    boot: broken ? 'broken' : renderer ? 'ok' : 'off',
    ready,
    hasPlate: renderer ? renderer.hasPlate : false,
    frame: [lastFrameW, lastFrameH],
    drawn: lastDrawn,
    panels,
  };
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
    if (url) loadPlate(url);
  } catch {
    // A chrome context must not take the main pass down: CSS owns the
    // chrome this session, byte-identical with the pre-M1 fallback.
    canvas?.remove();
    canvas = null;
    renderer = null;
    broken = true;
  }
}

/** One plate attempt with the idempotent retry chain. Tracks `loading` so
 *  tickChrome can re-kick a stalled first load without stacking loads. */
function loadPlate(url: string): void {
  const r = renderer;
  if (!r) return;
  loading = true;
  void r
    .setPlate(url)
    .catch(() => r.retryPlate(url))
    .finally(() => {
      loading = false;
    });
}

/** Theme flip and the stalled-first-load recovery both re-kick here. */
export function refreshChromePlate(): void {
  if (!renderer) return;
  const url = plateURLForTheme();
  if (!url) return;
  loadPlate(url);
}

/** Per-frame draw. Piggybacks the controller's rAF; early-outs cheaply
 *  when the chrome planes are at rest. The strip lands on the panel's
 *  FIRST SUCCESSFUL DRAW (attempt-2 lesson: stripping at track time left
 *  a naked frame while the plate loaded, and a stalled plate left panels
 *  flat + stripped forever — textless menus on desktop, fallback rims on
 *  the phone). A draw that stops succeeding rolls the panel back to its
 *  CSS material the same frame. */
export function tickChrome(): void {
  const r = renderer;
  if (!r || !canvas || !canvas.isConnected) return;
  if (!ready && r.hasPlate) {
    ready = true;
    document.documentElement.dataset.glassChrome = 'webgl';
    dirty = true;
  }
  if (!ready) {
    // Stalled-first-load recovery: re-kick every 2s while the main plate
    // is proven good and nothing is in flight.
    if (!loading && !r.hasPlate && performance.now() - lastKick > 2000) {
      lastKick = performance.now();
      const url = plateURLForTheme();
      if (url) loadPlate(url);
    }
    return;
  }

  const before = `${canvas.width}x${canvas.height}`;
  r.resizeFrame();
  const resized = before !== `${canvas.width}x${canvas.height}`;
  if (resized) dirty = true;
  if (!dirty && !chromeAlphaMoving()) return;
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
    const offscreen =
      rect.bottom < -M || rect.top > vh + M || rect.right < -M || rect.left > vw + M;
    if (offscreen || rect.width < 2 || rect.height < 2) {
      // Off-screen or collapsed mid-animation: park to CSS so a panel that
      // exits through a scale tween never freezes stripped.
      if (el.dataset.glassChrome === 'webgl') {
        el.dataset.glassChrome = 'pending';
        clearPaintKill(el);
      }
      continue;
    }
    let ok = false;
    try {
      r.drawPanel(
        entry.kind,
        // Floating rects are viewport-stable — no sync translate, no lead.
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        entry.params,
        effectiveAlpha(el),
      );
      ok = true;
    } catch {
      /* one bad geometry must not kill the loop */
    }
    if (ok) {
      drawn++;
      if (el.dataset.glassChrome !== 'webgl') {
        // FIRST successful draw of THIS panel: now the swap is safe — the
        // shader already owns the pixels under it this same frame.
        el.dataset.glassChrome = 'webgl';
        applyPaintKill(el);
      }
    } else if (el.dataset.glassChrome === 'webgl') {
      // The draw stopped succeeding (context dying, transient GL error):
      // roll the panel back to its CSS material immediately.
      el.dataset.glassChrome = 'pending';
      clearPaintKill(el);
    }
  }
  lastFrameW = canvas.width;
  lastFrameH = canvas.height;
  lastDrawn = drawn;
}

/** Chrome-panel alpha motion ONLY — deliberately NOT folded into the main
 *  canvas's idle gate: an open menu (grow/shrink tweens, fading pills)
 *  would keep the full-viewport main canvas repainting at 60Hz besides the
 *  chrome plane's own small draw (the attempt-2 desktop freeze-by-thrash). */
function chromeAlphaMoving(): boolean {
  if (drawSet.size === 0) return false;
  for (const el of drawSet) if (effectiveAlpha(el) < 0.999) return true;
  return false;
}

/** Tear the chrome plane down (main teardown or a chrome context loss).
 *  `lost` marks a context loss — permanent for the session; the MAIN pass
 *  is never touched from here. */
export function shutdownChrome(lost: boolean): void {
  if (lost) broken = true;
  if (renderer) {
    renderer.plateURL = '';
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
  loading = false;
  lastKick = 0;
  lastDrawn = 0;
  document.documentElement.removeAttribute('data-glass-chrome');
  for (const el of Array.from(drawSet)) untrackChrome(el);
}

/** Track a floating panel into the chrome draw set. The panel lands as
 *  'pending' — the material divorce lands ONLY on its first successful
 *  draw (see tickChrome): track-time stripping left a naked frame while
 *  the plate loaded and stranded flat panels when the plate stalled. */
export function trackChrome(el: HTMLElement, kind: GlassKind, params: GlassPaintParams): void {
  paintCache.set(el, { kind, params });
  drawSet.add(el);
  dirty = true;
  if (el.dataset.glassChrome !== 'webgl') el.dataset.glassChrome = 'pending';
  clearPaintKill(el); // a stale kill must not survive re-track
}

/** Untrack: back to the CSS material byte-for-byte (attr off, kill off). */
export function untrackChrome(el: HTMLElement): void {
  drawSet.delete(el);
  dirty = true;
  clearPaintKill(el);
  if (el.dataset.glassChrome) delete el.dataset.glassChrome;
}

/** Effective opacity INCLUDING fading wrappers — same contract as the
 *  controller's effectiveAlpha for in-flow panels, walking to the shell. */
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

/** The floating gate: a panel the MAIN pass refused becomes a chrome
 *  panel when its WHOLE ancestor chain to the shell is floating — the four
 *  menu panels are static children of the `fixed contain-menu` anchor
 *  (their rect is viewport-stable BECAUSE the anchor is), and the topbar
 *  pills ride `absolute` inside the sticky header. A static own-position
 *  is fine; a scrolled IN-FLOW ancestor is not (the rect moves with
 *  scroll). No occluding ancestor paint, no clipped ancestor. Dialogs are
 *  excluded by construction (their lens sits over the veil, not the
 *  plate). */
export function chromeEligible(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  const ownPos = cs.position;
  if (
    ownPos !== 'fixed' &&
    ownPos !== 'sticky' &&
    ownPos !== 'absolute' &&
    ownPos !== 'static'
  )
    return false;
  if (el.closest('[role="dialog"], [role="alertdialog"]')) return false;
  const shell = document.getElementById('app-teacher-shell');
  let n = el.parentElement;
  while (n && n !== shell) {
    const acs = getComputedStyle(n);
    const p = acs.position;
    if (p !== 'fixed' && p !== 'sticky' && p !== 'absolute' && p !== 'relative') {
      // An in-flow static ancestor below a floating panel means the rect
      // is NOT viewport-stable (it scrolls) — the main pass owns it.
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
