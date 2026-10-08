/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Shared question-bank types — moved out of Questions.tsx unchanged. */
import { Question } from '../../types';

// Local enhanced interface to handle optional tags, chapters, difficulty, and completeness statuses
export interface RichQuestion extends Question {
  difficulty?: 'easy' | 'medium' | 'hard'; // آسان، متوسط، سخت
  tags?: string[]; // برچسب‌ها
  section?: string; // بخش / فصل
  completenessStatus?: 'complete' | 'incomplete'; // وضعیت کامل بودن
  explanation?: string; // توضیح پاسخ تشریحی / پاسخ کاغذی
  sampleAnswer?: string; // پاسخ نمونه تشریحی
}
