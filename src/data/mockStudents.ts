/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, ClassGroup } from '../types';

export const mockClassGroups: ClassGroup[] = [
  { id: 'c-1', name: 'کلاس ۷۰۱ (علوم تجربی)', grade: 'هفتم', studentCount: 28 },
  { id: 'c-2', name: 'کلاس ۷۰۲ (ریاضی)', grade: 'هفتم', studentCount: 26 },
  { id: 'c-3', name: 'کلاس ۸۰۱', grade: 'هشتم', studentCount: 30 },
  { id: 'c-4', name: 'کلاس ۹۰۱', grade: 'نهم', studentCount: 25 },
];

// Note: All student accounts and national IDs below are completely simulated/fake dummy records created purely as mock demo templates.
export const mockStudents: Student[] = [
  { id: 's-1', name: 'امیرحسین رضایی (دمو)', nationalId: '0021487654', maskedNationalId: '002***7654', grade: 'هفتم', classGroupId: 'c-1', email: 'amir@example.com', phoneNumber: '09123456789' },
  { id: 's-2', name: 'سارا کریمی (دمو)', nationalId: '0440981234', maskedNationalId: '044***1234', grade: 'هفتم', classGroupId: 'c-1', email: 'sara@example.com', phoneNumber: '09351234567' },
  { id: 's-3', name: 'محمد امین حسینی (دمو)', nationalId: '0019876543', maskedNationalId: '001***6543', grade: 'هفتم', classGroupId: 'c-1', email: 'amin@example.com', phoneNumber: '09197654321' },
  { id: 's-4', name: 'زهرا لطفی (دمو)', nationalId: '1289546210', maskedNationalId: '128***6210', grade: 'هفتم', classGroupId: 'c-2', email: 'zahra@example.com', phoneNumber: '09301112233' },
  { id: 's-5', name: 'علیرضا حسینیان (دمو)', nationalId: '0085421369', maskedNationalId: '008***1369', grade: 'هشتم', classGroupId: 'c-3', email: 'alireza@example.com' },
  { id: 's-6', name: 'مریم احمدی (دمو)', nationalId: '0054784125', maskedNationalId: '005***4125', grade: 'نهم', classGroupId: 'c-4', email: 'maryam@example.com' },
  { id: 's-7', name: 'نیما طاهری (دمو)', nationalId: '2289512354', maskedNationalId: '228***2354', grade: 'هفتم', classGroupId: 'c-2', email: 'nima@example.com' },
  { id: 's-8', name: 'پرنیان راد (دمو)', nationalId: '0035412856', maskedNationalId: '003***2856', grade: 'هشتم', classGroupId: 'c-3', email: 'parnian@example.com' },
];
