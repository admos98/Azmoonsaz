/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Display-time lead for the WebGL glass frame loop.
 *
 * THE PROBLEM: the glass canvas is position:fixed and painted from the main
 * thread's rAF loop, while the DOM above it scrolls on the compositor's own
 * clock. A rAF frame reads window.scrollY as the last main-thread-committed
 * value, paints the panels at that offset, and the compositor displays the
 * result one frame later — by which time it has already moved the DOM
 * further. The glass therefore trails the text by ~one interval of scroll
 * motion and catches up in steps: the reported "panels are a bit behind the
 * scroll / jelly" motion.
 *
 * MEASURED (screencast-lag decode, CDP gesture, 1280x900): with the lead OFF
 * the glass sits 60-98 px behind the display during motion — one interval's
 * delta. With the lead ON the residual centers on 0.
 *
 * THE FIX: paint every panel offset by `d1` — the scroll delta the previous
 * rAF interval actually produced. In steady motion that is exactly the
 * display advance, cancelling the trail; at rest it is 0 (byte-identical to
 * the legacy path); during acceleration it is the best one-interval estimate
 * and the next frame corrects the remainder. Clamped to a small cap so a
 * stale lead can never overshoot visibly.
 */
export function computeLeadPx(d1: number, cfg: number, maxDelta: number): number {
  // cfg: 0 = off, -1 = auto (predict one interval), N > 0 = N ms of the
  // current per-frame velocity.
  if (cfg === 0 || d1 === 0) return 0;
  // A programmatic jump (anchor, scrollTo, PageDown) is not a velocity
  // signal — predicting it would pop the glass for one frame.
  if (!Number.isFinite(maxDelta) || Math.abs(d1) >= maxDelta) return 0;
  const cap = Math.min(96, Math.abs(d1) * 2.5 + 4);
  const clamp = (v: number) => Math.max(-cap, Math.min(cap, v));
  if (cfg > 0) return clamp(d1 * Math.min(3, cfg / 16.7));
  // auto: one interval of observed motion, exactly.
  return clamp(d1);
}
