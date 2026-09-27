/**
 * Pure derivation layer for the Exam Results page: cohort row building,
 * overview stats, filter pipeline, and CSV serialization. No React, no
 * side effects — everything is (inputs) => outputs so the page component
 * stays thin and the logic stays unit-testable.
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { ClassGroup, Exam, Student, Submission } from '../../../types';

export type ResultRowStatus = 'ongoing' | 'submitted' | 'graded' | 'absent';

export interface ResultRow {
  id: string;
  isRealSubmission: boolean;
  studentId: string;
  studentName: string;
  nationalId: string;
  maskedNationalId: string;
  classGroupId: string;
  className: string;
  status: ResultRowStatus;
  startedAt: string | null;
  submittedAt: string | null;
  score: number;
  autoScore: number;
  maxScore: number;
  hasDescriptive: boolean;
  rawSubmission: Submission | null;
}

export const formatAnswerValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(String).join('، ');
  if (typeof value === 'object')
    return Object.values(value as Record<string, unknown>).join('، ');
  return String(value);
};

const hasDescriptiveQuestion = (exam: Exam) =>
  exam.questions.some((q) => q.type === 'long_answer' || q.type === 'short_answer');

const examMaxScore = (exam: Exam) => exam.questions.reduce((sum, q) => sum + q.points, 0);

/** Pair the effective cohort with submissions; append backend-only rows last. */
export const buildStudentRows = ({
  exam,
  submissions,
  students,
  classGroups,
}: {
  exam: Exam;
  submissions: Submission[];
  students: Student[];
  classGroups: ClassGroup[];
}): ResultRow[] => {
  const cohortRows = students.map((student) => {
    const sub = submissions.find((s) => s.studentId === student.id);
    const classGroup = classGroups.find((c) => c.id === student.classGroupId);

    // Auto-calculate objective score vs descriptive
    let hasDescriptive = false;
    let autoScore = 0;

    if (sub) {
      exam.questions.forEach((q) => {
        const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
        if (isDescriptive) {
          hasDescriptive = true;
        } else {
          const ans = sub.answers.find((a) => a.questionId === q.id);
          if (ans?.isCorrect) {
            autoScore += q.points;
          }
        }
      });

      return {
        id: sub.id,
        isRealSubmission: true,
        studentId: student.id,
        studentName: student.name,
        nationalId: student.nationalId,
        maskedNationalId:
          student.maskedNationalId ||
          `${student.nationalId.slice(0, 3)}***${student.nationalId.slice(7)}`,
        classGroupId: student.classGroupId,
        className: classGroup ? classGroup.name : 'کلاس عمومی',
        status: sub.status as ResultRowStatus,
        startedAt: sub.startedAt,
        submittedAt: sub.submittedAt,
        score: sub.score,
        autoScore: autoScore,
        maxScore: sub.maxScore || examMaxScore(exam),
        hasDescriptive,
        rawSubmission: sub,
      };
    }

    // Virtual absent student
    return {
      id: `virtual-${student.id}`,
      isRealSubmission: false,
      studentId: student.id,
      studentName: student.name,
      nationalId: student.nationalId,
      maskedNationalId:
        student.maskedNationalId ||
        `${student.nationalId.slice(0, 3)}***${student.nationalId.slice(7)}`,
      classGroupId: student.classGroupId,
      className: classGroup ? classGroup.name : 'کلاس عمومی',
      status: 'absent' as const,
      startedAt: null,
      submittedAt: null,
      score: 0,
      autoScore: 0,
      maxScore: examMaxScore(exam),
      hasDescriptive: hasDescriptiveQuestion(exam),
      rawSubmission: null,
    };
  });

  // Submissions recorded in the backend with no matching cohort student
  const backendOnlyRows: ResultRow[] = submissions
    .filter((sub) => !cohortRows.some((row) => row.rawSubmission?.id === sub.id))
    .map((sub) => ({
      id: sub.id,
      isRealSubmission: true,
      studentId: sub.studentId,
      studentName: sub.studentName,
      nationalId: sub.nationalId || '',
      maskedNationalId:
        (sub as unknown as { maskedNationalId?: string }).maskedNationalId || '***',
      classGroupId: 'backend',
      className: 'ثبت‌شده در بک‌اند',
      status: sub.status as ResultRowStatus,
      startedAt: sub.startedAt,
      submittedAt: sub.submittedAt,
      score: sub.score,
      autoScore: sub.score,
      maxScore: sub.maxScore || examMaxScore(exam),
      hasDescriptive: hasDescriptiveQuestion(exam),
      rawSubmission: sub,
    }));

  return [...backendOnlyRows, ...cohortRows];
};

