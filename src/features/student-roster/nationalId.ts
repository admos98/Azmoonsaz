/**
 * Iranian National ID (کد ملی) discipline: modular-11 checksum validation
 * and the ۱۲۳****۸۹۰ live mask. Pure functions — no React, no services.
 * The page renders them inline; extraction keeps the masking policy in one
 * auditable place next to the privacy warning that demands it.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { toPersianDigits } from '../../utils/persian';

export type NationalIdValidation = { isValid: boolean; message: string };

/** Validate a 10-digit Iranian national ID (modular-11 control digit). */
export function validateIranianNationalId(id: string): NationalIdValidation {
  if (!id) return { isValid: false, message: 'لطفاً کد ملی را وارد نمایید.' };
  const cleanId = id.trim().replace(/\D/g, '');
  if (cleanId.length !== 10)
    return { isValid: false, message: 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.' };
  if (/^(\d)\1{9}$/.test(cleanId))
    return { isValid: false, message: 'شماره ملی نامعتبر است (ارقام تکراری هستند).' };

  const digits = cleanId.split('').map(Number);
  const checkDigit = digits[9];
  const sum = digits.slice(0, 9).reduce((acc, digit, idx) => acc + digit * (10 - idx), 0);
  const remainder = sum % 11;
  const computedCheck = remainder < 2 ? remainder : 11 - remainder;

  if (checkDigit === computedCheck) {
    return { isValid: true, message: 'کد ملی وارد شده معتبر و تایید شده است.' };
  } else {
    return {
      isValid: false,
      message: 'الگوریتم رقم کنترلی کد ملی با استانداردهای ثبت احوال همخوانی ندارد.',
    };
  }
}

/** Live mask: ۱۲۳****۸۹۰ — short inputs show as-is in Persian digits. */
export function maskNationalIdPersian(id: string): string {
  const clean = id.trim().replace(/\D/g, '');
  if (clean.length < 10) return toPersianDigits(clean);
  const part1 = clean.slice(0, 3);
  const part2 = clean.slice(7);
  return toPersianDigits(`${part1}****${part2}`);
}
