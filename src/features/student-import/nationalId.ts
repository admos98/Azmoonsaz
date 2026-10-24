/**
 * Iranian national-ID validation — zero-dependency module.
 *
 * Lives apart from `parseStudentFile` on purpose: that module statically
 * imports xlsx + papaparse (~121 KB gz). Anything that only needs to
 * VALIDATE an ID (the import wizard's row checks, future student forms)
 * imports from here and never pulls the parsers into its chunk.
 *
 * CQ-3 fix: this is now the CANONICAL checksum implementation. The same
 * mod-11 rule used to live in three places with three different
 * normalization policies (Persian digits passed here and failed in the
 * roster copy, or vice versa). Every caller now shares this function:
 * normalization (Persian/Arabic digits + separator stripping) happens
 * BEFORE the checksum, so one fix covers all callers.
 *
 * Algorithm: 10 digits after normalization, not all identical; weighted
 * checksum mod 11 with the standard Iranian national-ID control-digit rule.
 */
export function isValidIranianNationalId(value: string): boolean {
  const clean = String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) // persian-ok — normalization charmap, not copy
    .replace(/\D/g, '');
  if (!/^\d{10}$/.test(clean) || /^(\d)\1{9}$/.test(clean)) return false;
  const digits = clean.split('').map(Number);
  const remainder =
    digits.slice(0, 9).reduce((sum, digit, index) => sum + digit * (10 - index), 0) % 11;
  return digits[9] === (remainder < 2 ? remainder : 11 - remainder);
}
