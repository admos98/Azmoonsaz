/**
 * Iranian National ID (کد ملی) discipline: modular-11 checksum validation
 * and the ۱۲۳****۸۹۰ live mask. Pure functions — no React, no services.
 * The page renders them inline; extraction keeps the masking policy in one
 * auditable place next to the privacy warning that demands it.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { toPersianDigits } from '../../utils/persian';
// CQ-3 fix: single checksum source — delegate to the canonical validator
// instead of maintaining a second copy of the mod-11 rule here.
import { isValidIranianNationalId } from '../student-import/nationalId';

export type NationalIdValidation = { isValid: boolean; message: string };

/** Validate a 10-digit Iranian national ID (modular-11 control digit). */
export function validateIranianNationalId(id: string): NationalIdValidation {
  if (!id) return { isValid: false, message: 'لطفاً کد ملی را وارد نمایید.' };
  const cleanId = id.trim().replace(/\D/g, '');
  if (cleanId.length !== 10)
    return { isValid: false, message: 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.' };
  if (/^(\d)\1{9}$/.test(cleanId))
    return { isValid: false, message: 'شماره ملی نامعتبر است (ارقام تکراری هستند).' };

  if (!isValidIranianNationalId(cleanId)) {
    return {
      isValid: false,
      message: 'الگوریتم رقم کنترلی کد ملی با استانداردهای ثبت احوال همخوانی ندارد.',
    };
  }
  return { isValid: true, message: 'کد ملی وارد شده معتبر و تایید شده است.' };
}

/** Live mask: ۱۲۳****۸۹۰ — short inputs show as-is in Persian digits. */
export function maskNationalIdPersian(id: string): string {
  const clean = id.trim().replace(/\D/g, '');
  if (clean.length < 10) return toPersianDigits(clean);
  const part1 = clean.slice(0, 3);
  const part2 = clean.slice(7);
  return toPersianDigits(`${part1}****${part2}`);
}
