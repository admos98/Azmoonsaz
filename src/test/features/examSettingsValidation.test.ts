/**
 * getValidationErrors — the ExamSettings publish blockers, extracted to a
 * pure function (CQ-8/CQ-11). Every blocker maps to a Persian message the
 * review panel renders; tests pin the trigger conditions, not the copy.
 */
import { describe, it, expect } from 'vitest';
import { getValidationErrors } from '../../features/exam-settings/validation';
import type { Question } from '../../types';

const VALID = {
  questionsCount: 3,
  startDate: '2026-06-15',
  startHour: '09:00',
  durationMinutes: 45,
  allowedClasses: ['c-1'],
  limitToSpecificStudents: false,
  allowedStudents: [],
  longAnswersMissingRubric: [] as Question[],
};

describe('getValidationErrors', () => {
  it('returns no errors for a fully valid configuration', () => {
    expect(getValidationErrors(VALID)).toEqual([]);
  });

  it('blocker 1: zero questions blocks publish', () => {
    const errors = getValidationErrors({ ...VALID, questionsCount: 0 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('فاقد سوال');
  });

  it('blocker 2: missing start date or hour blocks publish', () => {
    expect(getValidationErrors({ ...VALID, startDate: '' })[0]).toContain('شروع');
    expect(getValidationErrors({ ...VALID, startHour: '' })[0]).toContain('شروع');
  });

  it('blocker 3: zero or negative duration blocks publish', () => {
    expect(getValidationErrors({ ...VALID, durationMinutes: 0 })).toHaveLength(1);
    expect(getValidationErrors({ ...VALID, durationMinutes: -5 })).toHaveLength(1);
  });

  it('blocker 4: no classes selected blocks; student limit without students blocks', () => {
    expect(getValidationErrors({ ...VALID, allowedClasses: [] })).toHaveLength(1);
    const limited = getValidationErrors({
      ...VALID,
      limitToSpecificStudents: true,
      allowedStudents: [],
    });
    expect(limited).toHaveLength(1);
    expect(limited[0]).toContain('دانش‌آموز');
    // student limit WITH students selected is fine
    expect(
      getValidationErrors({
        ...VALID,
        limitToSpecificStudents: true,
        allowedStudents: ['s-1'],
      }),
    ).toEqual([]);
  });

  it('blocker 5: every descriptive question without rubrics produces one numbered error', () => {
    const q = { id: 'q1', title: 'تشریحی بی‌بارم' } as unknown as Question;
    const errors = getValidationErrors({
      ...VALID,
      longAnswersMissingRubric: [q, { ...q, title: undefined }],
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('تشریحی بی‌بارم');
    expect(errors[1]).toContain('بدون عنوان'); // the fallback title
  });

  it('accumulates multiple blockers in order', () => {
    const errors = getValidationErrors({
      ...VALID,
      questionsCount: 0,
      durationMinutes: 0,
      allowedClasses: [],
    });
    expect(errors).toHaveLength(3);
  });
});
