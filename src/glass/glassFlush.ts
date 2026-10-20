/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Two-phase flush — extracted verbatim from glassController.ts. PHASE A
 * reads every panel's box and computed style with ZERO writes in between
 * (one forced layout for the whole batch); PHASE B dresses cache hits
 * inline and hands misses to the map worker (glassSyncQueue). Engine
 * state reaches the flush through the FlushHost bound at mount — data
 * flows DOWN, no cycles.
 */
import { chainOf, glassAllowed } from './glassChain';
import { cssNum, isNestedGlass, kindOf, radiusOf, readParams } from './glassTokens';
import {
  paramsForWebgl,
  tierAllowsGlass,
  trackWebgl,
  untrackWebgl,
  webglKindOf,
  webglPlaceable,
} from './glassPipeline';
import { commit } from './glassSyncQueue';
import type { GlassKind, GlassPaintParams } from './webglRenderer';

/** Host-bridge into the engine's live state. Bound once at mount. */
export interface FlushHost {
  /** False until mountGlassEngine runs — no flush work before it. */
  isMounted(): boolean;
  /** Track set — written here, pruned by the engine. */
  tracked: Set<HTMLElement>;
  /** Path decision stored back for parkOffscreen / IO callbacks. */
  setRenderMode(mode: 'webgl' | 'css'): void;
  /** WebGL boot state. */
  webglSupported(): boolean;
  webglBroken(): boolean;
  getGlCanvas(): HTMLCanvasElement | null;
  tryInitWebgl(): void;
  /** Dress helpers the flush shares with the engine body. */
  undressNested(el: HTMLElement): void;
  parkOffscreen(el: HTMLElement): void;
  isInExtendedViewport(el: HTMLElement): boolean;
  pruneDead(): void;
}

let host: FlushHost | null = null;

/** Bind the engine state. Idempotent. */
export function bindFlush(h: FlushHost): void {
  host = h;
}

const pendingSync = new Set<HTMLElement>();
let flushQueued = false;

interface PendingPanel {
  el: HTMLElement;
  kind: 'lens' | 'pane' | 'drop';
  w: number;
  h: number;
  radius: number;
  p: import('./lensEngine').LensParams;
  chainBase: string;
  withDim: boolean;
  quickKey: string;
}

/** Enqueue one panel. Deduped by element, coalesced to a single rAF. */
export function queueSync(el: HTMLElement): void {
  if (!host?.isMounted()) return;
  host.tracked.add(el);
  if (!el.isConnected) return;
  pendingSync.add(el);
  scheduleFlush();
}

/** Drop every pending flush entry (engine teardown). */
export function clearPendingSync(): void {
  pendingSync.clear();
}

/** Schedule a flush without enqueueing a panel (prune-only paths). */
export function requestFlush(): void {
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(flushSync);
}

/**
 * Two-phase flush — the fix for the layout thrash.
 *
 *   PHASE A reads every panel's box and computed style with ZERO writes in
 *   between, so the whole batch costs ONE forced layout instead of one per
 *   panel — except nested panels, which are undressed here (a guarded style
 *   clear, no layout) before any measurement. Panels whose quickKey is
 *   unchanged are dropped here, so a mutation touching one panel never
 *   re-measures the other 32.
 *
 *   PHASE B dresses cache hits inline (string ops, sub-frame). Cache misses
 *   post to the map worker and return — zero map math on this thread.
 */
