/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Objective grading review widget: student answer vs exam key + auto-score badge.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { Check, X } from 'lucide-react';

import { toPersianDigits } from '../../../../utils/persian';
import { Question, StudentAnswer } from '../../../../types';

interface ObjectiveAnswerReviewProps {
 q: Question;
 stdAnsObj: StudentAnswer | undefined;
 stdAnswerValue: StudentAnswer['answer'] | undefined;
}

export function ObjectiveAnswerReview({
 q,
 stdAnsObj,
 stdAnswerValue,
}: ObjectiveAnswerReviewProps) {
 return (
 /* Objective grading review widget */
 <div
 className="space-y-3.5 pane p-4 rounded-2xl"
 id="objective-grading-review"
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Student Answer */}
 <div className="space-y-1">
 <span className="text-micro text-[var(--color-danger)] block">
 ● کاندید انتخابی دانش‌آموز:
 </span>
 <div className="pane rounded-xl p-3 text-caption font-bold text-[var(--color-text-secondary)]">
 {stdAnsObj ? (
 q.type === 'single_choice' ? (
 q.options?.find((o) => o.id === stdAnswerValue)?.text ||
 `گزینه ${toPersianDigits(String(stdAnswerValue))}`
 ) : q.type === 'multiple_choice' &&
 Array.isArray(stdAnswerValue) ? (
 stdAnswerValue
 .map(
 (val) => q.options?.find((o) => o.id === val)?.text || val,
 )
 .join(' ، ')
 ) : q.type === 'true_false' ? (
 stdAnswerValue ? (
 'صحیح (درست)'
 ) : (
 'غلط (نادرست)'
 )
 ) : q.type === 'ordering' && Array.isArray(stdAnswerValue) ? (
 <div className="flex flex-wrap gap-1 mt-1">
 {stdAnswerValue.map((item, orIdx) => (
 <span
 key={orIdx}
 className="glx-inset border px-2 py-0.5 rounded text-micro font-mono"
 >
 {toPersianDigits(orIdx + 1)}. {item}
 </span>
 ))}
 </div>
 ) : q.type === 'matching' &&
 typeof stdAnswerValue === 'object' ? (
 <div className="space-y-1 mt-1 text-micro font-semibold text-[var(--color-text-secondary)]">
 {Object.entries(stdAnswerValue).map(([k, v]) => (
 <div key={k}>
 🔗 «{k}» وصل شده به «{String(v)}»
 </div>
 ))}
 </div>
 ) : (
 String(stdAnswerValue)
 )
 ) : (
 <span className="text-[var(--color-text-tertiary)]">
 بدون جواب (خالی رها شده)
 </span>
 )}
 </div>
 </div>

 {/* Correct Key */}
 <div className="space-y-1">
 <span className="text-micro text-[var(--color-success)] block">
 ✔ کلید پاسخ آزمون‌ساز:
 </span>
 <div className="pane border-[var(--color-success)]/10 rounded-xl p-3 text-caption font-bold text-[var(--color-text-secondary)]">
 {q.type === 'single_choice' ? (
 q.options?.find((o) => o.id === q.correctAnswer)?.text ||
 `گزینه ${toPersianDigits(q.correctAnswer as string)}`
 ) : q.type === 'multiple_choice' &&
 Array.isArray(q.correctAnswer) ? (
 q.correctAnswer
 .map((val) => q.options?.find((o) => o.id === val)?.text || val)
 .join(' ، ')
 ) : q.type === 'true_false' ? (
 q.correctAnswer ? (
 'صحیح (درست)'
 ) : (
 'غلط (نادرست)'
 )
 ) : q.type === 'ordering' && Array.isArray(q.orderingItems) ? (
 <div className="flex flex-wrap gap-1 mt-1">
 {q.orderingItems.map((item, orIdx) => (
 <span
 key={orIdx}
 className="bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10 px-2 py-0.5 rounded text-micro font-mono"
 >
 {toPersianDigits(orIdx + 1)}. {item}
 </span>
 ))}
 </div>
 ) : q.type === 'matching' && q.matchingPairs ? (
 <div className="space-y-1 mt-1 text-micro font-semibold text-[var(--color-text-secondary)]">
 {q.matchingPairs.map((pair, pIdx) => (
 <div key={pIdx}>
 🔗 «{pair.left}» به «{pair.right}»
 </div>
 ))}
 </div>
 ) : (
 String(
 q.correctAnswer || q.correctFillBlanks?.join('، ') || 'نامشخص',
 )
 )}
 </div>
 </div>
 </div>

 {/* Interactive Score result feedback badge */}
 <div className="pt-2 border-t border-[var(--color-glass-light-stroke)]/60 mt-1 flex justify-between items-center text-micro">
 <span className="text-[var(--color-text-tertiary)]">
 رتبه‌بندی نمره‌دهی خودکار سیستم:
 </span>
 {stdAnsObj?.isCorrect ? (
 <span className="text-[var(--color-success)] flex items-center gap-1.5 bg-[var(--color-success-soft)]/40 px-3 py-1 rounded-xl border border-[var(--color-success)]/15">
 <Check className="w-4 h-4 stroke-[3]" />
 <span>
 پاسخ صحیح (دریافت کامل {toPersianDigits(q.points)} امتیاز)
 </span>
 </span>
 ) : (
 <span className="text-[var(--color-danger)] flex items-center gap-1.5 bg-[var(--color-danger-soft)]/40 px-3 py-1 rounded-xl border border-[var(--color-danger)]/20">
 <X className="w-4 h-4 stroke-[3]" />
 <span>
 پاسخ نادرست (نمره کسب‌شده:{' '}
 {toPersianDigits(stdAnsObj?.scoreGained ?? 0)} از{' '}
 {toPersianDigits(q.points)})
 </span>
 </span>
 )}
 </div>
 </div>
 );

}
