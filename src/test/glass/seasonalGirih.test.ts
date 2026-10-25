/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import {
  jalaliMonth,
  seasonGirihFold,
  applySeasonalGirih,
} from '../../glass/seasonalGirih';

describe('seasonal girih', () => {
  it('maps the Persian seasons to their fold', () => {
    // spring 1-3 and autumn 7-9 keep the Nowruz decagram
    for (const m of [1, 2, 3, 7, 8, 9]) expect(seasonGirihFold(m)).toBe(10);
    // summer 4-6: the eight-fold of summer courtyards
    for (const m of [4, 5, 6]) expect(seasonGirihFold(m)).toBe(8);
    // winter 10-12: the twelve-fold snow crystal
    for (const m of [10, 11, 12]) expect(seasonGirihFold(m)).toBe(12);
    // unknown calendar → the brand default, never a surprise
    expect(seasonGirihFold(null)).toBe(10);
  });

  it('reads the Jalali month through Intl when the platform has it', () => {
    const m = jalaliMonth(new Date());
    // Either the platform resolves it (1-12) or degrades to null — never a
    // wrong or out-of-range month.
    expect(m === null || (m >= 1 && m <= 12)).toBe(true);
  });

  it('applySeasonalGirih sets an inline fold only when it departs from 10', () => {
    const el = document.documentElement;
    el.style.removeProperty('--lens-girih-fold');
    const fold = applySeasonalGirih(new Date());
    if (fold === 10) {
      expect(el.style.getPropertyValue('--lens-girih-fold')).toBe('');
    } else {
      expect(el.style.getPropertyValue('--lens-girih-fold')).toBe(String(fold));
    }
    // amplitude is untouchable — the brand constant lives in tokens.css
    expect(el.style.getPropertyValue('--lens-girih')).toBe('');
    el.style.removeProperty('--lens-girih-fold');
  });
});
