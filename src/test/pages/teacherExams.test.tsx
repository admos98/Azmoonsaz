/**
 * Teacher page smoke test — Exams.tsx (CQ-8: the teacher pages had ZERO
 * render tests). Renders the real page inside the real TeacherProvider with
 * the service layer mocked, and pins the behaviors a refactor must not lose:
 * cache-driven list rendering, status-tab filtering, empty state, navigation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TeacherProvider } from '../../contexts/TeacherContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import Exams from '../../pages/teacher/Exams';
import type { Exam } from '../../types';

vi.mock('../../services/api', () => ({
  authService: {
    getCurrentTeacher: vi.fn().mockResolvedValue({
      id: 't1',
      name: 'استاد نمونه',
      email: 't@example.com',
      isOnboarded: true,
    }),
  },
  classService: { getClassGroups: vi.fn().mockResolvedValue([]) },
  studentService: { getStudents: vi.fn().mockResolvedValue([]) },
  questionService: { getQuestions: vi.fn().mockResolvedValue([]) },
  examService: { getExams: vi.fn(), updateExam: vi.fn() },
  gradingService: { getSubmissions: vi.fn().mockResolvedValue([]) },
}));

import { examService } from '../../services/api';

const makeExam = (overrides: Partial<Exam>): Exam =>
  ({
    id: 'e1',
    examCode: 'EX-101',
    title: 'آزمون ریاضی',
    grade: 'هفتم',
    subject: 'ریاضی',
    duration: 60,
    settings: {} as Exam['settings'],
    sections: [],
    questions: [],
    classGroupIds: [],
    status: 'draft',
    teacherId: 't1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as Exam;

const renderExams = (exams: Exam[]) => {
  vi.mocked(examService.getExams).mockResolvedValue(exams);
  const onNavigate = vi.fn();
  render(
    <ThemeProvider>
      <TeacherProvider>
        <Exams onNavigate={onNavigate} />
      </TeacherProvider>
    </ThemeProvider>,
  );
  return { onNavigate };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Exams page (teacher)', () => {
  it('renders the exams from the shared collections cache and navigates on create', async () => {
    const { onNavigate } = renderExams([
      makeExam({ id: 'e1', title: 'آزمون ریاضی', status: 'draft' }),
      makeExam({ id: 'e2', title: 'آزمون علوم', status: 'scheduled' }),
    ]);

    await waitFor(() => {
      expect(screen.getByText('آزمون ریاضی')).toBeTruthy();
    });
    expect(screen.getByText('آزمون علوم')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'طراحی آزمون نو' })[0]);
    expect(onNavigate).toHaveBeenCalledWith('exams/new');
  });

  it('filters the grid by status tab', async () => {
    renderExams([
      makeExam({ id: 'e1', title: 'آزمون ریاضی', status: 'draft' }),
      makeExam({ id: 'e2', title: 'آزمون علوم', status: 'scheduled' }),
    ]);
    await waitFor(() => screen.getByText('آزمون ریاضی'));

    fireEvent.click(screen.getByRole('button', { name: 'برنامه‌ریزی شده' }));
    await waitFor(() => {
      expect(screen.queryByText('آزمون ریاضی')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText('آزمون علوم')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'پیش‌نویس‌ها' }));
    await waitFor(() => {
      expect(screen.getByText('آزمون ریاضی')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByText('آزمون علوم')).toBeNull();
    });
  });

  it('shows the empty state when the teacher has no exams', async () => {
    renderExams([]);
    await waitFor(() => {
      // the "all" tab stays, but no exam cards appear
      expect(screen.queryByText(/آزمون ریاضی/)).toBeNull();
    });
    expect(screen.getAllByRole('button', { name: 'طراحی آزمون نو' }).length).toBeGreaterThan(0);
  });
});
