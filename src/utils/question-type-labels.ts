/**
 * Single canonical Persian display name for every question type.
 * Used by the question bank, exam preview, and answer-sheet renderer so the
 * same type never appears under two different labels.
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { QuestionType } from '../types';

const names: Record<QuestionType, string> = {
  single_choice: 'چهارگزینه‌ای تک‌پاسخ',
  multiple_choice: 'چندگزینه‌ای چندپاسخ',
  true_false: 'درست / نادرست',
  matching: 'وصل‌کردنی',
  ordering: 'مرتب‌سازی ترتیبی',
  fill_blank: 'جای خالی (کوتاه)',
  short_answer: 'پاسخ کوتاه',
  long_answer: 'تشریحی (طرح درس)',
  cloze: 'کلوز تست (Cloze Test)',
  reading_comprehension: 'درک مطلب متنی',
  image_based: 'سوال تصویری',
};

export const getTypeNameInPersian = (type: QuestionType | undefined): string => {
  if (!type) return '';
  return names[type] || 'طرح متفرقه';
};
