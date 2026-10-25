/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Dim law — extracted verbatim from mapMath.ts (Meraj P0 size split): the
 * highlight-weighted wash + white-veil lift + feFunc table encoder.
 */

import type { LensParams } from './mapMath';

/** Dim law — Apple's highlight-weighted wash toward the tint.
 *
 *      out_ch = in_ch + b · (in_ch/255) · (tint_ch − in_ch)
 *
 *  The weight is the pixel's OWN value, so:
 *    · whites move the full distance toward the tint — "whites washed";
 *    · blacks never move (weight 0) — no grey floor, no plastic;
 *    · mid/dark tones are barely touched, and every channel moves toward
 *      the SAME tint, so relative channel structure (hue/saturation) is
 *      preserved — "colored glass dark tint", not a flat multiply (which
 *      crushed mids uniformly — the "plastic dark" reading).
 *
 *  b is clamped to [0, 0.5]: the curve is monotone non-decreasing exactly
 *  on that interval (at b=0.5, t=0 the top flattens; beyond it, highlights
 *  would invert). b=0 is exact identity.
 *
 *  The old affine law (toward mid-grey [103,100,112] with G/B boost ratios)
 *  LIFTED black (+10/+11/+16) — the putty floor this law removes. */
export function dimStrength(p: LensParams): number {
  return Math.max(0, Math.min(0.5, p.dim));
}

/** One channel of the wash, in 0..255 space. Pure, side-effect free. */
export function dimChannel(inp: number, b: number, tintCh: number, lift = 0): number {
  const x = Math.max(0, Math.min(255, inp));
  const t = Math.max(0, Math.min(255, tintCh));
  const k = Math.max(0, Math.min(0.5, b));
  const w = x + k * (x / 255) * (t - x);
  /* White-veil lift (dark theme): weight (1 − x/255)² on the INPUT value →
     lifts ONLY the deep darks (+L·255 ≈ 7.6/255 at black — the "very very
     subtle white tint" read), contributes EXACTLY zero at pure white (the
     wash's own domain), ~1.9/255 at mid. Composes with the wash
     monotonically: wash' ≥ 1 − x/255 and |veil'| ≤ 2L/255, so the sum stays
     non-decreasing across the clamped range (pinned). */
  const L = Math.max(0, Math.min(0.25, lift));
  if (L === 0) return w;
  const u = 1 - x / 255;
  return w + L * 255 * u * u;
}

/** feFunc tableValues for one channel: 33 samples (step 255/32), linear
 *  interpolation between them. Max interpolation error vs the exact curve
 *  is < 0.09/255 across the whole range (curvature bound b/4096 in
 *  normalized units) — two orders under the accepted 2/255 LSB tolerance —
 *  while costing ~600B of markup instead of 4KB for 256 exact samples. */
export function dimTableValues(b: number, tintCh: number, lift = 0): string {
  const n = 33;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push((dimChannel((255 * i) / (n - 1), b, tintCh, lift) / 255).toFixed(4));
  }
  return out.join(' ');
}
