import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentImportWizard from '../../features/student-import/StudentImportWizard';

const createStudent = vi.fn();
vi.mock('../../services/api', () => ({
  studentService: { createStudent: (...args: unknown[]) => createStudent(...args) },
}));
vi.mock('../../hooks/useOriginFromTrigger', () => ({ useOriginFromTrigger: () => [null, null] }));

describe('StudentImportWizard', () => {
  beforeEach(() => createStudent.mockReset());

  it('parses, previews, and imports a valid CSV row', async () => {
    createStudent.mockResolvedValue({
      id: 'student-1',
      name: 'سارا محمدی',
      nationalId: '0000000019',
      maskedNationalId: '***0019',
      grade: 'هفتم',
      classGroupId: 'class-1',
    });
    const onImported = vi.fn();
    const { container } = render(
      <StudentImportWizard
        open
        onClose={vi.fn()}
        triggerRef={{ current: null }}
        classGroups={[{ id: 'class-1', name: 'هفتم الف', grade: 'هفتم', studentCount: 0 }]}
        existingStudents={[]}
        onImported={onImported}
      />,
    );
    const file = new File(
      ['name,national_id,class,grade\nسارا محمدی,0000000019,هفتم الف,هفتم'],
      'students.csv',
      { type: 'text/csv' },
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await userEvent.upload(input!, file);
    expect((await screen.findAllByText('آماده ورود')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /ورود ۱ دانش‌آموز معتبر/ }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('ورود اطلاعات انجام شد')).toBeInTheDocument();
    expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ id: 'student-1' })]);
  });

  it('reports an unknown class instead of silently choosing another class', async () => {
    const { container } = render(
      <StudentImportWizard
        open
        onClose={vi.fn()}
        triggerRef={{ current: null }}
        classGroups={[{ id: 'class-1', name: 'هفتم الف', grade: 'هفتم', studentCount: 0 }]}
        existingStudents={[]}
        onImported={vi.fn()}
      />,
    );
    const file = new File(
      ['name,national_id,class,grade\nسارا محمدی,0000000019,هشتم ب,هشتم'],
      'students.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    expect(await screen.findByText('کلاس واردشده در سامانه پیدا نشد.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ورود ۰ دانش‌آموز معتبر/ })).toBeDisabled();
  });
});
