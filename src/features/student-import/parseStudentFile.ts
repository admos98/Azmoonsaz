import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toEnglishDigits } from '../../utils/persian';

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
// CQ-4 fix: delegate to the shared toEnglishDigits — the inline copy here
// duplicated utils/persian and would drift on the next normalization fix.
const normalizeDigits = (value: unknown) => toEnglishDigits(String(value ?? ''));
const read = (row: UnknownRow, names: readonly string[]) => {
  const key = Object.keys(row).find((candidate) => names.includes(normalizeHeader(candidate)));
  return key ? String(row[key] ?? '').trim() : '';
};

function mapRows(rows: UnknownRow[]): StudentImportRow[] {
  // FE-8 fix: number rows from their REAL spreadsheet position (header = row
  // 1). The old code numbered AFTER filtering out empty rows, so any blank
  // line shifted every subsequent "ردیف N" and the teacher corrected the
  // wrong line. The row number is captured from the raw index BEFORE the
  // emptiness filter — filter semantics themselves are unchanged.
  return rows
    .map((raw, index) => ({ raw, rowNumber: index + 2 }))
    .filter(({ raw }) => Object.values(raw).some((value) => String(value ?? '').trim()))
    .map(({ raw, rowNumber }) => ({
      row: rowNumber,
      name: read(raw, aliases.name),
      nationalId: normalizeDigits(read(raw, aliases.nationalId)).replace(/\D/g, ''),
      className: read(raw, aliases.className),
      grade: read(raw, aliases.grade),
      phone: normalizeDigits(read(raw, aliases.phone)).replace(/[^\d+]/g, '') || undefined,
      email: read(raw, aliases.email) || undefined,
    }));
}

// F-16: xlsx parsing runs on untrusted bytes in the teacher's browser — cap
// the input before the parser sees it (compensating control for the SheetJS
// advisories; the parser itself is upgraded separately).
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export async function parseStudentFile(file: File): Promise<StudentImportRow[]> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('حجم فایل بیشتر از ۱۰ مگابایت است.');
  }
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

/* Re-exported so existing callers/tests keep working; the implementation
   lives in ./nationalId (zero-dep) so validators never pull xlsx in. */
export { isValidIranianNationalId } from './nationalId';