function flushSync(): void {
  flushQueued = false;
  if (!host?.isMounted()) return;
  const tracked = host.tracked;

  // Path choice, resolved fresh every flush: WebGL2 + full glass tier = the
  // shader path; anything else = the CSS path below, untouched. renderMode
  // is what parkOffscreen / IO callbacks test between flushes.
  const wantWebgl = tierAllowsGlass() && host.webglSupported() && !host.webglBroken();
  if (wantWebgl && !host.getGlCanvas()) host.tryInitWebgl();
  const useWebgl = wantWebgl && host.getGlCanvas() !== null;
  host.setRenderMode(useWebgl ? 'webgl' : 'css');

  if (!useWebgl && !glassAllowed()) {
    pendingSync.clear();
    return;
  }

  const batch = Array.from(pendingSync);
  pendingSync.clear();

  /* PHASE A — READ ONLY */
  const todo: PendingPanel[] = [];
  const glTodo: { el: HTMLElement; kind: GlassKind; params: GlassPaintParams }[] = [];
  for (const el of batch) {
    if (!el.isConnected) {
      tracked.delete(el);
      continue;
    }
    const kind = kindOf(el);
    if (!kind) continue;
    // Nested glass samples only the parent's flat fill — the bend is
    // invisible there, so never dress or draw it. Strip any stale inline
    // chain first: inline style beats the stylesheet de-nest rule, so a
    // panel that BECAME nested (DOM move) would otherwise keep burning a
    // filter forever. Checked BEFORE getComputedStyle: a DOM walk, zero
    // forced layout.
    if (isNestedGlass(el)) {
      host.undressNested(el);
      continue;
    }
    if (useWebgl) {
      // WebGL branch — the panel is tracked into the per-frame draw list
      // (reads only here; DOM writes happen in PHASE B). Panels the shader
      // cannot serve fall THROUGH to the classic CSS dress path instead:
      // floating/sticky/absolute panels, fields, clipped or painted-over
      // backdrops. glx/glx-strong ARE shader candidates now (webglKindOf):
      // their Skia url() graph was the dominant scroll cost on dense pages;
      // the shader runs the same chain (they shed exactly the layers lens
      // already sheds on this path). On engines below the url() gate they
      // skip that too and keep the pure stylesheet material — unchanged.
      const wk = webglKindOf(el);
      const cs = getComputedStyle(el);
      if (wk && webglPlaceable(el, cs)) {
        glTodo.push({ el, kind: wk, params: paramsForWebgl(el, cs) });
        continue;
      }
      // Not shader-served: hand it back to the CSS path BEFORE the offscreen
      // gate below, so a formerly-drawn panel (DOM move, class swap) parks
      // and re-dresses exactly like any other CSS panel. Attribute/style
      // clears are layout-free.
      if (el.dataset.glassPaint) untrackWebgl(el);
      if (!glassAllowed()) continue;
      // NOTE (2026-10-18): a cull lived here that kept non-placeable panels
      // on plain blur with NO url() graph. It removed their bend + specular
      // rim (user: "the menu panels and the questions big panel lose their
      // rim and bend") — the actual still-frame cost was the perpetual
      // pulse animation, which is gone. Fall-through restored: these panels
      // dress through the engine like every other CSS panel.
    }
    // Lever A: offscreen panels park on blur-only. Checked BEFORE
    // getComputedStyle so an offscreen panel costs one rect (same layout
    // pass as the box read below), never a style resolve + worker build.
    // parkOffscreen is a guarded style clear — no layout.
    if (!host.isInExtendedViewport(el)) {
      host.parkOffscreen(el);
      continue;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w < 2 || h < 2) continue;
    const cs = getComputedStyle(el);
    const p = readParams();
    const radius = radiusOf(el, cs, cssNum(cs, '--lens-radius', 21));
    const chainBase = chainOf(el, cs);
    const withDim = kind !== 'drop' && p.dim > 0;
    const quickKey = `${kind}|${w}x${h}|${Math.round(radius)}|${withDim ? 1 : 0}|${p.specOpacity}|${p.specSaturation}|${p.dim.toFixed(3)}|${(p.dimLift ?? 0).toFixed(3)}`;
    if (el.dataset.lastQuickKey === quickKey) continue;
    todo.push({ el, kind, w, h, radius, p, chainBase, withDim, quickKey });
  }

  /* PHASE B — WRITE. */
  if (useWebgl) {
    for (const t of glTodo) trackWebgl(t.el, t.kind, t.params);
  }
  // Runs in BOTH modes: the pure-CSS path, and WebGL fall-through panels
  // (glx*/floating) which keep the engine's maps + filter graphs. Cache
  // hits dress inline (string ops, sub-frame); misses post to the map
  // worker and return — zero map math on this thread.
  for (const t of todo) {
    try {
      commit(t);
    } catch {
      /* keep the plain CSS chain */
    }
  }

  host.pruneDead();
}

/** Drop filters whose panels unmounted. Iterates OUR Set, never the DOM tree. */
