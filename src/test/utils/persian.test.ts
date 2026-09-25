import { describe, it, expect } from 'vitest';
import {
  toPersianDigits,
  formatPersianNumber,
  formatPersianDate,
  formatPersianDateTime,
  formatPersianRelativeTime,
  validateIranianNationalId,
  toEnglishDigits,
  normalizePersianText,
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

describe('normalizePersianText', () => {
  it('normalizes Arabic letter and digit variants for search', () => {
    expect(normalizePersianText('  علی کریمی ١٢۳  ')).toBe('علی کریمی 123');
  });

  it('normalizes half-spaces and diacritics', () => {
    expect(normalizePersianText('دانش‌آمُوز')).toBe('دانش آموز');
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
  it('returns a Tehran-time Jalali date with Persian digits', () => {
    const result = formatPersianDate('2026-03-21T00:00:00Z');
    expect(result).toContain('فروردین');
    expect(result).toMatch(/[۰-۹]/);
    expect(result).not.toMatch(/[0-9]/);
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

describe('formatPersianRelativeTime', () => {
  const now = new Date('2026-09-25T12:00:00Z');

  it('formats past and future values with Persian digits', () => {
    expect(formatPersianRelativeTime('2026-09-22T12:00:00Z', now)).toContain('۳');
    expect(formatPersianRelativeTime('2026-09-25T14:00:00Z', now)).toContain('۲');
  });

  it('handles current, invalid, and null dates', () => {
    expect(formatPersianRelativeTime(now, now)).toBe('اکنون');
    expect(formatPersianRelativeTime('invalid', now)).toBe('—');
    expect(formatPersianRelativeTime(null, now)).toBe('—');
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
