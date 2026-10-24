/**
 * Compatibility exports for older AI-Studio-generated imports.
 *
 * CQ-4 fix: reduced to only the utilities that still exist in
 * ../utils/persian (the duplicate validateIranianNationalId / maskNationalId /
 * formatExamDuration copies were deleted — the canonical national-ID
 * checksum now lives in src/features/student-import/nationalId.ts).
 *
 * This file is now import-free dead code: nothing in src/ imports it.
 * Safe to delete in a follow-up cleanup.
 */

export {
  toPersianDigits,
  toEnglishDigits,
  formatPersianDate,
  formatPersianDateTime,
  formatPersianNumber,
} from '../utils/persian';
