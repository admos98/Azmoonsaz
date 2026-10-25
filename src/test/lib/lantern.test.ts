/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it, vi } from 'vitest';
import {
  isLanternHour,
  lanternActive,
  isLanternEnabled,
  LANTERN_PREF_KEY,
  mountLanternAmbience,
} from '../../lib/lantern';

const at = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

describe('lantern window', () => {
  it('is on through the evening and night, off in daytime', () => {
    expect(isLanternHour(at(19))).toBe(true);
    expect(isLanternHour(at(23, 59))).toBe(true);
    expect(isLanternHour(at(0))).toBe(true);
    expect(isLanternHour(at(5, 59))).toBe(true);
    expect(isLanternHour(at(6))).toBe(false);
    expect(isLanternHour(at(18, 59))).toBe(false);
    expect(isLanternHour(at(12))).toBe(false);
  });

  it('honors the preference key (default ON)', () => {
    localStorage.clear();
    expect(isLanternEnabled()).toBe(true);
    localStorage.setItem(LANTERN_PREF_KEY, 'false');
    expect(isLanternEnabled()).toBe(false);
    localStorage.setItem(LANTERN_PREF_KEY, 'true');
    expect(isLanternEnabled()).toBe(true);
  });

  it('preference off keeps the attribute off even at night', () => {
    document.documentElement.removeAttribute('data-ambience');
    localStorage.setItem(LANTERN_PREF_KEY, 'false');
    expect(lanternActive(at(21))).toBe(false);
    const dispose = mountLanternAmbience(at(21));
    expect(document.documentElement.hasAttribute('data-ambience')).toBe(false);
    dispose();
    localStorage.removeItem(LANTERN_PREF_KEY);
  });

  it('mounts during lamp hours, cleans up after, and day-hours never mount', () => {
    vi.useFakeTimers();
    try {
      localStorage.clear();
      document.documentElement.removeAttribute('data-ambience');
      const disposeNight = mountLanternAmbience(at(21));
      expect(document.documentElement.dataset.ambience).toBe('lantern');
      disposeNight();
      expect(document.documentElement.hasAttribute('data-ambience')).toBe(false);

      const disposeDay = mountLanternAmbience(at(12));
      expect(document.documentElement.hasAttribute('data-ambience')).toBe(false);
      disposeDay();
    } finally {
      vi.useRealTimers();
    }
  });
});
