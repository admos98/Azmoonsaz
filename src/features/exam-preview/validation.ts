/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Exam } from '../../types';

export interface ValidationWarning {
 id: string;
 type:
 | 'no_correct_answer'
 | 'no_points'
 | 'descriptive_no_rubric'
 | 'section_no_question'
 | 'image_missing';
 message: string;
 targetId: string; // questionId or sectionId
 targetName: string;
}

 // 1. Dynamic Validation System — pure derived state
export function collectValidationWarnings(localExam: Exam): ValidationWarning[] {
 const list: ValidationWarning[] = [];

 // Analyze empty sections
 localExam.sections.forEach((sec) => {
 if (!sec.questionIds || sec.questionIds.length === 0) {
 list.push({
 id: `sec-em-${sec.id}`,
 type: 'section_no_question',
 message: `بخش «${sec.title}» صدمه دیده یا فاقد هرگونه سوال انتصابی است.`,
 targetId: sec.id,
 targetName: sec.title,
 });
 }
 });

 // Analyze individual questions
 localExam.questions.forEach((q) => {
 // No grade/points check
 if (q.points === undefined || q.points <= 0) {
 list.push({
 id: `q-pt-${q.id}`,
 type: 'no_points',
 message: `سوال «${q.title || 'بدون مشخصه'}» فاقد امتیاز یا بارم عددی است (نمره صفر یا نامعتبر).`,
 targetId: q.id,
 targetName: q.title,
 });
 }

 // No correct answers configured (choice based)
 if (['single_choice', 'multiple_choice', 'true_false', 'image_based'].includes(q.type)) {
 if (q.type === 'true_false' && q.correctAnswer === undefined) {
 list.push({
 id: `q-key-tf-${q.id}`,
 type: 'no_correct_answer',
 message: `سوال درست/نادرست «${q.title}» فاقد کلید ارزش پاسخ صحیح فرضی است.`,
 targetId: q.id,
 targetName: q.title,
 });
 } else if (['single_choice', 'image_based'].includes(q.type) && !q.correctAnswer) {
 list.push({
 id: `q-key-sc-${q.id}`,
 type: 'no_correct_answer',
 message: `سوال چهارگزینه‌ای «${q.title}» فاقد گزینه کلید پاسخ صحیح معرفی شده است.`,
 targetId: q.id,
 targetName: q.title,
 });
 } else if (
 q.type === 'multiple_choice' &&
 (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0)
 ) {
 list.push({
 id: `q-key-mc-${q.id}`,
 type: 'no_correct_answer',
 message: `سوال چندگزینه‌ای چندپاسخ «${q.title}» فاقد حداقل یک کلید درست است.`,
 targetId: q.id,
 targetName: q.title,
 });
 }
 }

 // Long answer without rubric metrics
 if (q.type === 'long_answer' && (!q.rubrics || q.rubrics.length === 0)) {
 list.push({
 id: `q-rub-${q.id}`,
 type: 'descriptive_no_rubric',
 message: `سوال تشریحی تشخیصی «${q.title}» فاقد معیارهای ارزیابی (بارم‌بندی روان) است.`,
 targetId: q.id,
 targetName: q.title,
 });
 }

 // Image Based missing media
 if (q.type === 'image_based' && !q.imageUrl) {
 list.push({
 id: `q-img-${q.id}`,
 type: 'image_missing',
 message: `سوال تصویری «${q.title}» تصویر یا نمودار پیوست بارگذاری شده معتبری ندارد.`,
 targetId: q.id,
 targetName: q.title,
 });
 }
 });

 return list;
}
