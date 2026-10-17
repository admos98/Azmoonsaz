/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Display-time lead — the glass canvas must paint the frame the compositor
 * is ABOUT to display, not the one the main thread last observed.
 *
 * Contract (mechanism in src/glass/scrollLead.ts):
 *  1. At rest (d1 = 0) the lead is EXACTLY 0 — idle output is byte-identical
 *     to the legacy path (zero visual loss by construction).
 *  2. Steady motion leads by one interval (d1) — cancels the measured 60-98px
 *     trailing offset; this is the shipped behavior.
 *  3. The lead is capped at min(96, |d1| * 2.5 + 4) px — a stale/wrong lead
 *     is small and the next frame corrects it.
 *  4. A programmatic jump (|d1| >= maxDelta) predicts nothing.
 *  5. Fixed-time cfg (N ms) leads by N/16.7 of the per-interval delta, capped.
 */
import { describe, it, expect } from 'vitest';
import { computeLeadPx } from '../../glass/scrollLead';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';

describe('display-time lead (scroll lag compensation)', () => {
  it('is exactly zero at rest — idle output stays byte-identical', () => {
    expect(computeLeadPx(0, -1, 600)).toBe(0);
  });

  it('leads by exactly one interval of motion (the measured trail)', () => {
    // The screencast A/B measured the glass 60-98px behind the display with
    // the lead off — one interval's delta. The auto lead returns d1 itself.
    expect(computeLeadPx(60, -1, 600)).toBe(60);
    expect(computeLeadPx(-7, -1, 600)).toBe(-7);
    expect(computeLeadPx(12, -1, 600)).toBe(12);
  });

  it('caps the lead so a stale prediction stays small', () => {
    // cap = min(96, |d1| * 2.5 + 4); d1=100 -> 96
    expect(computeLeadPx(100, -1, 600)).toBe(96);
    // d1=30 -> cap 79, but auto returns 30 (under the cap)
    expect(computeLeadPx(30, -1, 600)).toBe(30);
  });

  it('predicts nothing across a programmatic jump', () => {
    expect(computeLeadPx(800, -1, 600)).toBe(0);
    expect(computeLeadPx(-1200, -1, 600)).toBe(0);
    expect(computeLeadPx(50, -1, NaN)).toBe(0);
    expect(computeLeadPx(600, -1, 600)).toBe(0); // boundary: >= is a jump
  });

  it('supports fixed-time lead (N ms) and full disable', () => {
    expect(computeLeadPx(10, 16.7, 600)).toBe(10); // 1 frame
    expect(computeLeadPx(10, 33.4, 600)).toBe(20); // 2 frames
    expect(computeLeadPx(30, 50, 600)).toBe(79); // 3 frames, capped at |d1|*2.5+4
    expect(computeLeadPx(10, 0, 600)).toBe(0); // disabled
  });

  it('the controller wires the lead into the panel draw and defaults to auto', () => {
    const controller = readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8');
    expect(controller).toContain("from './scrollLead'");
    expect(controller).toContain('computeLeadPx(');
    // The offset is applied to the drawn panel top, not the cull bounds.
    expect(controller).toMatch(/top:\s*rect\.top\s*\+\s*leadOff/);
    // Escape hatch stays: ?laglead=0 disables, window.__glassLead wins.
    expect(controller).toContain('laglead');
    expect(controller).toContain('__glassLead');
    // Default is auto (-1), not off.
    expect(controller).toMatch(/leadParam\s*\?\?\s*-1/);
  });
});
