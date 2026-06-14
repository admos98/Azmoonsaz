/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Exam } from '../types';
import { mockQuestions } from './mockQuestions';

export const mockExams: Exam[] = [
  {
    id: 'e-1',
    examCode: '8AF39',
    title: 'امتحان نوبت دوم علوم تجربی پایه هفتم',
    description: 'جامع‌ترین سنجش مباحث فیزیکی، زیستی و شیمی سال هفتم دبیرستان دوره اول',
    grade: 'هفتم',
    subject: 'علوم تجربی',
    duration: 60,
    status: 'active',
    teacherId: 't-1',
    createdAt: '2026-06-10T08:00:00Z',
    classGroupIds: ['c-1', 'c-2'],
    settings: {
      mode: 'official',
      durationMinutes: 60,
      startTime: '2026-06-15T09:00:00Z',
      endTime: '2026-06-15T11:00:00Z',
      shuffleQuestions: true,
      shuffleOptions: true,
      allowBacktrack: true,
      showImmediateResults: false,
      maxAttempts: 1,
      browserLockdown: true,
    },
    sections: [
      {
        id: 'sec-1',
        title: 'بخش اول: سوالات تستی و چندگزینه‌ای',
        questionIds: ['q-1', 'q-2', 'q-11', 'q-12'],
      },
      {
        id: 'sec-2',
        title: 'بخش دوم: سوالات تکمیلی و مفهومی',
        questionIds: ['q-3', 'q-6', 'q-10'],
      },
    ],
    questions: [
      mockQuestions[0], // q-1 (single_choice math, but listed here as part of physical math logic)
      mockQuestions[1], // q-2 (multiple_choice)
      mockQuestions[10], // q-11 (image_based cell photosynthesis)
      mockQuestions[11], // q-12 (single_choice image options)
      mockQuestions[2], // q-3 (true_false)
      mockQuestions[5], // q-6 (fill_blank)
      mockQuestions[9], // q-10 (reading_comprehension)
    ],
  },
  {
    id: 'e-2',
    examCode: '5D1E2',
    title: 'آزمون تمرینی ادبیات فارسی و نگارش',
    description: 'تمرینی و خودارزیابی جهت آمادگی امتحانات هماهنگ استانی قرابت معنایی و تاریخ ادبیات',
    grade: 'نهم',
    subject: 'ادبیات فارسی',
    duration: 40,
    status: 'scheduled',
    teacherId: 't-1',
    createdAt: '2026-06-12T14:00:00Z',
    classGroupIds: ['c-4'],
    settings: {
      mode: 'practice',
      durationMinutes: 40,
      shuffleQuestions: false,
      shuffleOptions: false,
      allowBacktrack: true,
      showImmediateResults: true,
      maxAttempts: 3,
    },
    sections: [
      {
        id: 'sec-1',
        title: 'سنجش قرابت و نگارش',
        questionIds: ['q-5', 'q-8'],
      },
    ],
    questions: [
      mockQuestions[4], // q-5 (ordering)
      mockQuestions[7], // q-8 (long_answer)
    ],
  },
  {
    id: 'e-3',
    examCode: '9K8J7',
    title: 'کوییز تعاریف پایه ریاضی هشتم',
    description: 'ارزیابی سریع مباحث اعداد اول و معادلات جبری فصل دوم',
    grade: 'هشتم',
    subject: 'ریاضی پایه هشتم',
    duration: 15,
    status: 'completed',
    teacherId: 't-1',
    createdAt: '2026-05-20T09:00:00Z',
    classGroupIds: ['c-3'],
    settings: {
      mode: 'official',
      durationMinutes: 15,
      shuffleQuestions: false,
      shuffleOptions: true,
      allowBacktrack: false,
      showImmediateResults: false,
      maxAttempts: 1,
    },
    sections: [
      {
        id: 'sec-1',
        title: 'سوالات تشریحی کوتاه',
        questionIds: ['q-7'],
      },
    ],
    questions: [
      mockQuestions[6], // q-7 (short_answer)
    ],
  },
];

