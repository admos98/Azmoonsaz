/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher } from '../types';

export const mockTeacher: Teacher = {
  id: 't-1',
  name: 'حمیدرضا علیزاده',
  email: 'alizadeh@azmoonsaz.ir',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
  schoolName: 'دبیرستان استعدادهای درخشان شهید بهشتی',
};

export const mockTeachers: Teacher[] = [
  mockTeacher,
  {
    id: 't-2',
    name: 'مریم سادات حسینی',
    email: 'hosseini@azmoonsaz.ir',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
    schoolName: 'دبیرستان نمونه دولتی فرزانگان',
  }
];
