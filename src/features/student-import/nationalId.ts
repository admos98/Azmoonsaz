/**
 * Iranian national-ID validation — zero-dependency module.
 *
 * Lives apart from `parseStudentFile` on purpose: that module statically
 * imports xlsx + papaparse (~121 KB gz). Anything that only needs to
 * VALIDATE an ID (the import wizard's row checks, future student forms)
 * imports from here and never pulls the parsers into its chunk.
 *
 * Algorithm: 10 digits, not all identical; weighted checksum mod 11 with
 * the standard Iranian national-ID control-digit rule.
 */
export function isValidIranianNationalId(value: string): boolean {
  if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const remainder =
    digits.slice(0, 9).reduce((sum, digit, index) => sum + digit * (10 - index), 0) % 11;
  return digits[9] === (remainder < 2 ? remainder : 11 - remainder);
}
