/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Descriptive rubrics evaluation interface: answer sheet, rubric table, teacher feedback, per-question save.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Check, MessageSquare, Save } from 'lucide-react';

import { PillButton } from '../../../../ui';
import { toPersianDigits } from '../../../../utils/persian';
import { formatAnswerValue } from '../student-rows';
import { Question, RubricCriterion, StudentAnswer } from '../../../../types';

interface DescriptiveRubricEditorProps {
 q: Question;
 stdAnswerValue: StudentAnswer['answer'] | undefined;
 savedDescriptiveQuestions: Record<string, boolean>;
 rubricScores: Record<string, Record<string, number>>;
 setRubricScores: Dispatch<SetStateAction<Record<string, Record<string, number>>>>;
 setAssignedScores: Dispatch<SetStateAction<Record<string, number>>>;
 setSavedDescriptiveQuestions: Dispatch<SetStateAction<Record<string, boolean>>>;
 teacherComments: Record<string, string>;
 setTeacherComments: Dispatch<SetStateAction<Record<string, string>>>;
 getQuestionRubrics: (q: Question) => RubricCriterion[];
 saveSingleQuestionGrade: (questionId: string) => void;
}

export function DescriptiveRubricEditor({
 q,
 stdAnswerValue,
 savedDescriptiveQuestions,
 rubricScores,
 setRubricScores,
 setAssignedScores,
 setSavedDescriptiveQuestions,
 teacherComments,
 setTeacherComments,
 getQuestionRubrics,
 saveSingleQuestionGrade,
}: DescriptiveRubricEditorProps) {
 const isGraded = savedDescriptiveQuestions[q.id];
 return (
 /* Extensive Descriptive Rubrics evaluation interface */
 <div className="space-y-4 pane p-4 rounded-2xl" id="descriptive-evaluation">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Student Answer Sheet design */}
 <div className="space-y-1">
 <span className="text-micro text-[var(--color-accent)] block">
 ● برگه دست‌نویس داوطلب:
 </span>
 <div className="pane rounded-xl p-4 text-caption font-bold text-[var(--color-text-primary)] font-sans leading-relaxed whitespace-pre-wrap min-h-[110px]">
 {formatAnswerValue(stdAnswerValue) || (
 <span className="text-[var(--color-text-tertiary)] font-normal">
 ورقه سفید رها شده است.
 </span>
 )}
 </div>
 </div>

 {/* Perfect Farsi Sample template */}
 <div className="space-y-1">
 <span className="text-micro text-[var(--color-success)] block">
 ✔ پاسخ نمونه طراح (کلید تشریحی):
 </span>
 <div className="bg-[var(--color-success-soft)]/20 border border-[var(--color-success)]/15 rounded-xl p-4 text-caption text-[var(--color-text-secondary)] leading-relaxed min-h-[110px]">
 {q.correctAnswer
 ? String(q.correctAnswer)
 : 'تحلیل مستند و حاوی واژگان علمی مقتضی نمره بالا بر اساس توفیقات درسی ملاک است.'}
 <div className="mt-3 text-label-muted border-t border-[var(--color-glass-light-stroke)]/50 pt-2 leading-5">
 <span>
 کتاب درسی: مبحث مرتبط با ردیف درستی محتوایی آزمون سراسری امسال.
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* 5. SPECIFICATION REQ: Rubric criteria table for descriptive evaluation */}
 <div className="space-y-2.5 pane p-4 rounded-xl">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--color-danger)]/10/60 pb-2">
 <span className="text-micro text-[var(--color-danger)]/80 block">
 جدول بارم‌بندی تفصیلی تصحیح (Rubrics):
 </span>
 </div>

 {/* Horizontal scroll instead of page overflow: the
 rubric's fixed w-24/w-32 columns exceed a 360px
 viewport (phone QA sweep). */}
 <div className="overflow-x-auto">
 <table
 className="w-full text-micro text-right"
 id={`rubric-tab-${q.id}`}
 >
 <thead>
 <tr className="text-[var(--color-text-tertiary)] font-bold border-b border-[var(--color-glass-light-stroke)]">
 <th className="py-2">معیار ارزیابی</th>
 <th className="py-2 text-center w-24">حداکثر بارم</th>
 <th className="py-2 text-left w-32">نمره تخصیصی دبیر</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--color-glass-light-stroke)]">
 {getQuestionRubrics(q).map((rubric) => {
 // Live-reactive state allocation variables
 const currentScoreObj = rubricScores[q.id] || {};
 const scoreVal = currentScoreObj[rubric.id] ?? 0;

 return (
 <tr
 key={rubric.id}
 className="text-[var(--color-text-secondary)] font-semibold"
 >
 <td className="py-3">
 <div className="font-bold text-[var(--color-text-primary)]">
 {rubric.title}
 </div>
 <div className="text-micro text-[var(--color-text-tertiary)] mt-0.5 font-normal leading-relaxed">
 {rubric.description}
 </div>
 </td>
 <td className="py-3 text-center font-bold text-[var(--color-text-secondary)] text-caption">
 {toPersianDigits(rubric.maxPoints)} امتیاز
 </td>
 <td className="py-3 text-left">
 <input
 type="number"
 min={0}
 max={rubric.maxPoints}
 step={0.25}
 value={scoreVal}
 onChange={(e) => {
 const keyInput = Math.min(
 rubric.maxPoints,
 Math.max(0, Number(e.target.value)),
 );
 setRubricScores((prev) => ({
 ...prev,
 [q.id]: {
 ...(prev[q.id] || {}),
 [rubric.id]: keyInput,
 },
 }));

 // Auto sync sum to the total assigned scores
 const subTotal = {
 ...(rubricScores[q.id] || {}),
 [rubric.id]: keyInput,
 };
 const totalManual = (
 Object.values(subTotal) as number[]
 ).reduce((sum, s) => sum + s, 0);
 setAssignedScores((prev) => ({
 ...prev,
 [q.id]: Number(totalManual.toFixed(2)),
 }));

 // Reset saved status since score changed
 setSavedDescriptiveQuestions((prev) => ({
 ...prev,
 [q.id]: false,
 }));
 }}
 className="w-20 px-2 py-1.5 border rounded-lg glx field text-center text-[var(--color-text-primary)] text-label focus:ring-1 focus:ring-[var(--color-accent)]/40 font-mono"
 />
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>

 {/* Feedback text row */}
 <div className="space-y-1.5" id="teacher-comment-box">
 <label className="text-label-muted block flex items-center gap-1">
 <MessageSquare className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
 <span>بازخورد و رهنمود دبیر به صورت تفصیلی:</span>
 </label>
 <textarea
 rows={2}
 value={teacherComments[q.id] || ''}
 onChange={(e) => {
 setTeacherComments({
 ...teacherComments,
 [q.id]: e.target.value,
 });
 // Reset saved status since score changed
 setSavedDescriptiveQuestions((prev) => ({
 ...prev,
 [q.id]: false,
 }));
 }}
 placeholder="رهنمودهای آموزشی خود را بنویسید (مثال: پاراگراف اول فاقد مستند بومی است، بقیه بخش‌ها غنی بود)."
 className="w-full glx field border text-caption text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:border-[var(--color-accent)]/40 leading-relaxed transition-colors"
 />
 </div>

 {/* Save single question button */}
 <div className="flex justify-end pt-2 border-t border-[var(--color-glass-light-stroke)]/50">
 <PillButton
 fill={isGraded ? 'success-soft' : 'accent-solid'}
 size="none"
 radius="lg"
 text="micro"
 weight="black"
 onClick={() => saveSingleQuestionGrade(q.id)}
 className={`px-4.5 py-2.5 transition-all flex items-center gap-2 ${
 isGraded
 ? 'border border-[var(--color-success)]/20'
 : 'hover:bg-[var(--color-accent-solid-hover)]'
 }`}
 >
 {isGraded ? (
 <Check className="w-4 h-4" />
 ) : (
 <Save className="w-4 h-4" />
 )}
 <span>
 {isGraded ? 'نمره این سوال تایید و قفل شد' : 'ثبت نمره این سوال'}
 </span>
 </PillButton>
 </div>
 </div>
 );

}
