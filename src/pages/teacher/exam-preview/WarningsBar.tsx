/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle } from 'lucide-react';
import { toPersianDigits } from '../../../utils/persian';
import type { ValidationWarning } from '../../../features/exam-preview/validation';

type WarningsBarProps = {
  warnings: ValidationWarning[];
};

export function WarningsBar({ warnings }: WarningsBarProps) {
 return (
 <div
 className="bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/20 rounded-2xl p-4.5 space-y-3"
 id="validation-errors-alert"
 >
 <div className="flex items-center gap-2 text-[var(--color-danger)]/80">
 <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0" />
 <h2 className="text-caption font-bold">
 بررسی خودکار عیوب طراح ({toPersianDigits(warnings.length)} اشکال برجا مانده)
 </h2>
 </div>
 <p className="text-micro text-[var(--color-danger)]">
 دبیـر گرامی، سوالات برای انتشار امن و بدون خطا نیازمند برطرف کردن نواقص زیر می‌باشند:
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-micro">
 {warnings.map((warn) => (
 <div
 key={warn.id}
 className="glx0 p-2.5 rounded-xl border border-[var(--color-danger)]/10 flex items-start gap-2 text-[var(--color-danger)] cursor-pointer hover:brightness-105 transition-all"
 onClick={() => {
 const targetElement = document.getElementById(`editor-q-box-${warn.targetId}`);
 if (targetElement) {
 targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
 targetElement.classList.add('ring-2', 'ring-[var(--color-danger)]');
 setTimeout(
 () => targetElement.classList.remove('ring-2', 'ring-[var(--color-danger)]'),
 2500,
 );
 }
 }}
 >
 <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger-soft)]/40 shrink-0 mt-1.5" />
 <span className="leading-relaxed font-semibold">{warn.message}</span>
 </div>
 ))}
 </div>
 </div>
 );
}
