/**
 * useEdgeLight — pointer tracking for the glass rim.
 *
 * ONE listener for the whole app, delegated. 269 surfaces carry `.glx`, and a
 * pointermove listener on each would be absurd; instead a single document-level
 * listener finds whichever `.glass-edge` is under the pointer and writes three
 * custom properties on that element and no other.
 *
 *   --eg-x      pointer position across the panel, in %
 *   --eg-y      pointer position down the panel, in %
 *   --eg-boost  0 when the pointer is away, easing to 1 as it nears the panel
 *
 * The rim geometry, thickness and per-theme weighting all live in CSS
 * (`.glass-edge` in src/index.css). Keeping this to three numbers is what lets
 * one mechanism serve every panel size and both themes: the CSS decides what a
 * given boost is worth, this only reports where the light is.
 *
 * Three things this deliberately does NOT do:
 *
 * 1. No re-render, and no React state. Only custom properties are written, so
 *    pointer movement never re-runs React.
 * 2. No per-element listeners. One passive listener, rAF-throttled.
 * 3. No opacity animation on a backdrop-filter element. `.glx` and
 *    `.glx-strong` carry `backdrop-filter`; animating opacity on one freezes
 *    its filtered frame, and that frozen frame survives unmount as a ghost left
 *    on screen. The rim is a separate `::before` layer precisely so the
 *    filtered element is never touched.
 */
import { useEffect } from 'react';

const RIM = '.glass-edge';
/**
 * Opt-in marker for the pointer sheen. D5: the sheen is for FLOATING CHROME
 * only — the hero, topbar buttons, menu panels, modals, sheets and toasts.
 * It is deliberately NOT the default, because `.glass-edge` is on all 292
 * panels and a cursor-reactive edge on an in-page card turns the whole page
 * into a light-up-the-grid toy. Ordinary panels keep the resting rim, which is
 * the part that makes them read as glass; they do not track the pointer.
 */
const SHEEN = '[data-glass-sheen]';

/** Pointer jitter under this distance (px) reuses the last position, so a
 *  still mouse cannot make the rim micro-jitter. */
const EPSILON = 0.5;

/** Panel half-diagonal, as a fraction, at which the rim counts as lit. Below
 *  NEAR it is fully lit (pointer inside or nearly); by REACH it is fully dark.
 *  Approaching a card from a distance therefore feels like light moving onto
 *  it rather than a switch flipping on. */
const NEAR = 0.7;
const REACH = 1.1;

/** Easing per frame toward the target boost. Low enough that the rim arrives
 *  and leaves like light. Frame-rate dependent, which is acceptable for a
 *  decorative highlight. */
const EASE = 0.18;

export function useEdgeLight(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let lit: HTMLElement | null = null;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    let boost = 0;
    let target = 0;

    const relight = (panel: HTMLElement | null, x: number, y: number) => {
      if (panel !== lit) {
        // Drop the previous panel to rest immediately — a rim left lit behind
        // the pointer would read as a stuck hover.
        lit?.style.setProperty('--eg-boost', '0');
        lit = panel;
        boost = 0;
        lastX = Number.NaN;
      }
      if (!lit) return;
      const rect = lit.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      lit.style.setProperty('--eg-x', `${((x - rect.left) / rect.width) * 100}%`);
      lit.style.setProperty('--eg-y', `${((y - rect.top) / rect.height) * 100}%`);
      const d = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      const half = Math.hypot(rect.width, rect.height) / 2 || 1;
      target = Math.max(0, Math.min(1, 1 - (d / half - NEAR) / (REACH - NEAR)));
      if (!frame) frame = requestAnimationFrame(step);
    };

    function step() {
      frame = 0;
      if (!lit) return;
      if (Math.abs(target - boost) < 0.01) {
        if (boost !== target) {
          boost = target;
          lit.style.setProperty('--eg-boost', String(boost));
        }
        return;
      }
      boost += (target - boost) * EASE;
      lit.style.setProperty('--eg-boost', boost.toFixed(3));
      frame = requestAnimationFrame(step);
    }

    const onMove = (e: PointerEvent) => {
      // Touch and pen have no hover; a rim that lights under a finger reads as
      // a stuck state, so only mouse drives it.
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const { clientX: x, clientY: y } = e;
      if (
        Number.isFinite(lastX) &&
        Math.abs(x - lastX) < EPSILON &&
        Math.abs(y - lastY) < EPSILON
      ) {
        return;
      }
      lastX = x;
      lastY = y;
      relight(
        document.elementFromPoint(x, y)?.closest<HTMLElement>(RIM + SHEEN) ?? null,
        x,
        y,
      );
    };

    const rest = () => {
      target = 0;
      if (lit && !frame) frame = requestAnimationFrame(step);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', rest, { passive: true });
    window.addEventListener('blur', rest);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', rest);
      window.removeEventListener('blur', rest);
      if (frame) cancelAnimationFrame(frame);
      lit?.style.removeProperty('--eg-boost');
    };
  }, [enabled]);
}
