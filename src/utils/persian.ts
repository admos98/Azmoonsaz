/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
export function formatPersianNumber(str: string | number): string {
  if (str === undefined || str === null) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (digit) => farsiDigits[parseInt(digit, 10)]);
}

/**
 * Formats standard ISO/Date strings to Persian Solar Hijri calendar date.
 */
export function formatPersianDate(dateInput: string | Date | null | undefined, includeTime = false): string {
  if (!dateInput) return '—';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return '—';
    }

    const options: Intl.DateTimeFormatOptions = {
      calendar: 'persian',
      numberingSystem: 'latn', // keep as latn and convert overall or use fa-IR natively
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    const formatted = new Intl.DateTimeFormat('fa-IR', options).format(date);
    return formatted;
  } catch (error) {
    console.warn('Persian date conversion failed, returning default representation', error);
    return String(dateInput);
  }
}

/**
 * Converts numbers/digits to Persian representation.
 */
export function toPersianDigits(str: string | number): string {
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

