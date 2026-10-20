/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Panel-drift diagnostics for the liquid-glass engine — extracted from
 * glassController.ts verbatim. The ?perf=1 payload's drift waveform: reads
 * window scroll directly, owns no engine state.
 */

/* ── Panel-drift diagnostics (the ?perf=1 payload) ────────────────────────
   The reported symptom: "panels fall behind the scroll and slide/bounce".
   Root question: between two glass paints, how far did the COMPOSITOR move
   the page? That gap IS the visual lag of the panels, in CSS px:
     · dispDrift = the scroll delta the paint loop observed this frame
       (compositor movement between paint N-1 and N) — nonzero while
       scrolling, ±0 at rest (its sign flips with direction, magnitude =
       how many px the panels were behind at paint time);
     · sincePaint = |scrollY - lastPaintedScrollY| measured AT PAINT time —
       how stale the painted position was when the frame drew;
     · maxStale = the worst sincePaint of the whole recording (the number
       that reads as "the glass was N px behind the text at its worst");
     · a 32-slot ring of the last frames (drift, sincePaint, dt) so a bounce
       or slide-back is visible as a waveform, not a guess. */
const drift = {
  ring: [] as Array<[number, number, number]>, // [driftPx, sincePaintPx, dtMs]
  ringN: 0,
  lastScrollY: 0,
  lastPaintY: 0,
  maxStale: 0,
  staleSum: 0,
  staleFrames: 0,
};
export function driftSample(scrollY: number, now: number, dt: number): void {
  const d = scrollY - drift.lastScrollY;
  // stale = CONTENT freshness bound: how far the page moved since the last
  // PAINT while that paint's pixels are still displayed. Since the compositor
  // scroll-sync landed, the canvas BOX tracks the DOM exactly at display
  // time (translate = painted − live); this number is what is left of the
  // visual error — the internal backdrop sample's staleness — and it goes to
  // 0 on the next paint and to 0 at rest.
  const stale = Math.abs(scrollY - drift.lastPaintY);
  drift.lastScrollY = scrollY;
  drift.ring[drift.ringN & 31] = [Math.round(d * 10) / 10, Math.round(stale * 10) / 10, Math.round(dt * 10) / 10];
  drift.ringN++;
  if (stale > drift.maxStale) drift.maxStale = stale;
  if (stale > 0.5) {
    drift.staleSum += stale;
    drift.staleFrames++;
  }
}
/** Reset + read the drift block for the perf report (live view of the ring). */
export function glassDriftStats(): {
  ring: Array<[number, number, number]>;
  maxStale: number;
  meanStale: number;
  staleFrames: number;
} {
  const n = Math.min(drift.ringN, 32);
  const out: Array<[number, number, number]> = [];
  for (let i = Math.max(0, drift.ringN - 32); i < drift.ringN; i++) {
    out.push(drift.ring[i & 31]);
  }
  return {
    ring: out.slice(Math.max(0, out.length - n)),
    maxStale: Math.round(drift.maxStale * 10) / 10,
    meanStale: drift.staleFrames ? Math.round((drift.staleSum / drift.staleFrames) * 10) / 10 : 0,
    staleFrames: drift.staleFrames,
  };
}
export function resetGlassDrift(): void {
  drift.ringN = 0;
  drift.maxStale = 0;
  drift.staleSum = 0;
  drift.staleFrames = 0;
  // Seed from the CURRENT scroll position: zeroing it makes the first
  // sample report the whole document offset as one giant "stale" step.
  drift.lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  drift.lastPaintY = drift.lastScrollY;
}

/** Re-home the paint-time anchor when the engine records a paint at yNow. */
export function driftMarkPaint(yNow: number): void {
  drift.lastPaintY = yNow;
}
