/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Submission } from '../types';

export const mockSubmissions: Submission[] = [
  {
    id: 'sub-1',
    examId: 'e-1',
    examCode: '8AF39',
    studentId: 's-1',
    studentName: 'امیرحسین رضایی',
    nationalId: '0021487654',
    startedAt: '2026-06-15T09:05:00Z',
    submittedAt: '2026-06-15T09:50:00Z',
    status: 'submitted',
    score: 0,
    maxScore: 14.5,
    answers: [
      { questionId: 'q-1', answer: 'o2', isCorrect: true, scoreGained: 2 },
      { questionId: 'q-2', answer: ['o1', 'o3'], isCorrect: true, scoreGained: 3 },
      { questionId: 'q-11', answer: 'o2', isCorrect: true, scoreGained: 2.5 },
      { questionId: 'q-3', answer: true, isCorrect: true, scoreGained: 1 },
      { questionId: 'q-6', answer: 'نوشت', isCorrect: true, scoreGained: 2 },
      {
        questionId: 'q-10',
        answer: { 'rd-1': 'rd1_o1', 'rd-2': 'rd2_o2' },
        isCorrect: true,
        scoreGained: 4,
      },
    ],
  },
  {
    id: 'sub-2',
    examId: 'e-1',
    examCode: '8AF39',
    studentId: 's-2',
    studentName: 'سارا کریمی',
    nationalId: '0440981234',
    startedAt: '2026-06-15T09:02:00Z',
    submittedAt: '2026-06-15T09:58:00Z',
    status: 'graded',
    score: 11.5,
    maxScore: 14.5,
    gradedBy: 'حمیدرضا علیزاده',
    gradedAt: '2026-06-15T15:00:00Z',
    answers: [
      { questionId: 'q-1', answer: 'o2', isCorrect: true, scoreGained: 2 },
      { questionId: 'q-2', answer: ['o1'], isCorrect: false, scoreGained: 1.5 },
      { questionId: 'q-11', answer: 'o1', isCorrect: false, scoreGained: 0 },
      { questionId: 'q-3', answer: true, isCorrect: true, scoreGained: 1 },
      { questionId: 'q-6', answer: 'نوشت', isCorrect: true, scoreGained: 2 },
      {
        questionId: 'q-10',
        answer: { 'rd-1': 'rd1_o1', 'rd-2': 'rd2_o3' },
        isCorrect: false,
        scoreGained: 2,
      },
    ],
  },
  {
    id: 'sub-3',
    examId: 'e-1',
    examCode: '8AF39',
    studentId: 's-3',
    studentName: 'محمد امین حسینی',
    nationalId: '0019876543',
    startedAt: '2026-06-15T09:10:00Z',
    status: 'ongoing',
    score: 0,
    maxScore: 14.5,
    answers: [
      { questionId: 'q-1', answer: 'o2' },
      { questionId: 'q-2', answer: ['o1', 'o2'] },
    ],
  },
  {
    id: 'sub-4',
    examId: 'e-2',
    examCode: '5D1E2',
    studentId: 's-6',
    studentName: 'مریم احمدی',
    nationalId: '0054784125',
    startedAt: '2026-06-13T10:00:00Z',
    submittedAt: '2026-06-13T10:35:00Z',
    status: 'submitted',
    score: 3,
    maxScore: 8,
    answers: [
      { questionId: 'q-5', answer: ['مادها (قدیمی‌ترین)', 'هخامنشیان', 'اشکانیان', 'ساسانیان (جدیدترین)'], isCorrect: true, scoreGained: 3 },
      { questionId: 'q-8', answer: 'بیت توانا بود هر که دانا بود نشان‌دهنده این است که علم و دانش به انسان قدرت می‌دهد. در سرتاسر تاریخ مللی که مجهز به علم بوده‌اند توانسته‌اند بر مشکلات خود چیره شوند و رفاه و آرامش را برای مردمشان بیاورند. من فکر می‌کنم علم‌آموزی همواره چراغ راه جوامع است.', teacherComment: 'پاسخ دانش‌آموز بسیار تحلیل زیبایی دارد.' },
    ],
  },
];
