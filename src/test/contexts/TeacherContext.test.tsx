/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeacherContext tests — Phase 5 data layer.
 * Covers: login handoff (no refetch), self-fetch fallback, parallel collection
 * load, cache patches (upsert/remove), error status + reload recovery, and the
 * profile update path.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TeacherProvider, useTeacher, useTeacherCollections } from '../../contexts/TeacherContext';
import type { Exam, Teacher } from '../../types';

vi.mock('../../services/api', () => ({
  authService: {
    getCurrentTeacher: vi.fn(),
  },
  classService: { getClassGroups: vi.fn() },
  studentService: { getStudents: vi.fn() },
  questionService: { getQuestions: vi.fn() },
  examService: { getExams: vi.fn() },
  gradingService: { getSubmissions: vi.fn() },
}));

import {
  authService,
  classService,
  examService,
  gradingService,
  questionService,
  studentService,
} from '../../services/api';

const mockedTeacher: Teacher = {
  id: 't1',
  name: 'استاد نمونه',
  email: 'teacher@example.com',
  schoolName: 'دبیرستان نمونه',
  isOnboarded: true,
};

const makeExam = (overrides: Partial<Exam> = {}): Exam => ({
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
});

function Probe() {
  const { teacher, loading, updateTeacher } = useTeacher();
  const collections = useTeacherCollections();
  return (
    <div>
      <div data-testid="teacher-loading">{loading ? 'loading' : 'idle'}</div>
      <div data-testid="teacher-name">{teacher?.name ?? 'none'}</div>
      <div data-testid="exams">{collections.exams.map((e) => e.title).join('|')}</div>
      <div data-testid="students">{collections.students.map((s) => s.name).join('|')}</div>
      <div data-testid="exam-status">{collections.status.exams}</div>
      <div data-testid="question-status">{collections.status.questions}</div>
      <button onClick={() => collections.upsertExam(makeExam({ id: 'e2', title: 'آزمون جدید' }))}>
        upsert-new
      </button>
      <button
        onClick={() =>
          collections.upsertExam(makeExam({ id: 'e1', title: 'آزمون ریاضی ویرایش‌شده' }))
        }
      >
        upsert-existing
      </button>
      <button onClick={() => collections.removeExam('e1')}>remove-exam</button>
      <button onClick={() => collections.addStudents([{ ...collections.students[0], id: 's2', name: 'دانش‌آموز دوم' }])}>
        add-students
      </button>
      <button onClick={() => updateTeacher({ name: 'نام ویرایش‌شده' })}>update-teacher</button>
      <button onClick={() => void collections.reload('questions')}>reload-questions</button>
    </div>
  );
}

const renderProvider = (initialTeacher?: Teacher) =>
  render(
    <TeacherProvider initialTeacher={initialTeacher}>
      <Probe />
    </TeacherProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authService.getCurrentTeacher).mockResolvedValue(mockedTeacher);
  vi.mocked(classService.getClassGroups).mockResolvedValue([
    { id: 'c1', name: 'کلاس ۷۰۱', grade: 'هفتم', studentCount: 0 },
  ]);
  vi.mocked(studentService.getStudents).mockResolvedValue([
    {
      id: 's1',
      name: 'علی رضایی',
      nationalId: '0000000019',
      maskedNationalId: '000****019',
      grade: 'هفتم',
      classGroupId: 'c1',
    },
  ]);
  vi.mocked(questionService.getQuestions).mockResolvedValue([
    {
      id: 'q1',
      type: 'single_choice',
      title: 'سوال یک',
      text: 'متن سوال',
      points: 2,
      category: 'ریاضی',
      grade: 'هفتم',
    },
  ]);
  vi.mocked(examService.getExams).mockResolvedValue([makeExam()]);
  vi.mocked(gradingService.getSubmissions).mockResolvedValue([
    {
      id: 'sub1',
      examId: 'e1',
      examCode: 'EX-101',
      studentId: 's1',
      studentName: 'علی رضایی',
      nationalId: '0000000019',
      answers: [],
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'submitted',
      score: 0,
      maxScore: 10,
    },
  ]);
});

