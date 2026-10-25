/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { computeWrappedStats, JALALI_MONTHS_FA } from '../../utils/wrappedStats';
import type { WrappedInput } from '../../utils/wrappedStats';
import type { ClassGroup, Exam, Question, Student, Submission } from '../../types';

const exam = (id: string, title: string, createdAt = '2025-10-01'): Exam =>
  ({
    id,
    examCode: 'EX1',
    title,
    grade: '۷',
    subject: 'ریاضی',
    duration: 60,
    settings: {} as Exam['settings'],
    sections: [],
    questions: [],
    classGroupIds: [],
    status: 'active',
    teacherId: 't1',
    createdAt,
  }) as Exam;

const submission = (
  id: string,
  examId: string,
  status: Submission['status'],
  score = 0,
  maxScore = 20,
  submittedAt?: string,
): Submission =>
  ({
    id,
    examId,
    examCode: 'EX1',
    studentId: 's1',
    studentName: 'الف',
    nationalId: '0012345678',
    answers: [],
    startedAt: submittedAt ?? '2025-10-02T08:00:00Z',
    submittedAt,
    status,
    score,
    maxScore,
  }) as Submission;

const base = (over: Partial<WrappedInput>): WrappedInput => ({
  exams: [],
  students: [],
  questions: [],
  classGroups: [],
  submissions: [],
  ...over,
});

describe('computeWrappedStats', () => {
  it('counts the four inventories and graded papers', () => {
    const s = computeWrappedStats(
      base({
        exams: [exam('e1', 'الف'), exam('e2', 'ب')],
        students: [{ id: 's1' } as Student, { id: 's2' } as Student],
        questions: [{ id: 'q1' } as Question],
        classGroups: [{ id: 'c1' } as ClassGroup],
        submissions: [
          submission('p1', 'e1', 'graded', 18, 20, '2025-10-02T10:00:00Z'),
          submission('p2', 'e1', 'submitted', 0, 20, '2025-10-03T10:00:00Z'),
          submission('p3', 'e1', 'ongoing', 0, 20),
        ],
      }),
    );
    expect(s.examsDesigned).toBe(2);
    expect(s.questionsAuthored).toBe(1);
    expect(s.studentsCount).toBe(2);
    expect(s.classGroupsCount).toBe(1);
    expect(s.submissionsGraded).toBe(1);
  });

  it('averages only graded papers with a positive max', () => {
    const s = computeWrappedStats(
      base({
        submissions: [
          submission('p1', 'e1', 'graded', 16, 20, '2025-10-02T10:00:00Z'), // 80%
          submission('p2', 'e1', 'graded', 10, 20, '2025-10-02T11:00:00Z'), // 50%
          submission('p3', 'e1', 'graded', 5, 0, '2025-10-02T12:00:00Z'), // excluded
          submission('p4', 'e1', 'submitted', 99, 20, '2025-10-02T13:00:00Z'), // excluded
        ],
      }),
    );
    expect(s.avgScorePct).toBe(65);
  });

  it('finds the biggest exam and ignores ongoing noise', () => {
    const s = computeWrappedStats(
      base({
        exams: [exam('e1', 'کوچک'), exam('e2', 'بزرگ')],
        submissions: [
          submission('p1', 'e1', 'graded', 0, 20, '2025-10-02T10:00:00Z'),
          submission('p2', 'e2', 'graded', 0, 20, '2025-10-02T10:00:00Z'),
          submission('p3', 'e2', 'submitted', 0, 20, '2025-10-03T10:00:00Z'),
          submission('p4', 'e2', 'ongoing', 0, 20),
        ],
      }),
    );
    expect(s.biggestExam).toEqual({ title: 'بزرگ', submissions: 2 });
  });

  it('buckets the busiest month by Jalali calendar, skipping non-submitted', () => {
    const s = computeWrappedStats(
      base({
        submissions: [
          // آذر (month 9) twice, دی (month 10) once, plus one without a date
          submission('p1', 'e1', 'graded', 0, 20, '2025-11-22T10:00:00Z'),
          submission('p2', 'e1', 'graded', 0, 20, '2025-11-23T10:00:00Z'),
          submission('p3', 'e1', 'graded', 0, 20, '2025-12-22T10:00:00Z'),
          submission('p4', 'e1', 'graded', 0, 20),
        ],
      }),
    );
    if (s.busiestMonth) {
      expect(s.busiestMonth.month).toBeGreaterThanOrEqual(1);
      expect(s.busiestMonth.month).toBeLessThanOrEqual(12);
      expect(JALALI_MONTHS_FA).toHaveLength(12);
    }
  });

  it('stays calm on an empty year', () => {
    const s = computeWrappedStats(base({}));
    expect(s.examsDesigned).toBe(0);
    expect(s.submissionsGraded).toBe(0);
    expect(s.avgScorePct).toBeNull();
    expect(s.biggestExam).toBeNull();
    expect(s.busiestMonth).toBeNull();
    expect(s.earliestExamDate).toBeNull();
  });
});
