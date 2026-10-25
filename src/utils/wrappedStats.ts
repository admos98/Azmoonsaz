/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Wrapped year-stats (Meraj P3) — the pure engine of Azmoonsaz Wrapped.
 * Everything computes from data the teacher's session already owns (exams,
 * students, questions, class groups, submissions); no new endpoints, no PII
 * beyond what the teacher already sees in their own panel.
 *
 * Pure in, pure out — the page renders it, the share card prints it, the
 * tests pin it. A "year" here is the Persian school year the data shows:
 * we bucket by Jalali month, and the card labels the year from the data.
 */

import { jalaliMonth } from '../glass/seasonalGirih';
import type { ClassGroup, Exam, Question, Student, Submission } from '../types';

export interface WrappedInput {
  exams: Exam[];
  students: Student[];
  questions: Question[];
  classGroups: ClassGroup[];
  submissions: Submission[];
}

export interface WrappedStats {
  examsDesigned: number;
  questionsAuthored: number;
  studentsCount: number;
  classGroupsCount: number;
  submissionsGraded: number;
  /** Mean of score/maxScore over graded submissions with a positive max. */
  avgScorePct: number | null;
  biggestExam: { title: string; submissions: number } | null;
  busiestMonth: { month: number; count: number } | null;
  earliestExamDate: string | null;
}

/** Persian month names — display order 1..12 (فروردین..اسفند). */
export const JALALI_MONTHS_FA = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export function computeWrappedStats(input: WrappedInput): WrappedStats {
  const { exams, students, questions, classGroups, submissions } = input;

  const graded = submissions.filter((s) => s.status === 'graded');
  const scored = graded.filter((s) => s.maxScore > 0);
  const avgScorePct =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + s.score / s.maxScore, 0) / scored.length) * 100,
        )
      : null;

  // Biggest exam: graded+submitted participation per exam, minus ongoing noise.
  const perExam = new Map<string, number>();
  for (const s of submissions) {
    if (s.status === 'ongoing') continue;
    perExam.set(s.examId, (perExam.get(s.examId) ?? 0) + 1);
  }
  let biggestExam: WrappedStats['biggestExam'] = null;
  for (const exam of exams) {
    const count = perExam.get(exam.id) ?? 0;
    if (count > 0 && (!biggestExam || count > biggestExam.submissions)) {
      biggestExam = { title: exam.title, submissions: count };
    }
  }

  // Busiest month: Jalali month of submittedAt over submitted+graded.
  const perMonth = new Map<number, number>();
  for (const s of submissions) {
    if (!s.submittedAt || s.status === 'ongoing') continue;
    const m = jalaliMonth(new Date(s.submittedAt));
    if (m === null) continue;
    perMonth.set(m, (perMonth.get(m) ?? 0) + 1);
  }
  let busiestMonth: WrappedStats['busiestMonth'] = null;
  for (const [month, count] of perMonth) {
    if (!busiestMonth || count > busiestMonth.count) {
      busiestMonth = { month, count };
    }
  }

  const earliestExamDate =
    exams.length > 0
      ? exams
          .map((e) => e.createdAt)
          .sort()
          [0] ?? null
      : null;

  return {
    examsDesigned: exams.length,
    questionsAuthored: questions.length,
    studentsCount: students.length,
    classGroupsCount: classGroups.length,
    submissionsGraded: graded.length,
    avgScorePct,
    biggestExam,
    busiestMonth,
    earliestExamDate,
  };
}
