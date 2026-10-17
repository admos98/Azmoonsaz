/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * The dim law — numeric contract (Apple's highlight-weighted wash).
 *
 *      out_ch = in_ch + b · (in_ch/255) · (tint_ch − in_ch)
 *
 * Weight = the pixel's OWN value:
 *   · whites move the full distance toward the tint ("whites washed");
 *   · blacks never move (weight 0) — the old affine law LIFTED black by
 *     +10/+11/+16 (the putty floor) and the first multiplicative law
 *     crushed mids uniformly ("plastic dark"); both regressions must fail
 *     here instead of shipping;
 *   · every channel converges on ONE tint → hue/saturation structure is
 *     preserved: dark TINTED glass.
 *
 * Monotone non-decreasing exactly on b ∈ [0, 0.5] — pinned by test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';
import { dimChannel, dimStrength, dimTableValues } from '../../glass/mapMath';
import type { LensParams } from '../../glass/lensEngine';

const P = (dim: number, tint: [number, number, number]): LensParams =>
  ({ dim, dimTint: tint }) as LensParams;

describe('dim law — highlight-weighted wash toward the tint', () => {
  it('black never moves at any strength (no grey floor, no lift)', () => {
    // Old affine law on black with tint [103,100,112] at b=0.1 produced
    // +10.30/+10.95/+16.53 — the additive putty floor. The wash: 0.
    for (const b of [0.05, 0.12, 0.14, 0.32, 0.35, 0.5]) {
      for (const t of [0, 31, 33, 103, 255]) {
        expect(dimChannel(0, b, t)).toBe(0);
      }
    }
  });

  it('whites wash the full distance toward the tint (the readability lever)', () => {
    // "whites washed": at b=0.35, white heads for the tint and lands far
    // from 255 — 255 → 255 + 0.35·1·(33 − 255) ≈ 177.3 for light slate.
    expect(dimChannel(255, 0.35, 33)).toBeCloseTo(255 + 0.35 * (33 - 255), 6);
    // dark glass navy target: 255 → ~178 (tinted dark, not pitch black)
    expect(dimChannel(255, 0.32, 20)).toBeCloseTo(255 + 0.32 * (20 - 255), 6);
    // and the wash is monotone in b: deeper dim, lower whites
    const at = (b: number) => dimChannel(255, b, 33);
    expect(at(0)).toBe(255);
    expect(at(0.12)).toBeLessThan(at(0.05));
    expect(at(0.35)).toBeLessThan(at(0.12));
  });

  it('mids barely move — no uniform crush (the flat-multiply regression)', () => {
    // Flat multiply at b=0.35 (t=33): slope = 1 − 0.35·(1−33/255) = 0.695 —
    // a 128 backdrop would land at ~89. The wash:
    // 128 + 0.35·(128/255)·(33−128) ≈ 111.3 — a gentle step, not a crush.
    const mid = dimChannel(128, 0.35, 33);
    expect(mid).toBeCloseTo(128 + 0.35 * (128 / 255) * (33 - 128), 6);
    expect(mid).toBeGreaterThan(100); // ≥ ~10 points above the flat multiply
    // quarter-tones move even less than mids
    const quarter = dimChannel(64, 0.35, 33);
    expect(64 - quarter).toBeLessThan(128 - mid);
  });

  it('hue structure survives: all channels converge on ONE tint', () => {
    // Pure blue stays blue-dominant; pure red stays red; saturation falls
    // smoothly toward the tint, never to grey-by-luma like a desaturate.
    const t: [number, number, number] = [31, 29, 41];
    const wash = (c: [number, number, number]) =>
      c.map((v, i) => dimChannel(v, 0.35, t[i])) as [number, number, number];
    const blue = wash([0, 0, 255]);
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(blue[2]).toBeGreaterThan(blue[1]);
    const red = wash([255, 0, 0]);
    expect(red[0]).toBeGreaterThan(red[1]);
    expect(red[0]).toBeGreaterThan(red[2]);
    // the tint's own channel order survives on white: B > R > G (slate)
    const white = wash([255, 255, 255]);
    expect(white[2]).toBeGreaterThan(white[0]);
    expect(white[0]).toBeGreaterThan(white[1]);
  });

  it('identity at b=0; b clamps to [0, 0.5] (monotone-safe interval)', () => {
    for (const x of [0, 64, 128, 255]) expect(dimChannel(x, 0, 31)).toBe(x);
    expect(dimStrength(P(0.9, [31, 29, 41]))).toBe(0.5);
    expect(dimStrength(P(-1, [31, 29, 41]))).toBe(0);
    // beyond 0.5 highlights would invert; the clamp is the contract
    expect(dimChannel(255, 2, 0)).toBe(dimChannel(255, 0.5, 0));
  });

  it('is monotone non-decreasing on the whole clamped range (t=0, b=0.5)', () => {
    let prev = -1;
    for (let x = 0; x <= 255; x++) {
      const y = dimChannel(x, 0.5, 0);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
  });

  it('dimTableValues: 33 samples, 0..1 range, endpoints exact', () => {
    const vals = dimTableValues(0.35, 33)
      .split(' ')
      .map((v) => parseFloat(v));
    expect(vals).toHaveLength(33);
    expect(vals[0]).toBe(0);
    expect(vals[32]).toBeCloseTo(dimChannel(255, 0.35, 33) / 255, 4);
    // interpolation error vs the exact curve stays < 0.5/255 (0.0005 unit)
    for (let i = 0; i <= 255; i += 7) {
      const pos = (i / 255) * 32;
      const lo = Math.floor(pos);
      const hi = Math.min(32, lo + 1);
      const frac = pos - lo;
      const interp = vals[lo] * (1 - frac) + vals[hi] * frac;
      expect(Math.abs(interp - dimChannel(i, 0.35, 33) / 255)).toBeLessThan(0.0005);
    }
  });

  it('both paint paths consume the SAME law (CSS chain + shader)', () => {
    const lensEngine = readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8');
    expect(lensEngine).toMatch(/dimTableValues\(/);
    const renderer = readFileSync(join(root, 'src/glass/webglRenderer.ts'), 'utf8');
    // the shader's wash matches dimChannel exactly
    expect(renderer).toMatch(
      /col = col \+ u_dim \* col \* \(vec3\(u_dimTr, u_dimTg, u_dimTb\) \/ 255\.0 - col\)/,
    );
    // regression guards: neither the affine boost ratios nor the flat
    // multiply may return
    expect(renderer).not.toMatch(/1\.0526|1\.4737/);
    expect(renderer).not.toMatch(/col \*= vec3\(u_dim/);
    expect(readFileSync(join(root, 'src/glass/mapMath.ts'), 'utf8')).not.toMatch(/1\.0526|1\.4737/);
    // both dim bases agree per theme (wash target + lite/off fill)
    const themes = readFileSync(join(root, 'src/styles/themes.css'), 'utf8');
    expect(themes).toMatch(/--dim-tint: 31 29 41/);
    expect(themes).toMatch(/--glass-dim-tint: 31 29 41/);
    expect(themes).toMatch(/--dim-tint: 16 15 28/);
    expect(themes).toMatch(/--glass-dim-tint: 16 15 28/);
  });
});
