/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Real-time validations list to assist teacher before publish — moved
 * verbatim from src/pages/teacher/ExamSettings.tsx as a pure function.
 * The page threads the derived values the closure previously captured.
 */
import { Exam } from '../../types';
import { toPersianDigits } from '../../utils/persian';

interface ValidationContext {
  questionsCount: number;
  startDate: string;
  startHour: string;
  durationMinutes: number;
  allowedClasses: string[];
  limitToSpecificStudents: boolean;
  allowedStudents: string[];
  longAnswersMissingRubric: Exam['questions'];
}

export function getValidationErrors({
  questionsCount,
  startDate,
  startHour,
  durationMinutes,
  allowedClasses,
  limitToSpecificStudents,
  allowedStudents,
  longAnswersMissingRubric,
}: ValidationContext): string[] {
 const errors: string[] = [];

 // Blocker 1: No questions in exam
 if (questionsCount === 0) {
 errors.push('ورقه آزمون فاقد سوال است. ابتدا سوالات آزمون را در بخش ویرایش برگه اضافه کنید.');
 }

 // Blocker 2: Start Date/hour missing
 if (!startDate || !startHour) {
 errors.push('تاریخ یا ساعت مشخص شروع مجاز آزمون تعیین نگردیده است.');
 }

 // Blocker 3: Duration missing or invalid
 if (!durationMinutes || durationMinutes <= 0) {
 errors.push('مدت زمان پاسخ‌دهی باید عددی بزرگتر از صفر (دقیقه) باشد.');
 }

 // Blocker 4: No classes or students selected
 if (allowedClasses.length === 0) {
 errors.push('دسترسی هیچ کلاس یا پایه درسی برای این آزمون فعال نگردیده است.');
 } else if (limitToSpecificStudents && allowedStudents.length === 0) {
 errors.push('محدودسازی به دانش‌آموزان فعال است، اما هیچ دانش‌آموزی علامت نخورده است.');
 }

 // Blocker 5: Descriptive questions missing rubric metrics
 if (longAnswersMissingRubric.length > 0) {
 longAnswersMissingRubric.forEach((q, idx) => {
 errors.push(
 `سوال تشریحی شماره ${toPersianDigits(idx + 1)} («${q.title || 'بدون عنوان'}») فاقد بارم معیارهای ارزیابی است.`,
 );
 });
 }

 return errors;
}
