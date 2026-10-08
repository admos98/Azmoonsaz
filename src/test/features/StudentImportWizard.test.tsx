import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentImportWizard from '../../features/student-import/StudentImportWizard';
import { ThemeProvider } from '../../contexts/ThemeContext';

const importStudents = vi.fn();
vi.mock('../../services/api', () => ({
  studentService: {
    importStudents: (...args: unknown[]) => importStudents(...args),
  },
}));
vi.mock('../../hooks/useOriginFromTrigger', () => ({ useOriginFromTrigger: () => [null, null] }));

const validCsv = 'name,national_id,class,grade\nسارا محمدی,0000000019,هفتم الف,هفتم';

const renderWizard = (onImported = vi.fn()) => {
  // The done/failed steps render <Seal>/<AbsenceArt>, which read useTheme —
  // the harness stands in for the app's ThemeProvider.
  const utils = render(
    <ThemeProvider>
      <StudentImportWizard
        open
        onClose={vi.fn()}
        triggerRef={{ current: null }}
        classGroups={[{ id: 'class-1', name: 'هفتم الف', grade: 'هفتم', studentCount: 0 }]}
        existingStudents={[]}
        onImported={onImported}
      />
    </ThemeProvider>,
  );
  return { ...utils, onImported };
};

const uploadCsv = async (container: HTMLElement, csv: string) => {
  const file = new File([csv], 'students.csv', { type: 'text/csv' });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  await userEvent.upload(input!, file);
};

describe('StudentImportWizard', () => {
  beforeEach(() => importStudents.mockReset());

  it('parses, previews, and imports a valid CSV row in ONE bulk request', async () => {
    importStudents.mockResolvedValue({
      imported: [
        {
          id: 'student-1',
          name: 'سارا محمدی',
          nationalId: '0000000019',
          maskedNationalId: '***0019',
          grade: 'هفتم',
          classGroupId: 'class-1',
        },
      ],
      failed: [],
    });
    const { container, onImported } = renderWizard();
    await uploadCsv(container, validCsv);
    expect((await screen.findAllByText('آماده ورود')).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /ورود ۱ دانش‌آموز معتبر/ }));

    await waitFor(() => expect(importStudents).toHaveBeenCalledTimes(1));
    // One call for the whole batch, carrying the resolved class id.
    const [payload, request] = importStudents.mock.calls[0] as [
      { row: number; name: string; nationalId: string; classGroupId: string }[],
      { signal: AbortSignal },
    ];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual(
      expect.objectContaining({
        name: 'سارا محمدی',
        nationalId: '0000000019',
        classGroupId: 'class-1',
      }),
    );
    expect(payload[0].row).toBeGreaterThan(0);
    // The caller can cancel it — closing mid-import aborts the request.
    expect(request.signal).toBeInstanceOf(AbortSignal);

    expect(await screen.findByText('ورود اطلاعات انجام شد')).toBeInTheDocument();
    expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ id: 'student-1' })]);
  });

  it('names every failed row instead of only counting it', async () => {
    importStudents.mockResolvedValue({
      imported: [],
      failed: [
        { row: 2, reason: 'duplicate_student' },
        { row: 3, reason: 'invalid_national_id' },
      ],
    });
    const { container, onImported } = renderWizard();
    await uploadCsv(
      container,
      'name,national_id,class,grade\n' +
        'سارا محمدی,0000000019,هفتم الف,هفتم\n' +
        'علی رضایی,0000000028,هفتم الف,هفتم\n',
    );
    await screen.findAllByText('آماده ورود');
    await userEvent.click(screen.getByRole('button', { name: /دانش‌آموز معتبر/ }));

    expect(await screen.findByText('هیچ ردیفی ثبت نشد')).toBeInTheDocument();
    expect(await screen.findByText('ردیف ۲')).toBeInTheDocument();
    expect(screen.getByText('کد ملی تکراری است.')).toBeInTheDocument();
    expect(screen.getByText('ردیف ۳')).toBeInTheDocument();
    expect(screen.getByText('کد ملی معتبر نیست.')).toBeInTheDocument();
    // Nothing was imported, so nothing is handed back to the caller.
    expect(onImported).not.toHaveBeenCalled();
    expect(importStudents).toHaveBeenCalledTimes(1);
  });

  it('reports an unknown class instead of silently choosing another class', async () => {
    const { container } = render(
      <ThemeProvider>
        <StudentImportWizard
          open
          onClose={vi.fn()}
          triggerRef={{ current: null }}
          classGroups={[{ id: 'class-1', name: 'هفتم الف', grade: 'هفتم', studentCount: 0 }]}
          existingStudents={[]}
          onImported={vi.fn()}
        />
      </ThemeProvider>,
    );
    const file = new File(
      ['name,national_id,class,grade\nسارا محمدی,0000000019,هشتم ب,هشتم'],
      'students.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    expect(await screen.findByText('کلاس واردشده در سامانه پیدا نشد.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ورود ۰ دانش‌آموز معتبر/ })).toBeDisabled();
    // Nothing can ship, so no request must be made.
    expect(importStudents).not.toHaveBeenCalled();
  });
});
