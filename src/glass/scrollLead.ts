/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Display-time lead for the WebGL glass frame loop — v2 (smoothed).
 *
 * THE PROBLEM (measured, twice): the glass canvas is position:fixed and
 * painted on the main thread's rAF cadence, while the DOM above it scrolls
 * on the compositor's own clock. A frame paints the panels at the scroll
 * value read at rAF time, but the compositor displays the result one
 * interval later — by which time it has already moved the DOM further. The
 * glass trails the text by one interval of motion (screencast decode:
 * 60-98px at the throttled-capture frame rate, exactly one interval's
 * delta) and catches up in steps. That is the reported "panels are late to
 * their location on scroll".
 *
 * WHY NOT v1: the first lead used the RAW per-frame delta (d1) as the
 * prediction. On real finger scrolls d1 changes every frame, so the painted
 * rim oscillated (±35px measured) — visible as border stutter, and it was
 * reverted. This version keeps the same lag cancellation but drives it
 * from an EMA of the scroll VELOCITY, so the offset is smooth by
 * construction: constant velocity → constant lead that exactly cancels the
 * one-interval trail; acceleration → the EMA lags gracefully (bounded
 * error, no oscillation); rest → the velocity decays to zero and the lead
 * is EXACTLY 0 (byte-identical idle output).
 *
 * Stateful by necessity (velocity is a function of history); the class is
 * pure — time and scroll are injected, so it is fully unit-testable.
 */
export class ScrollLead {
  private vEma = 0; // EMA of scroll velocity, px/ms (sign = scroll direction)
  private lastY = 0;
  private lastT = 0;
  private primed = false;

  /** Feed one rAF sample; returns the lead in CSS px.
   *  Positive = the view is scrolling down, so the glass must be drawn
   *  `lead` px HIGHER (the caller subtracts it from rect.top).
   *  cfg: 0 = off, -1 = auto (one measured interval), N > 0 = lead N ms. */
  update(y: number, t: number, cfg: number, maxDelta: number): number {
    if (cfg === 0) return 0;
    if (!this.primed) {
      this.lastY = y;
      this.lastT = t;
      this.primed = true;
      return 0;
    }
    const dt = Math.max(1, Math.min(64, t - this.lastT));
    const dy = y - this.lastY;
    this.lastY = y;
    this.lastT = t;

    // A programmatic jump (anchor, scrollTo, PageDown) is not a velocity —
    // reset the estimate so the next frames start from the new position.
    if (!Number.isFinite(maxDelta) || Math.abs(dy) >= maxDelta) {
      this.vEma = 0;
      return 0;
    }

    // EMA with tau ≈ 96ms: ~6 frames at 60Hz. Long enough to smooth the
    // per-frame quantization of real scrolls, short enough that a stop or
    // reversal is caught within ~100ms (during which the residual lead is
    // bounded by the cap below).
    const tau = 96;
    const alpha = dt / (tau + dt);
    this.vEma = this.vEma * (1 - alpha) + (dy / dt) * alpha;
    // Rest snap: below one tenth of a px per frame the lead is invisible
    // and snapping keeps idle output EXACTLY byte-identical.
    if (Math.abs(this.vEma) < 0.006) this.vEma = 0;

    const interval = cfg > 0 ? cfg : dt; // one measured display interval
    const cap = Math.min(96, Math.abs(dy) * 2.5 + 4);
    const raw = this.vEma * interval;
    return Math.max(-cap, Math.min(cap, raw));
  }

  /** A config change (A/B harness, URL escape hatch) invalidates history. */
  reset(): void {
    this.vEma = 0;
    this.primed = false;
  }
}
