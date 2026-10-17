/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Display-time lead — the glass canvas must paint the frame the compositor
 * is ABOUT to display, not the one the main thread last observed.
 *
 * Contract (mechanism in src/glass/scrollLead.ts):
 *  1. At rest the lead is EXACTLY 0 — idle output byte-identical to the
 *     legacy path (zero visual loss by construction).
 *  2. Steady motion leads by one display interval (velocity × dt) — cancels
 *     the measured one-interval trailing offset.
 *  3. Smooth by construction: the offset rides an EMA of the velocity, so
 *     per-frame quantization cannot oscillate the rim (the v1 stutter).
 *  4. A programmatic jump (|dy| >= maxDelta) resets the estimate.
 *  5. cfg > 0 = fixed ms; cfg = 0 = disabled.
 */
import { describe, it, expect } from 'vitest';
import { ScrollLead } from '../../glass/scrollLead';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';

/** Drive the lead with a synthetic scroll series; returns per-frame leads. */
function drive(
  series: Array<[number, number]>,
  cfg = -1,
  maxDelta = 600,
): number[] {
  const lead = new ScrollLead();
  return series.map(([y, t]) => lead.update(y, t, cfg, maxDelta));
}

describe('display-time lead v2 (smoothed velocity)', () => {
  it('is exactly zero at rest, and decays to zero after a stop', () => {
    // long steady scroll -> then stopped for 2s
    const series: Array<[number, number]> = [];
    for (let i = 0; i < 120; i++) series.push([i * 12, i * 16.7]); // ~720px/s
    const stopY = series[series.length - 1][0];
    for (let i = 1; i <= 120; i++) series.push([stopY, series[series.length - 1][1] + 16.7]);
    const leads = drive(series);
    const moving = leads[60];
    expect(moving).toBeGreaterThan(5); // real lead while scrolling
    const last = leads[leads.length - 1];
    expect(last).toBe(0); // rest snap: byte-identical idle
  });

  it('steady motion: lead approaches velocity × interval and stays stable', () => {
    // 100px per 16.7ms frame ≈ 5.99 px/ms... (6000 px/s) — cap-bounded, so
    // use a realistic 900px/s: 15px per frame.
    const series: Array<[number, number]> = [];
    let y = 0;
    for (let i = 0; i < 200; i++) {
      y += 15;
      series.push([y, i * 16.7]);
    }
    const leads = drive(series);
    // After the EMA settles (~6 tau), lead ≈ 15px * (dt shown as interval).
    const settled = leads.slice(120);
    const mean = settled.reduce((a, b) => a + b, 0) / settled.length;
    expect(mean).toBeGreaterThan(10);
    expect(mean).toBeLessThan(16.7);
    // STABILITY: no oscillation — consecutive frames differ by <1.5px.
    let maxJump = 0;
    for (let i = 121; i < leads.length; i++) {
      maxJump = Math.max(maxJump, Math.abs(leads[i] - leads[i - 1]));
    }
    expect(maxJump).toBeLessThan(1.5);
  });

  it('is smooth across an abrupt velocity change (the v1 stutter case)', () => {
    // Steady 900px/s, then an abrupt drop to 300px/s (finger deceleration).
    const series: Array<[number, number]> = [];
    let y = 0;
    for (let i = 0; i < 100; i++) {
      y += 15;
      series.push([y, i * 16.7]);
    }
    for (let i = 100; i < 220; i++) {
      y += 5;
      series.push([y, i * 16.7]);
    }
    const leads = drive(series);
    // The transition must be a glide, never a step: per-frame change small.
    let maxJump = 0;
    for (let i = 101; i < leads.length; i++) {
      maxJump = Math.max(maxJump, Math.abs(leads[i] - leads[i - 1]));
    }
    expect(maxJump).toBeLessThan(1.5);
  });

  it('a programmatic jump resets and predicts nothing', () => {
    const lead = new ScrollLead();
    lead.update(0, 0, -1, 600);
    lead.update(12, 16.7, -1, 600);
    expect(lead.update(1200, 33.4, -1, 600)).toBe(0); // anchor jump
    expect(lead.update(1200, 50.1, -1, 600)).toBe(0); // still reset
  });

  it('honors disable (0) and fixed-ms mode', () => {
    const series: Array<[number, number]> = [];
    let y = 0;
    for (let i = 0; i < 60; i++) {
      y += 15;
      series.push([y, i * 16.7]);
    }
    expect(drive(series, 0).every((v) => v === 0)).toBe(true);
    const fixed = drive(series, 16.7);
    expect(fixed[50]).toBeGreaterThan(10); // one explicit interval
  });

  it('the controller wires the smoothed lead into the panel draw', () => {
    const controller = readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8');
    expect(controller).toContain("from './scrollLead'");
    expect(controller).toContain('new ScrollLead()');
    expect(controller).toMatch(/top:\s*rect\.top\s*\+\s*leadOff/);
    expect(controller).toContain('laglead');
    expect(controller).toContain('__glassLead');
    expect(controller).toMatch(/leadParam\s*\?\?\s*-1/);
  });
});
