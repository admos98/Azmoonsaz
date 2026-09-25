import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type StudentImportRow = {
  row: number;
  name: string;
  nationalId: string;
  className: string;
  grade: string;
  phone?: string;
  email?: string;
};

export type StudentImportIssue = { row: number; message: string; source?: StudentImportRow };

type UnknownRow = Record<string, unknown>;
const aliases = {
  name: ['name', 'full_name', 'نام', 'نام و نام خانوادگی', 'نام‌ و نام خانوادگی'],
  nationalId: ['national_id', 'nationalid', 'کد ملی', 'کدملی'],
  className: ['class', 'class_name', 'کلاس', 'نام کلاس'],
  grade: ['grade', 'پایه', 'پایه تحصیلی'],
  phone: ['phone', 'phone_number', 'موبایل', 'شماره موبایل', 'تلفن'],
  email: ['email', 'ایمیل'],
} as const;

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
const normalizeDigits = (value: unknown) =>
  String(value ?? '').replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit);
    if (persian >= 0) return String(persian);
    return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
  });
const read = (row: UnknownRow, names: readonly string[]) => {
  const key = Object.keys(row).find((candidate) => names.includes(normalizeHeader(candidate)));
  return key ? String(row[key] ?? '').trim() : '';
};

function mapRows(rows: UnknownRow[]): StudentImportRow[] {
  return rows
    .filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))
    .map((row, index) => ({
      row: index + 2,
      name: read(row, aliases.name),
      nationalId: normalizeDigits(read(row, aliases.nationalId)).replace(/\D/g, ''),
      className: read(row, aliases.className),
      grade: read(row, aliases.grade),
      phone: normalizeDigits(read(row, aliases.phone)).replace(/[^\d+]/g, '') || undefined,
      email: read(row, aliases.email) || undefined,
    }));
}

export async function parseStudentFile(file: File): Promise<StudentImportRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv' || file.type.includes('csv')) {
    const text = await file.text();
    const result = Papa.parse<UnknownRow>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
    });
    if (result.errors.length) throw new Error(`خطا در خواندن CSV: ${result.errors[0].message}`);
    return mapRows(result.data);
  }
  if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('فایل اکسل هیچ برگه‌ای ندارد.');
    return mapRows(XLSX.utils.sheet_to_json<UnknownRow>(sheet, { defval: '' }));
  }
  throw new Error('فقط فایل CSV، XLSX یا XLS پذیرفته می‌شود.');
}

export function isValidIranianNationalId(value: string): boolean {
  if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const remainder =
    digits.slice(0, 9).reduce((sum, digit, index) => sum + digit * (10 - index), 0) % 11;
  return digits[9] === (remainder < 2 ? remainder : 11 - remainder);
}
