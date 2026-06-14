import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './env.mjs';

loadLocalEnv();

function arg(name, fallback = '') {
  const idx = process.argv.indexOf('--' + name);
  return idx >= 0 ? String(process.argv[idx + 1] || '') : fallback;
}

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

function sqlString(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

const teacherId = arg('teacher-id');
const nationalId = normalizeNationalId(arg('national-id'));
const out = arg('out', 'supabase/seed-demo.generated.sql');

if (!teacherId) {
  console.error('Usage: npm run seed:demo-sql -- --teacher-id TEACHER_AUTH_UUID --national-id VALID_TEST_NATIONAL_ID');
  process.exit(1);
}

if (!validateIranianNationalId(nationalId)) {
  console.error('Invalid national ID. Use a valid test ID. The value will be hashed; it will not be written to SQL.');
  process.exit(1);
}

const pepper = process.env.STUDENT_ID_PEPPER;
if (!pepper || pepper.length < 32) {
  console.error('STUDENT_ID_PEPPER is missing or too short in .env.local');
  process.exit(1);
}

const hash = crypto.createHmac('sha256', pepper).update(nationalId).digest('hex');
const last4 = nationalId.slice(-4);

const sqlLines = [
  '-- Generated demo seed. Review before running.',
  '-- Plain national ID is intentionally NOT included.',
  '',
  'insert into public.teacher_profiles (id, full_name, school_name)',
  'values (' + sqlString(teacherId) + ", 'Demo Teacher', 'Demo School')",
  'on conflict (id) do update set full_name = excluded.full_name, school_name = excluded.school_name;',
  '',
  'with class_row as (',
  '  insert into public.class_groups (teacher_id, name, grade)',
  '  values (' + sqlString(teacherId) + ", 'Demo Class 701', '7')",
  '  returning id',
  '), student_row as (',
  '  insert into public.students (teacher_id, class_group_id, full_name, grade, national_id_hash, national_id_last4, status)',
  '  select ' + sqlString(teacherId) + ", class_row.id, 'Demo Student', '7', " + sqlString(hash) + ', ' + sqlString(last4) + ", 'active'",
  '  from class_row',
  '  on conflict (teacher_id, national_id_hash) do update set full_name = excluded.full_name',
  '  returning id, class_group_id',
  '), exam_row as (',
  '  insert into public.exams (teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings)',
  '  values (' + sqlString(teacherId) + ", 'DEMO7', 'Demo Secure Exam', '7', 'Science', 'active', 'official', now() - interval '1 hour', now() + interval '2 hours', 45, '{}'::jsonb)",
  "  on conflict (exam_code) do update set status = 'active', starts_at = now() - interval '1 hour', ends_at = now() + interval '2 hours'",
  '  returning id',
  '), allowed_row as (',
  '  insert into public.exam_allowed_classes (exam_id, class_group_id)',
  '  select exam_row.id, student_row.class_group_id from exam_row, student_row',
  '  on conflict do nothing',
  '), question_row as (',
  '  insert into public.questions (teacher_id, type, grade, subject, title, body, answer_key, points)',
  '  values (',
  '    ' + sqlString(teacherId) + ',',
  "    'single_choice',",
  "    '7',",
  "    'Science',",
  "    'Demo question',",
    '    ' + sqlString(JSON.stringify({ text: 'Which option is correct?', options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }] })) + '::jsonb,',
    '    ' + sqlString(JSON.stringify({ correctAnswer: 'a' })) + '::jsonb,',
  '    1',
  '  )',
  '  returning id',
  ')',
  'insert into public.exam_questions (exam_id, question_id, section_title, position, points)',
  "select exam_row.id, question_row.id, 'Section 1', 1, 1",
  'from exam_row, question_row',
  'on conflict do nothing;',
];

const full = path.join(process.cwd(), out);
fs.mkdirSync(path.dirname(full), { recursive: true });
fs.writeFileSync(full, sqlLines.join('\n') + '\n', 'utf8');
console.log('Wrote ' + out);
console.log('Use exam code DEMO7 for testing.');
console.log('Stored national_id_last4=' + last4 + ' and hash only.');
