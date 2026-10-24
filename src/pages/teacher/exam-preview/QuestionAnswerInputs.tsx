/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check } from 'lucide-react';
import { FieldLabel, Input, Textarea } from '../../../ui';
import { ResolvedImage } from '../../../components/QuestionImage';
import { toPersianDigits } from '../../../utils/persian';
import type { Question, RubricCriterion } from '../../../types';
import type { StudentAnswerValue } from '../../../components/student-questions/types';

type QuestionAnswerInputsProps = {
  q: Question;
  viewMode: 'teacher' | 'student';
  studentAnswers: Record<string, StudentAnswerValue>;
  handleStudentAnswerChange: (qId: string, val: StudentAnswerValue) => void;
  textAnswerOf: (qId: string) => string;
};

export function QuestionAnswerInputs({
 q,
 viewMode,
 studentAnswers,
 handleStudentAnswerChange,
 textAnswerOf,
}: QuestionAnswerInputsProps) {
 const _hasImage = !!q.imageUrl;
 const optionsHaveImages = q.options?.some((o) => o.imageUrl);
 const isLongAnswer = q.type === 'long_answer';
 const isShortAnswer = q.type === 'short_answer';
 const isFillBlank = q.type === 'fill_blank';

 return (
 <>
 {/* 1. Choices / Options render */}
 {(q.type === 'single_choice' ||
 q.type === 'multiple_choice' ||
 q.type === 'image_based') &&
 q.options && (
 <div
 className={`mt-3 ${optionsHaveImages ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2'}`}
 >
 {q.options.map((opt) => {
 const isCorrectOption =
 opt.isCorrect ||
 q.correctAnswer === opt.id ||
 (Array.isArray(q.correctAnswer) &&
 q.correctAnswer.includes(opt.id));
 // CQ-1 (strict) fix: narrow once through a local so Array.isArray holds.
 const currentAnswer = studentAnswers[q.id];
 const currentSelected =
 currentAnswer === opt.id ||
 (Array.isArray(currentAnswer) && currentAnswer.includes(opt.id));

 return (
 <div
 key={opt.id}
 onClick={() => {
 if (viewMode === 'student') {
 if (q.type === 'multiple_choice') {
 // CQ-1 (strict) fix: pick the array branch of the answer union explicitly.
 const prevAnswer = studentAnswers[q.id];
 const old: string[] = Array.isArray(prevAnswer) ? prevAnswer : [];
 const next = old.includes(opt.id)
 ? old.filter((x) => x !== opt.id)
 : [...old, opt.id];
 handleStudentAnswerChange(q.id, next);
 } else {
 handleStudentAnswerChange(q.id, opt.id);
 }
 }
 }}
 className={`p-3.5 rounded-xl border text-caption cursor-pointer transition-all flex flex-col justify-between ${
 viewMode === 'teacher' && isCorrectOption
 ? 'bg-[var(--color-success-soft)]/70 border-[var(--color-success)]/30 text-[var(--color-success)] font-semibold shadow-3xs'
 : currentSelected && viewMode === 'student'
 ? 'btn-glass btn-glass--accent font-semibold'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 <div className="flex items-start gap-2.5">
 <div className="pt-0.5">
 {q.type === 'multiple_choice' ? (
 <div
 className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
 (viewMode === 'teacher' && isCorrectOption) ||
 (viewMode === 'student' && currentSelected)
 ? 'btn-glass btn-glass--accent'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 <Check className="w-3 h-3" />
 </div>
 ) : (
 <div
 className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
 (viewMode === 'teacher' && isCorrectOption) ||
 (viewMode === 'student' && currentSelected)
 ? 'btn-glass btn-glass--accent'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-surface)]" />
 </div>
 )}
 </div>
 <div className="space-y-2 flex-1 text-right">
 <span className="leading-relaxed">{opt.text}</span>

 {opt.imageUrl && (
 <div className="mt-2 block max-w-xs">
 <ResolvedImage
 value={opt.imageUrl}
 alt="گزینه"
 className="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 w-full bg-[var(--color-surface)]"
 imgClassName="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 object-contain bg-[var(--color-surface)] w-full"
 />
 </div>
 )}
 </div>
 </div>

 {viewMode === 'teacher' && isCorrectOption && (
 <div className="mr-6 mt-2 flex items-center gap-1 text-micro text-[var(--color-success)]">
 <Check className="w-3.5 h-3.5" />
 <span>گزینه کلید پاسخ صحیح (معلم)</span>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 {/* 2. True False Option render */}
 {q.type === 'true_false' && (
 <div className="flex gap-4 mt-2">
 {[
 { label: 'صحیح / درست', val: true },
 { label: 'غلط / نادرست', val: false },
 ].map((item, idx) => {
 const isCorrect = q.correctAnswer === item.val;
 const isSelected = studentAnswers[q.id] === item.val;

 return (
 <div
 key={idx}
 onClick={() => {
 if (viewMode === 'student') {
 handleStudentAnswerChange(q.id, item.val);
 }
 }}
 className={`flex-1 p-3.5 rounded-xl border text-center font-bold text-caption flex items-center justify-center cursor-pointer gap-2 ${
 viewMode === 'teacher' && isCorrect
 ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/30 text-[var(--color-success)] shadow-3xs'
 : viewMode === 'student' && isSelected
 ? 'btn-glass btn-glass--accent'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 <span>{item.label}</span>
 {((viewMode === 'teacher' && isCorrect) ||
 (viewMode === 'student' && isSelected)) && (
 <span className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] p-0.5 rounded-full">
 <Check className="w-3 h-3" />
 </span>
 )}
 </div>
 );
 })}
 </div>
 )}

 {/* 3. Short Answer Area */}
 {isShortAnswer && (
 <div className="space-y-2 mt-2">
 <Input
 label="محل پاسخ کوتاه دانش‌آموز:"
 type="text"
 disabled={viewMode === 'teacher'}
 placeholder={
 viewMode === 'teacher'
 ? 'فقط در حالت پیش‌نمایش دانش‌آموز قابل پاسخ‌دهی است...'
 : 'پاسخ کوتاه خود را در اینجا بنویسید...'
 }
 value={textAnswerOf(q.id)}
 onChange={(e) => handleStudentAnswerChange(q.id, e.target.value)}
 />
 {viewMode === 'teacher' && q.correctAnswer && (
 <div className="bg-[var(--color-success-soft)] text-[var(--color-success)] border-l-2 border-[var(--color-success)]/20 p-2 text-micro rounded-md font-medium">
 کلید پاسخ مورد قبول سیستم: «{String(q.correctAnswer)}»
 </div>
 )}
 </div>
 )}

 {/* 4. Long Answer Form / Area */}
 {isLongAnswer && (
 <div className="space-y-3.5 mt-2">
 <Textarea
 label="محل پاسخ تشریحی دانش‌آموز:"
 rows={3}
 disabled={viewMode === 'teacher'}
 placeholder={
 viewMode === 'teacher'
 ? 'فقط در حالت پیش‌نمایش دانش‌آموز قابل پاسخ‌دهی است...'
 : 'پاسخ کامل تشریحی خود را در زیر بنویسید... برای سوالات درس محاسباتی حتماً فرمول‌ها را وارد کنید.'
 }
 value={textAnswerOf(q.id)}
 onChange={(e) => handleStudentAnswerChange(q.id, e.target.value)}
 />

 {/* Rubric evaluation criteria info boxes */}
 {q.rubrics && q.rubrics.length > 0 && (
 <div className="pane rounded-2xl p-4.5 space-y-2.5 text-micro">
 <span className="block font-bold text-[var(--color-text-secondary)]">
 معیارهای توزیع بارم تصحیح معلم:
 </span>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {q.rubrics.map((rub: RubricCriterion) => (
 <div key={rub.id} className="p-3 pane rounded-xl space-y-1">
 <div className="flex justify-between items-center text-[var(--color-text-primary)] border-b border-[var(--color-glass-light-stroke)] pb-1">
 <strong className="font-bold">{rub.title}</strong>
 <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-md px-1.5 py-0.5 text-micro">
 {toPersianDigits(rub.maxPoints)} نمره
 </span>
 </div>
 <p className="text-micro text-[var(--color-text-tertiary)]">
 {rub.description}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* 5. Fill Blank input area */}
 {isFillBlank && (
 <div className="space-y-2 mt-2">
 <FieldLabel>
 محل جایگذاری جاهای خالی:
 </FieldLabel>
 {viewMode === 'student' ? (
 <div className="flex flex-wrap gap-2">
 {(q.correctFillBlanks || ['']).map((_, fIdx) => {
 // CQ-1 (strict) fix: read the union once and pick its array branch —
 // element-access narrowing on a string key does not hold for TS.
 const answerValue = studentAnswers[q.id];
 const blankValues = Array.isArray(answerValue) ? answerValue : [];
 return (
 <div key={fIdx} className="flex items-center gap-1 text-caption">
 <span className="text-[var(--color-text-tertiary)] font-bold">
 جای خالی ({toPersianDigits(fIdx + 1)}):
 </span>
 <input
 type="text"
 placeholder="کلمه گمشده..."
 value={blankValues[fIdx] || ''}
 onChange={(e) => {
 const nextList = [...blankValues];
 nextList[fIdx] = e.target.value;
 handleStudentAnswerChange(q.id, nextList);
 }}
 className="glx field border px-3 py-1.5 rounded-lg text-caption focus:border-[var(--color-accent)]/40 w-28 text-center"
 />
 </div>
 );
 })}
 </div>
 ) : (
 <div className="flex flex-wrap gap-1 bg-[var(--color-success-soft)] p-2 rounded-xl text-micro border border-[var(--color-success)]/10/60 text-[var(--color-success)]">
 <span className="font-bold block mr-2">کلید کل کلمات گمشده:</span>
 {q.correctFillBlanks?.map((word, idx) => (
 <span
 key={idx}
 className="glx field px-2 py-0.5 rounded-md font-bold font-mono text-[var(--color-success)] ml-1"
 >
 {toPersianDigits(idx + 1)}. {word}
 </span>
 ))}
 </div>
 )}
 </div>
 )}
 </>
 );
}