describe('TeacherProvider — profile', () => {
  it('accepts the login/boot handoff without re-fetching /api/teacher/me', async () => {
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('teacher-name')).toHaveTextContent('استاد نمونه'));
    expect(authService.getCurrentTeacher).not.toHaveBeenCalled();
    expect(screen.getByTestId('teacher-loading')).toHaveTextContent('idle');
  });

  it('self-fetches when no profile was handed over (post-onboarding path)', async () => {
    renderProvider(undefined);
    await waitFor(() => expect(screen.getByTestId('teacher-name')).toHaveTextContent('استاد نمونه'));
    expect(authService.getCurrentTeacher).toHaveBeenCalledTimes(1);
  });

  it('patches the profile without touching localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('teacher-name')).toHaveTextContent('استاد نمونه'));
    fireEvent.click(screen.getByRole('button', { name: 'update-teacher' }));
    await waitFor(() =>
      expect(screen.getByTestId('teacher-name')).toHaveTextContent('نام ویرایش‌شده'),
    );
    // The old dual-write mirrored the profile into localStorage; nothing ever
    // read it back. Storage must stay clean of profile data now.
    const profileWrites = setItemSpy.mock.calls.filter(([key]) =>
      String(key).includes('current_teacher'),
    );
    expect(profileWrites).toHaveLength(0);
    setItemSpy.mockRestore();
  });
});

describe('TeacherProvider — collections', () => {
  it('loads all five collections in parallel and exposes them', async () => {
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('exams')).toHaveTextContent('آزمون ریاضی'));
    expect(screen.getByTestId('students')).toHaveTextContent('علی رضایی');
    expect(screen.getByTestId('exam-status')).toHaveTextContent('ready');
    expect(classService.getClassGroups).toHaveBeenCalledTimes(1);
    expect(studentService.getStudents).toHaveBeenCalledTimes(1);
    expect(questionService.getQuestions).toHaveBeenCalledTimes(1);
    expect(examService.getExams).toHaveBeenCalledTimes(1);
    expect(gradingService.getSubmissions).toHaveBeenCalledTimes(1);
  });

  it('upserts a new exam at the head of the cache', async () => {
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('exams')).toHaveTextContent('آزمون ریاضی'));
    fireEvent.click(screen.getByRole('button', { name: 'upsert-new' }));
    expect(screen.getByTestId('exams')).toHaveTextContent('آزمون جدید|آزمون ریاضی');
  });

  it('replaces an existing exam in place on upsert', async () => {
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('exams')).toHaveTextContent('آزمون ریاضی'));
    fireEvent.click(screen.getByRole('button', { name: 'upsert-existing' }));
    expect(screen.getByTestId('exams')).toHaveTextContent('آزمون ریاضی ویرایش‌شده');
    expect(screen.getByTestId('exams')).not.toHaveTextContent('آزمون ریاضی|');
  });

  it('removes an exam by id', async () => {
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('exams')).toHaveTextContent('آزمون ریاضی'));
    fireEvent.click(screen.getByRole('button', { name: 'remove-exam' }));
    expect(screen.getByTestId('exams')).toHaveTextContent('');
  });

  it('prepends imported students via addStudents', async () => {
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('students')).toHaveTextContent('علی رضایی'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'add-students' }));
    });
    expect(screen.getByTestId('students')).toHaveTextContent('دانش‌آموز دوم|علی رضایی');
  });

  it('marks a failed collection as error and recovers on reload', async () => {
    vi.mocked(questionService.getQuestions).mockRejectedValueOnce(new Error('network down'));
    renderProvider(mockedTeacher);
    await waitFor(() => expect(screen.getByTestId('question-status')).toHaveTextContent('error'));
    fireEvent.click(screen.getByRole('button', { name: 'reload-questions' }));
    await waitFor(() => expect(screen.getByTestId('question-status')).toHaveTextContent('ready'));
    expect(questionService.getQuestions).toHaveBeenCalledTimes(2);
  });
});
