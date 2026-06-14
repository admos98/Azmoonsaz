import crypto from 'node:crypto';
import { loadLocalEnv } from './env.mjs';

loadLocalEnv();

function normalizeNationalId(input) {
  return String(input || '')
    .replace(/[\u06F0-\u06F9]/g, (d) => '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'.indexOf(d))
    .replace(/[\u0660-\u0669]/g, (d) => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d))
    .replace(/\D/g, '')
    .trim();
}

function validateIranianNationalId(input) {
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

const nationalId = process.argv[2];
if (!nationalId) {
  console.error('Usage: npm run hash:national-id -- 0012345678');
  process.exit(1);
}

const pepper = process.env.STUDENT_ID_PEPPER;
if (!pepper || pepper.length < 32) {
  console.error('STUDENT_ID_PEPPER is missing or shorter than 32 characters in .env.local');
  process.exit(1);
}

const normalized = normalizeNationalId(nationalId);
if (!validateIranianNationalId(normalized)) {
  console.error('Invalid Iranian national ID. Use a real valid test ID for seeding.');
  process.exit(1);
}

const hash = crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
console.log('normalized=' + normalized);
console.log('national_id_last4=' + normalized.slice(-4));
console.log('national_id_hash=' + hash);
