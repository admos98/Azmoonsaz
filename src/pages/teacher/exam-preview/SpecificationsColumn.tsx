/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, CheckCircle, Info, Layers } from 'lucide-react';
import { Exam } from '../../../types';
import { toPersianDigits } from '../../../utils/persian';
import type { ValidationWarning } from '../../../features/exam-preview/validation';

type SpecificationsColumnProps = {
  localExam: Exam;
  warnings: ValidationWarning[];
  totalScore: number;
  totalQuestions: number;
  getAssignedClassesString: () => string;
};

export function SpecificationsColumn({
 localExam,
 warnings,
 totalScore,
 totalQuestions,
 getAssignedClassesString,
}: SpecificationsColumnProps) {
 return (
 <div className="col-span-1 space-y-5" id="specifications-column">
 {/* 1. Exam Static Summary Panel */}
 <div className="pane p-5 rounded-3xl space-y-4 text-right">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] pb-2.5 border-b border-[var(--color-glass-light-stroke)] flex items-center gap-1.5">
 <Layers className="w-4.5 h-4.5 text-[var(--color-text-tertiary)]" />
 <span>جزییات شناسنامه آزمون</span>
 </h2>

 <div className="space-y-3.5 text-caption text-[var(--color-text-primary)]">
 <div className="flex justify-between items-center pane p-2 rounded-xl">
 <span className="text-[var(--color-text-tertiary)]">عنوان آزمون:</span>
 <span
 className="text-[var(--color-text-primary)] text-micro max-w-[130px] truncate"
 title={localExam.title}
 >
 {localExam.title}
 </span>
 </div>

 <div className="flex justify-between items-center text-caption">
 <span className="text-[var(--color-text-tertiary)]">نوع بازخورد:</span>
 <span
 className={`font-bold px-2 py-0.5 rounded-md text-micro ${
 localExam.settings.mode === 'official'
 ? 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border border-[var(--color-danger)]/10'
 : 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10'
 }`}
 >
 {localExam.settings.mode === 'official' ? 'رسمی (بارم‌دار)' : 'تمرینی (خودسنجی)'}
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">پایه تحصیلی:</span>
 <span className="font-bold text-[var(--color-text-secondary)]">
 پایه {localExam.grade}
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">درس هدف:</span>
 <span className="font-bold text-[var(--color-text-secondary)]">
 {localExam.subject}
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">کـلاس اختصاصی:</span>
 <span
 className="text-[var(--color-text-secondary)] text-micro truncate max-w-[120px]"
 title={getAssignedClassesString()}
 >
 {getAssignedClassesString()}
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">تعداد کل سوالات:</span>
 <span className="glx-inset px-2.5 py-0.5 rounded-md font-extrabold text-[var(--color-text-primary)] font-mono text-caption">
 {toPersianDigits(totalQuestions)}
 </span>
 </div>

 <div className="flex justify-between items-center pt-2 border-t border-[var(--color-glass-light-stroke)]/60">
 <span className="text-[var(--color-text-primary)] font-bold">مجموع کل نمرات:</span>
 <span className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20/60 text-[var(--color-warning)]/80 px-3 py-1 rounded-xl font-black font-mono text-caption">
 {toPersianDigits(totalScore)} نمره
 </span>
 </div>
 </div>

 {/* Completeness Status alert block */}
 <div
 className={`mt-4 p-3 rounded-2xl border flex items-center gap-2 ${
 warnings.length === 0
 ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/20'
 : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/20'
 }`}
 >
 {warnings.length === 0 ? (
 <>
 <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0" />
 <div className="space-y-0.5">
 <p className="text-micro">آماده همگام زیستی</p>
 <p className="text-micro text-[var(--color-success)] leading-normal">
 آزمون کامل است و خطایی در پیکربندی یافت نشد.
 </p>
 </div>
 </>
 ) : (
 <>
 <AlertCircle className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
 <div className="space-y-0.5">
 <p className="text-micro">نیاز به تصحیح طراح</p>
 <p className="text-micro text-[var(--color-warning)] leading-normal">
 {toPersianDigits(warnings.length)} هشدار فعال روی برگه یافت شد.
 </p>
 </div>
 </>
 )}
 </div>
 </div>

 {/* Guidelines info block */}
 <div className="pane p-5 rounded-3xl text-caption space-y-3">
 <h2 className="font-bold text-[var(--color-text-secondary)] flex items-center gap-1.5">
 <Info className="w-4 h-4 text-[var(--color-accent)]" />
 <span>ملاحظات پاسخ‌نامه‌ها</span>
 </h2>
 <ul className="space-y-2 text-micro text-[var(--color-text-tertiary)] list-disc pr-4 leading-relaxed">
 <li>جابه‌جایی نمره هر سوال مستقیماً بارم کل ورقه نهایی را تغییر می‌دهد.</li>
 <li>
 سوالات تشریحی نیاز به تعریف معیارهای مشخص بارم‌بندی برای صحت ارزیابی نهایی دارند.
 </li>
 <li>در حالت پیش‌نمایش دانش‌آموزی، پاسخ‌ها در کش موقت شبیه‌سازی خواهند شد.</li>
 </ul>
 </div>
 </div>
 );
}
