/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * The dim law — numeric contract (Apple dim: multiplicative, black-preserving).
 *
 * The old playground law was AFFINE toward mid-grey [103,100,112]:
 *   out = in * (1 - b·k) + b·k·tint/255
 * which on black input produced +10/+11/+16 (R/G/B) — an additive grey floor.
 * That floor is the "dim plastic" reading: dark glass washed toward putty.
 *
 * The law is now a pure per-channel SCALE toward the dim tint:
 *   slope_ch = 1 - b·(1 - tint_ch/255),  intercept = 0
 * so black stays black, highlights come down, and the tint's channel
 * differences (its "coolness") decide the cast. These tests pin the numbers
 * so a regression to the affine form fails here instead of shipping.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';
import { dimParams } from '../../glass/mapMath';
import type { LensParams } from '../../glass/lensEngine';

const P = (dim: number, tint: [number, number, number]): LensParams =>
  ({ dim, dimTint: tint }) as LensParams;

/** Apply the returned [slope, intercept] pairs to an RGB triple. */
function apply(rgb: [number, number, number], b: number, tint: [number, number, number]) {
  const [r, g, bl] = dimParams(P(b, tint));
  return [rgb[0] * r[0] + r[1], rgb[1] * g[0] + g[1], rgb[2] * bl[0] + bl[1]];
}

describe('dim law — multiplicative, black-preserving (Apple dim)', () => {
  it('black stays black at any strength (the old law LIFTED it +10/+11/+16)', () => {
    // Old affine law on black with tint [103,100,112] at b=0.1:
    //   +10.30, +10.95, +16.53 → the additive putty floor. The new law: 0.
    for (const b of [0.07, 0.1, 0.2, 0.55]) {
      const [r, g, bl] = apply([0, 0, 0], b, [31, 29, 41]);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(bl).toBe(0);
    }
  });

  it('is a pure scale: intercept is exactly 0 for every channel', () => {
    for (const [, i] of dimParams(P(0.1, [31, 29, 41]))) expect(i).toBe(0);
    for (const [, i] of dimParams(P(0.55, [103, 100, 112]))) expect(i).toBe(0);
  });

  it('darkens toward the tint: channel slope = 1 - b*(1 - tint/255)', () => {
    const [r, g, bl] = dimParams(P(0.1, [31, 29, 41]));
    // R: 1 - 0.1*(1 - 31/255)  = 0.912156...
    expect(r[0]).toBeCloseTo(1 - 0.1 * (1 - 31 / 255), 6);
    // G: tint 29 (cooler) comes down harder
    expect(g[0]).toBeCloseTo(1 - 0.1 * (1 - 29 / 255), 6);
    // B: tint 41 → the least reduction of the three (blue survives → tinted)
    expect(bl[0]).toBeCloseTo(1 - 0.1 * (1 - 41 / 255), 6);
    expect(bl[0]).toBeGreaterThan(r[0]);
    expect(r[0]).toBeGreaterThan(g[0]);
  });

  it('identity when off: b=0 or white tint -> slope 1, intercept 0', () => {
    const off = dimParams(P(0, [31, 29, 41]));
    for (const [s, i] of off) {
      expect(s).toBe(1);
      expect(i).toBe(0);
    }
    const white = dimParams(P(0.2, [255, 255, 255]));
    for (const [s, i] of white) {
      expect(s).toBe(1);
      expect(i).toBe(0);
    }
  });

  it('b is clamped to [0,1] and mid-grey lands below input on every channel', () => {
    const [r, g, bl] = dimParams(P(2, [31, 29, 41]));
    // b clamps to 1: slope = tint/255 (darkest possible without going black)
    expect(r[0]).toBeCloseTo(31 / 255, 6);
    expect(g[0]).toBeCloseTo(29 / 255, 6);
    expect(bl[0]).toBeCloseTo(41 / 255, 6);
    const mid = apply([128, 128, 128], 0.1, [31, 29, 41]);
    expect(mid[0]).toBeLessThan(128);
    expect(mid[1]).toBeLessThan(128);
    expect(mid[2]).toBeLessThan(128);
  });

  it('the engine consumes dimParams on both paint paths (CSS chain + shader)', () => {
    // CSS path: buildFilterMarkup emits the slope/intercept pairs.
    const lensEngine = readFileSync(join(root, 'src/glass/lensEngine.ts'), 'utf8');
    expect(lensEngine).toMatch(/dimParams\(p\)/);
    // WebGL path: the shader multiplies by the same slopes.
    const renderer = readFileSync(join(root, 'src/glass/webglRenderer.ts'), 'utf8');
    expect(renderer).toMatch(/col \*= vec3\(u_dimR, u_dimG, u_dimB\)/);
    // regression guard: the affine icept form must not return
    expect(renderer).not.toMatch(/1\.0526|1\.4737/);
    expect(readFileSync(join(root, 'src/glass/mapMath.ts'), 'utf8')).not.toMatch(/1\.0526|1\.4737/);
    // both dim bases agree per theme (filter law + lite/off fill)
    const themes = readFileSync(join(root, 'src/styles/themes.css'), 'utf8');
    expect(themes).toMatch(/--dim-tint: 31 29 41/);
    expect(themes).toMatch(/--glass-dim-tint: 31 29 41/);
  });
});
