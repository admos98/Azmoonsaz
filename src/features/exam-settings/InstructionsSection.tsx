/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SECTION 5: pre-start instructions — moved verbatim from
 * src/pages/teacher/ExamSettings.tsx. Presentational: instructions value +
 * setter in, JSX out.
 */
import { FileText } from 'lucide-react';
import { Textarea } from '../../ui';
import { toPersianDigits } from '../../utils/persian';

interface InstructionsSectionProps {
  startInstructions: string;
  setStartInstructions: (value: string) => void;
}

export function InstructionsSection({
  startInstructions,
  setStartInstructions,
}: InstructionsSectionProps) {
 return (
 <>
 {/* SECTION 5: دستورالعمل قبل از شروع */}
 <div className="relative lens p-6 rounded-3xl space-y-4">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
 <FileText className="w-5 h-5 text-[var(--color-accent)]" />
 <span>۵. دستورالعمل نمایش قبل از شروع آزمون</span>
 </h2>

 <div className="space-y-2">
 <Textarea
 label="متن راهنمای شروع آزمون برای دانش‌آموزان:"
 id="intro-instructions"
 rows={4}
 value={startInstructions}
 onChange={(e) => setStartInstructions(e.target.value)}
 placeholder="توضیحات و قوانین ورود به برگه را در اینجا بنویسید..."
 className="rounded-2xl"
 />
 <div className="flex justify-between items-center text-micro text-[var(--color-text-secondary)]">
 <span>دستور فوق درست قبل شرکت دانش‌آموز بر مانیتور او هک خواهد شد.</span>
 <span>تعداد کل کاراکتر: {toPersianDigits(startInstructions.length)} حرف</span>
 </div>
 </div>
 </div>
 </>
 );
}
