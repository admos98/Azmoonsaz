import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CommandPalette from '../../components/CommandPalette';

vi.mock('../../services/api', () => ({
  examService: {
    getExams: vi.fn().mockResolvedValue([{ id: 'e1', title: 'آزمون زیست', status: 'draft' }]),
  },
  studentService: {
    getStudents: vi
      .fn()
      .mockResolvedValue([
        { id: 's1', name: 'علی رضایی', grade: 'هفتم', nationalId: '0000000019' },
      ]),
  },
  classService: {
    getClassGroups: vi.fn().mockResolvedValue([{ id: 'c1', name: 'کلاس ۷۰۱', grade: 'هفتم' }]),
  },
}));

describe('CommandPalette', () => {
  it('supports discoverable non-modifier navigation sequences outside editors', () => {
    const navigate = vi.fn();
    render(<CommandPalette onNavigate={navigate} />);
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'n' });
    expect(navigate).toHaveBeenCalledWith('new-exam');
  });

  it('opens by shortcut, normalizes Persian search, and navigates by keyboard', () => {
    const navigate = vi.fn();
    render(<CommandPalette onNavigate={navigate} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const search = screen.getByRole('textbox', { name: 'جستجوی فرمان‌ها' });
    fireEvent.change(search, { target: { value: 'دانش آموزان' } });
    expect(screen.getByRole('option', { name: /دانش‌آموزان/ })).toBeInTheDocument();

    fireEvent.keyDown(search, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('students');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('searches live exam, student, and class entities', async () => {
    render(<CommandPalette onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'باز کردن جستجو و فرمان‌ها' }));
    expect(await screen.findByRole('option', { name: /آزمون زیست/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'علی رضایی' } });
    expect(screen.getByRole('option', { name: /علی رضایی/ })).toBeInTheDocument();
  });

  it('offers recovery when no command matches', async () => {
    render(<CommandPalette onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'باز کردن جستجو و فرمان‌ها' }));
    await screen.findByRole('option', { name: /آزمون زیست/ });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ناموجود' } });
    expect(screen.getByText('نتیجه‌ای پیدا نشد')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن جستجو' }));
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
  });
});
