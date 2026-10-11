import './env.js';
import crypto from 'node:crypto';

export function normalizeNationalId(input) {
  return String(input || '')
    .replace(/[\u06F0-\u06F9]/g, (d) => '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'.indexOf(d))
    .replace(/[\u0660-\u0669]/g, (d) => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d))
    .replace(/\D/g, '')
    .trim();
}

export function validateIranianNationalId(input) {
  const code = normalizeNationalId(input);
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const checkDigit = digits[9];
  const sum = digits.slice(0, 9).reduce((acc, digit, idx) => acc + digit * (10 - idx), 0);
  const remainder = sum % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  return checkDigit === expected;
}

export function nationalIdHash(input) {
  const pepper = process.env.STUDENT_ID_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error('STUDENT_ID_PEPPER is missing or too short');
  }
  const code = normalizeNationalId(input);
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export function maskNationalId(input) {
  const code = normalizeNationalId(input);
  if (code.length !== 10) return '***';
  return code.slice(0, 3) + '****' + code.slice(7);
}

/**
 * T7 — student 6-digit exam PIN. Stored as an HMAC like the national ID:
 * the plaintext PIN is never persisted and can never be read back — not by
 * the teacher, not by a DB export. Verification recomputes the HMAC.
 *
 * Same pepper, different domain separator ('student_pin:') so a PIN hash
 * can never collide with a national-ID hash for the same value.
 */
export function normalizeStudentPin(input) {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\D/g, '')
    .trim();
}

export function validateStudentPin(input) {
  return /^\d{6}$/.test(normalizeStudentPin(input));
}

export function studentPinHash(studentId, pin) {
  const pepper = process.env.STUDENT_ID_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error('STUDENT_ID_PEPPER is missing or too short');
  }
  const clean = normalizeStudentPin(pin);
  return crypto
    .createHmac('sha256', pepper)
    .update('student_pin:' + String(studentId || '') + ':' + clean)
    .digest('hex');
}
