/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../lib/logger';

/**
 * Validates an Iranian National ID (کد ملی).
 * @param code 10-digit National ID string
 * @returns boolean
 */
export function validateIranianNationalId(code: string): boolean {
  if (!code) return false;

  // Clean english/persian numerals to english digits
  const cleanCode = String(code)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();

  if (!/^\d{10}$/.test(cleanCode)) {
    return false;
  }

  // Check if all digits are the same
  if (/^(\d)\1{9}$/.test(cleanCode)) {
    return false;
  }

  const digits = cleanCode.split('').map(Number);
  const checkDigit = digits[9];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }

  const remainder = sum % 11;
  if (remainder < 2) {
    return checkDigit === remainder;
  } else {
    return checkDigit === 11 - remainder;
  }
}

/**
 * Masks the Iranian National ID for privacy and security.
 * Format: "002***7654"
 */
export function maskNationalId(code: string): string {
  if (!code || code.length < 6) return '***';
  const cleanCode = String(code).trim();
  return `${cleanCode.substring(0, 3)}***${cleanCode.substring(Math.max(3, cleanCode.length - 4))}`;
}

/**
 * Converts numbers/digits from English to Persian representation.
 */
export function formatPersianNumber(str: string | number | null | undefined): string {
  if (str === undefined || str === null) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (digit) => farsiDigits[parseInt(digit, 10)]);
}

/**
 * Formats standard ISO/Date strings to Persian Solar Hijri calendar date.
 */
export function formatPersianDate(
  dateInput: string | Date | null | undefined,
  includeTime = false,
): string {
  if (!dateInput) return '—';

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    if (isNaN(date.getTime())) {
      return '—';
    }

    const options: Intl.DateTimeFormatOptions = {
      calendar: 'persian',
      numberingSystem: 'arabext',
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    const formatted = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', options).format(
      date,
    );
    return formatted;
  } catch (error) {
    logger.warn('Persian date conversion failed, returning default representation', error);
    return String(dateInput);
  }
}

/**
 * Converts numbers/digits to Persian representation.
 */
export function toPersianDigits(str: string | number | null | undefined): string {
  return formatPersianNumber(str);
}

/**
 * Converts Persian and Arabic digits to English digits.
 */
export function toEnglishDigits(str: string | number): string {
  if (str === undefined || str === null) return '';
  const input = String(str);
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Normalizes Arabic/Persian variants for reliable search and comparison. */
export function normalizePersianText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return toEnglishDigits(String(value))
    .replace(/[یى]/g, 'ی')
    .replace(/ک/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإٱ]/g, 'ا')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200C\u200D]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR');
}

/** Formats a concise relative time in Persian, with deterministic `now` for tests. */
export function formatPersianRelativeTime(
  dateInput: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return '—';

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['week', 7 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  const [unit, divisor] = units.find(([, size]) => absoluteSeconds >= size) || ['second', 1];
  return new Intl.RelativeTimeFormat('fa-IR-u-nu-arabext', { numeric: 'auto' }).format(
    Math.round(seconds / divisor),
    unit,
  );
}

/**
 * Formats a date with time included in Persian.
 */
export function formatPersianDateTime(dateInput: string | Date | null | undefined): string {
  return formatPersianDate(dateInput, true);
}

/**
 * Formats exam duration in minutes into a Persian description.
 */
export function formatExamDuration(minutes: number): string {
  if (!minutes) return '—';
  return `${toPersianDigits(minutes)} دقیقه`;
}
