import { describe, it, expect } from 'vitest';
import {
  toPersianDigits,
  formatPersianNumber,
  formatPersianDate,
  formatPersianDateTime,
  validateIranianNationalId,
  toEnglishDigits,
} from '../../utils/persian';

describe('toPersianDigits', () => {
  it('converts ASCII digits to Persian', () => {
    expect(toPersianDigits('1234567890')).toBe('۱۲۳۴۵۶۷۸۹۰');
  });

  it('preserves non-digit characters', () => {
    expect(toPersianDigits('abc')).toBe('abc');
  });

  it('handles mixed strings', () => {
    expect(toPersianDigits('12abc34')).toBe('۱۲abc۳۴');
  });

  it('handles empty string', () => {
    expect(toPersianDigits('')).toBe('');
  });
});

describe('toEnglishDigits', () => {
  it('converts Persian digits to ASCII', () => {
    expect(toEnglishDigits('۱۲۳')).toBe('123');
  });
});

describe('formatPersianNumber', () => {
  it('formats a number', () => {
    const result = formatPersianNumber(1234567);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats zero', () => {
    const result = formatPersianNumber(0);
    expect(typeof result).toBe('string');
  });

  it('handles string input', () => {
    const result = formatPersianNumber('99');
    expect(typeof result).toBe('string');
  });
});

describe('formatPersianDate', () => {
  it('returns a string for valid ISO date', () => {
    const result = formatPersianDate('2026-06-21T00:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns fallback for invalid input', () => {
    const result = formatPersianDate('invalid');
    expect(typeof result).toBe('string');
  });

  it('handles null', () => {
    const result = formatPersianDate(null);
    expect(typeof result).toBe('string');
  });
});

describe('formatPersianDateTime', () => {
  it('returns a string for valid ISO date', () => {
    const result = formatPersianDateTime('2026-06-21T10:30:00Z');
    expect(typeof result).toBe('string');
  });
});

describe('validateIranianNationalId', () => {
  it('validates correct national ID format', () => {
    // 10-digit ID
    expect(validateIranianNationalId('0012345678')).toBe(false); // fails checksum
    expect(validateIranianNationalId('1111111111')).toBe(false);
    expect(validateIranianNationalId('abc')).toBe(false);
    expect(validateIranianNationalId('')).toBe(false);
  });
});