export interface ResultStats {
  totalCohortsCount: number;
  participantsCount: number;
  absentCount: number;
  avgScore: string;
  highestScore: number;
  needsCorrectionCount: number;
  completedCorrectionCount: number;
  hasDescriptiveQuestions: boolean;
}

export const buildResultStats = (rows: ResultRow[], exam: Exam): ResultStats => {
  const totalCohortsCount = rows.length;
  const participantsCount = rows.filter((r) => r.status !== 'absent').length;
  const absentCount = totalCohortsCount - participantsCount;
  const evaluatedSubmissions = rows.filter((r) => r.status === 'graded');
  const activeSubmitted = rows.filter((r) => r.status === 'submitted');

  // Calculate avg & high scores amongst submitted / graded
  const scoringGradedSheets = rows.filter(
    (r) => r.status === 'submitted' || r.status === 'graded',
  );
  const avgScore =
    scoringGradedSheets.length > 0
      ? (
          scoringGradedSheets.reduce((sum, s) => sum + s.score, 0) / scoringGradedSheets.length
        ).toFixed(1)
      : '۰';

  return {
    totalCohortsCount,
    participantsCount,
    absentCount,
    avgScore,
    highestScore:
      scoringGradedSheets.length > 0
        ? Math.max(...scoringGradedSheets.map((s) => s.score))
        : 0,
    needsCorrectionCount: activeSubmitted.length,
    completedCorrectionCount: evaluatedSubmissions.length,
    hasDescriptiveQuestions: hasDescriptiveQuestion(exam),
  };
};

export interface ResultFilters {
  searchQuery: string;
  classFilter: string;
  participationFilter: string;
  correctionFilter: string;
  scoreRangeFilter: string;
}

export const filterRows = (rows: ResultRow[], filters: ResultFilters): ResultRow[] =>
  rows.filter((row) => {
    // 1. Search name
    if (filters.searchQuery.trim() !== '') {
      if (!row.studentName.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
    }
    // 2. Class Group Filter
    if (filters.classFilter !== 'all') {
      if (row.classGroupId !== filters.classFilter) {
        return false;
      }
    }
    // 3. Participation Status Filter
    if (filters.participationFilter !== 'all') {
      if (
        filters.participationFilter === 'submitted' &&
        row.status !== 'submitted' &&
        row.status !== 'graded'
      )
        return false;
      if (filters.participationFilter === 'absent' && row.status !== 'absent') return false;
      if (filters.participationFilter === 'ongoing' && row.status !== 'ongoing') return false;
    }
    // 4. Correction Status Filter
    if (filters.correctionFilter !== 'all') {
      if (filters.correctionFilter === 'graded' && row.status !== 'graded') return false;
      if (filters.correctionFilter === 'needs_grading' && row.status !== 'submitted')
        return false;
    }
    // 5. Score Range Filter
    if (filters.scoreRangeFilter !== 'all') {
      if (row.status === 'absent' || row.status === 'ongoing') return false;
      const pct = row.maxScore > 0 ? (row.score / row.maxScore) * 100 : 0;
      if (filters.scoreRangeFilter === 'high' && pct < 80) return false;
      if (filters.scoreRangeFilter === 'mid' && (pct < 50 || pct >= 80)) return false;
      if (filters.scoreRangeFilter === 'low' && pct >= 50) return false;
    }
    return true;
  });

/** Excel CSV Export (with Persian BOM support for MS Excel). */
export const buildResultsCsv = (examTitle: string, rows: ResultRow[]): void => {
  let csvData = '\uFEFF'; // UTF-8 byte order mark to display Persian characters flawlessly in MS Excel

  // Headers
  csvData +=
    'نام دانش‌آموز,کد ملی دانش‌آموز,گروه کلاسی,وضعیت شرکت در آزمون,ساعت شروع,ساعت ارسال پاسخ‌برگ,نمره آزمون تستی (خودکار),بارم نمره نهایی\n';

  rows.forEach((row) => {
    const startStr = row.startedAt
      ? new Date(row.startedAt).toLocaleTimeString('fa-IR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'غایب';
    const submitStr = row.submittedAt
      ? new Date(row.submittedAt).toLocaleTimeString('fa-IR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'غایب';

    const pStatus =
      row.status === 'graded'
        ? 'تصحیح شده'
        : row.status === 'submitted'
          ? 'ارسال شده (در انتظار تصحیح)'
          : row.status === 'ongoing'
            ? 'در حال آزمون'
            : 'غایب / بدون پاسخ‌برگ';

    csvData += `"${row.studentName}","${row.nationalId}","${row.className}","${pStatus}","${startStr}","${submitStr}",${row.autoScore},${row.score}\n`;
  });

  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `کارنامه_برخط_آزمون_${examTitle.replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
