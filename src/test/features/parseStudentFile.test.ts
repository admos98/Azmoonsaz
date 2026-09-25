import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  isValidIranianNationalId,
  parseStudentFile,
} from '../../features/student-import/parseStudentFile';

describe('student import parser', () => {
  it('parses quoted CSV values and Persian headers', async () => {
    const csv = 'نام و نام خانوادگی,کد ملی,کلاس,پایه\n"رضا، احمدی",0000000019,هفتم الف,هفتم';
    const rows = await parseStudentFile(new File([csv], 'students.csv', { type: 'text/csv' }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'رضا، احمدی',
      nationalId: '0000000019',
      className: 'هفتم الف',
      grade: 'هفتم',
    });
  });

  it('parses a real XLSX workbook', async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { name: 'سارا محمدی', national_id: '0000000019', class: 'هفتم الف', grade: 'هفتم' },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const rows = await parseStudentFile(new File([bytes], 'students.xlsx'));
    expect(rows[0].name).toBe('سارا محمدی');
  });

  it('validates Iranian national IDs', () => {
    expect(isValidIranianNationalId('0000000019')).toBe(true);
    expect(isValidIranianNationalId('1111111111')).toBe(false);
  });
});
