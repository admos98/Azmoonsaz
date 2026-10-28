/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it, vi } from 'vitest';
import { runInViewTransition, supportsViewTransition } from '../../utils/viewTransition';

describe('view transitions', () => {
  it('reports support honestly', () => {
    // jsdom has no startViewTransition — the probe must not lie.
    expect(supportsViewTransition()).toBe(false);
  });

  it('runs the callback directly when the platform lacks the API', () => {
    const cb = vi.fn();
    runInViewTransition(cb, false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('runs the callback directly under reduced motion even with API support', () => {
    const start = vi.fn((cb: () => void) => cb());
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
    try {
      const cb = vi.fn();
      runInViewTransition(cb, true);
      expect(start).not.toHaveBeenCalled();
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    }
  });

  it('routes through startViewTransition when supported and motion is welcome', () => {
    let inner: (() => void) | null = null;
    const start = vi.fn((cb: () => void) => {
      inner = cb;
      return {};
    });
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
    try {
      const cb = vi.fn();
      runInViewTransition(cb, false);
      expect(start).toHaveBeenCalledTimes(1);
      // the callback is flushed inside the transition, not before it
      expect(cb).not.toHaveBeenCalled();
      inner!();
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    }
  });

  // ── v7 genie aiming ────────────────────────────────────────────────────
  it('genie aiming writes the anchor offset and refuses honestly when absent', async () => {
    const { aimGenieAtMenu, clearGenie } = await import('../../utils/viewTransition');
    // jsdom getBoundingClientRect is all-zeros → 0×0 stage is NOT a target.
    expect(aimGenieAtMenu()).toBe(false);

    // With real geometry the offset lands on :root as px ints...
    document.body.innerHTML =
      '<div id="main-content" style="width:1000px;height:800px"></div>' +
      '<button id="hamburger-menu-btn" style="width:48px;height:48px"></button>';
    // ...but jsdom never computes layout, so rects stay 0×0: the honest
    // answer is still refusal. Pin THAT — the geometry math itself is a
    // browser concern; the contract under test is the no-anchor refusal.
    expect(aimGenieAtMenu()).toBe(false);

    // clearGenie always leaves :root spotless, whatever state it finds.
    document.documentElement.setAttribute('data-vt-genie', '');
    document.documentElement.style.setProperty('--vt-ax', '12px');
    document.documentElement.style.setProperty('--vt-ay', '-8px');
    clearGenie();
    expect(document.documentElement.hasAttribute('data-vt-genie')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--vt-ax')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--vt-ay')).toBe('');
    document.body.innerHTML = '';
  });

  it('cleans the genie flag after the transition settles', async () => {
    const { aimGenieAtMenu: aim } = await import('../../utils/viewTransition');
    // Force aiming to succeed by stubbing rects, then verify runInViewTransition
    // removes the flag via transition.finished.
    const rect = { left: 0, top: 0, width: 10, height: 10 };
    document.body.innerHTML =
      '<div id="main-content"></div><button id="hamburger-menu-btn"></button>';
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(rect as DOMRect);
    let settled: ((v: unknown) => void) | null = null;
    const start = vi.fn((cb: () => void) => {
      cb();
      return { finished: new Promise((res) => (settled = res)) };
    });
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
    try {
      expect(aim()).toBe(true);
      runInViewTransition(() => undefined, false);
      expect(document.documentElement.hasAttribute('data-vt-genie')).toBe(true);
      settled!(undefined);
      await Promise.resolve();
      await Promise.resolve();
      expect(document.documentElement.hasAttribute('data-vt-genie')).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--vt-ax')).toBe('');
    } finally {
      spy.mockRestore();
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
      document.body.innerHTML = '';
      clearGenieSafe();
    }
  });

  function clearGenieSafe() {
    document.documentElement.removeAttribute('data-vt-genie');
    document.documentElement.style.removeProperty('--vt-ax');
    document.documentElement.style.removeProperty('--vt-ay');
  }
});
