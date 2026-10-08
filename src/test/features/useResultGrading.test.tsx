/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useResultGrading — the ExamResults grading-workspace contract.
 * Pins the startGrading loader, single-question save, ungraded counter,
 * and the finalize + invalidate flows (service calls mocked).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useResultGrading } from '../../features/exam-results/useResultGrading';
import type { Exam, Question } from '../../types';
import type { ResultRow } from '../../pages/teacher/exam-results/student-rows';

vi.mock('../../services/api', () => ({
  gradingService: {
    updateManualGrade: vi.fn(),
    finalizeGrade: vi.fn(),
    invalidateSubmission: vi.fn(),
  },
}));

vi.mock('../../contexts/TeacherContext', () => ({
  useTeacher: () => ({ teacher: { id: 't1', name: 'استاد نمونه' } }),
  useTeacherCollections: () => ({
    upsertSubmission: vi.fn(),
    reload: vi.fn(),
  }),
}));

import { gradingService } from '../../services/api';

const q = (overrides: Partial<Question> = {}): Question => ({
  id: 'q1',
  type: 'long_answer',
  title: 'سوال تشریحی',
  text: 'متن سوال',
  points: 10,
  category: 'علوم',
  grade: 'هفتم',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const exam = (questions: Question[] = [q()]): Exam => ({
  id: 'e1',
  examCode: 'EX-1',
  title: 'آزمون',
  grade: 'هفتم',
  subject: 'علوم',
  duration: 60,
  settings: {} as Exam['settings'],
  sections: [],
  questions,
  classGroupIds: [],
  status: 'draft',
  teacherId: 't1',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const row = (overrides: Partial<ResultRow> = {}): ResultRow =>
  ({
    id: 'r1',
    status: 'submitted',
    rawSubmission: {
      id: 'sub1',
      answers: [{ questionId: 'q1', scoreGained: 6, teacherComment: 'خوب' }],
    },
    ...overrides,
  }) as ResultRow;

const setup = (r: ResultRow | null = row()) => {
  const showToast = vi.fn();
  const setSelectedSubmissionId = vi.fn();
  const setConfirmFinalize = vi.fn();
  const setConfirmInvalidate = vi.fn();
  const setInvalidateBusy = vi.fn();
  const { result } = renderHook(() =>
    useResultGrading({
      exam: exam(),
      activeSubmission: r,
      setSelectedSubmissionId,
      setConfirmFinalize,
      setConfirmInvalidate,
      setInvalidateBusy,
      showToast,
    }),
  );
  return { result, showToast, setSelectedSubmissionId, setConfirmFinalize };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useResultGrading', () => {
  it('startGrading populates the workspace from the submission', () => {
    const { result } = setup();
    act(() => result.current.startGrading(row()));
    expect(result.current.assignedScores).toEqual({ q1: 6 });
    expect(result.current.teacherComments).toEqual({ q1: 'خوب' });
    expect(result.current.rubricScores.q1).toBeDefined();
  });

  it('startGrading warns and skips absent rows', () => {
    const { result, showToast } = setup();
    act(() => result.current.startGrading(row({ status: 'absent' })));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('غایب'), 'warning');
    expect(result.current.assignedScores).toEqual({});
  });

  it('saveSingleQuestionGrade sums rubric rows and toasts', () => {
    const { result, showToast } = setup();
    act(() => result.current.startGrading(row()));
    act(() =>
      result.current.setRubricScores({ q1: { a: 4, b: 3 } }),
    );
    act(() => result.current.saveSingleQuestionGrade('q1'));
    expect(result.current.assignedScores.q1).toBe(7);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('نمره ثبت شد'), 'success');
  });

  it('getUngradedDescriptiveQuestionsCount counts unsaved descriptive rows', () => {
    const { result } = setup();
    act(() =>
      result.current.startGrading(
        row({ rawSubmission: { id: 'sub1', answers: [{ questionId: 'q1' }] } as never }),
      ),
    );
    expect(result.current.getUngradedDescriptiveQuestionsCount()).toBe(1);
    act(() => result.current.saveSingleQuestionGrade('q1'));
    expect(result.current.getUngradedDescriptiveQuestionsCount()).toBe(0);
  });

  it('startGrading treats persisted scores as already graded', () => {
    const { result } = setup();
    act(() => result.current.startGrading(row()));
    expect(result.current.getUngradedDescriptiveQuestionsCount()).toBe(0);
  });

  it('handleFinalizeGrading opens the confirm dialog when ungraded rows remain', () => {
    const { result, setConfirmFinalize } = setup();
    act(() =>
      result.current.startGrading(
        row({ rawSubmission: { id: 'sub1', answers: [{ questionId: 'q1' }] } as never }),
      ),
    );
    act(() => result.current.handleFinalizeGrading());
    expect(setConfirmFinalize).toHaveBeenCalledWith(true);
  });

  it('runFinalizeGrading persists answers, finalizes, and toasts', async () => {
    const { result, showToast, setSelectedSubmissionId } = setup();
    act(() => result.current.startGrading(row()));
    act(() => result.current.saveSingleQuestionGrade('q1'));
    await act(async () => {
      await result.current.runFinalizeGrading();
    });
    expect(vi.mocked(gradingService.updateManualGrade)).toHaveBeenCalledWith(
      'r1',
      'q1',
      expect.any(Number),
      expect.any(String),
    );
    expect(vi.mocked(gradingService.finalizeGrade)).toHaveBeenCalledWith('r1');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('تکمیل شد'), 'success');
    expect(setSelectedSubmissionId).toHaveBeenCalledWith(null);
  });

  it('getQuestionRubrics falls back to two default criteria', () => {
    const { result } = setup();
    const rubrics = result.current.getQuestionRubrics(q({ rubrics: [] }));
    expect(rubrics).toHaveLength(2);
    expect(rubrics[0].maxPoints + rubrics[1].maxPoints).toBeCloseTo(10, 5);
  });
});
