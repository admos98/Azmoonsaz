/**
 * Pure-derivation tests for the Exam Results row/stats/filter layer.
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import {
  buildResultStats,
  buildStudentRows,
  filterRows,
  formatAnswerValue,
  type ResultRow,
} from '../../pages/teacher/exam-results/student-rows';
import type { ClassGroup, Exam, Student, Submission } from '../../types';

const exam: Exam = {
  id: 'ex-1',
  title: 'آزمون ریاضی',
  classGroupIds: ['c-1'],
  questions: [
    { id: 'q1', type: 'single_choice', points: 4 } as Exam['questions'][number],
    { id: 'q2', type: 'long_answer', points: 6 } as Exam['questions'][number],
  ],
} as unknown as Exam;

const students = [
  { id: 's1', name: 'علی رضایی', nationalId: '0012345678', classGroupId: 'c-1' },
  { id: 's2', name: 'سارا محمدی', nationalId: '0023456789', classGroupId: 'c-1' },
] as unknown as Student[];

const classGroups = [{ id: 'c-1', name: 'کلاس هفتم الف' }] as unknown as ClassGroup[];

const submission = {
  id: 'sub-1',
  studentId: 's1',
  studentName: 'علی رضایی',
  status: 'graded',
  score: 8,
  maxScore: 10,
  startedAt: '2026-01-01T08:00:00Z',
  submittedAt: '2026-01-01T08:30:00Z',
  answers: [{ questionId: 'q1', isCorrect: true }],
} as unknown as Submission;

describe('buildStudentRows', () => {
  it('pairs cohort students with submissions and fills absent virtuals', () => {
    const rows = buildStudentRows({ exam, submissions: [submission], students, classGroups });
    expect(rows).toHaveLength(2);
    const ali = rows.find((r) => r.studentId === 's1')!;
    expect(ali.isRealSubmission).toBe(true);
    expect(ali.autoScore).toBe(4);
    expect(ali.className).toBe('کلاس هفتم الف');
    const sara = rows.find((r) => r.studentId === 's2')!;
    expect(sara.status).toBe('absent');
    expect(sara.id).toBe('virtual-s2');
    expect(sara.hasDescriptive).toBe(true);
  });

  it('appends backend-only submissions with no cohort match', () => {
    const orphan = { ...submission, id: 'sub-x', studentId: 'ghost' } as unknown as Submission;
    const rows = buildStudentRows({
      exam,
      submissions: [submission, orphan],
      students,
      classGroups,
    });
    const backendRow = rows.find((r) => r.classGroupId === 'backend')!;
    expect(backendRow.className).toBe('ثبت‌شده در بک‌اند');
  });
});

describe('buildResultStats', () => {
  it('computes cohort, participation and correction counts', () => {
    const rows = buildStudentRows({ exam, submissions: [submission], students, classGroups });
    const stats = buildResultStats(rows, exam);
    expect(stats.totalCohortsCount).toBe(2);
    expect(stats.participantsCount).toBe(1);
    expect(stats.absentCount).toBe(1);
    expect(stats.avgScore).toBe('8.0');
    expect(stats.highestScore).toBe(8);
    expect(stats.completedCorrectionCount).toBe(1);
    expect(stats.hasDescriptiveQuestions).toBe(true);
  });
});

describe('filterRows', () => {
  const rows = buildStudentRows({ exam, submissions: [submission], students, classGroups });
  const base = {
    searchQuery: '',
    classFilter: 'all',
    participationFilter: 'all',
    correctionFilter: 'all',
    scoreRangeFilter: 'all',
  };

  it('filters by name search (case-insensitive latin)', () => {
    expect(filterRows(rows, { ...base, searchQuery: 'سارا' })).toHaveLength(1);
  });

  it('filters absent students only', () => {
    const result = filterRows(rows, { ...base, participationFilter: 'absent' });
    expect(result.every((r: ResultRow) => r.status === 'absent')).toBe(true);
  });

  it('score-range filters exclude rows without a score', () => {
    expect(
      filterRows(rows, { ...base, scoreRangeFilter: 'high' }).every(
        (r) => r.status !== 'absent' && r.status !== 'ongoing',
      ),
    ).toBe(true);
  });
});

describe('formatAnswerValue', () => {
  it('renders arrays and objects with Persian comma', () => {
    expect(formatAnswerValue(['a', 'b'])).toBe('a، b');
    expect(formatAnswerValue({ 1: 'x', 2: 'y' })).toBe('x، y');
    expect(formatAnswerValue('')).toBe('');
  });
});
