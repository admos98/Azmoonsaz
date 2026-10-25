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
});
