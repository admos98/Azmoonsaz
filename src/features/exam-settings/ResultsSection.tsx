/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SECTION 4: result display modes — moved verbatim from
 * src/pages/teacher/ExamSettings.tsx. Presentational: display mode + setter
 * and the descriptive-question count in, JSX out.
 */
import { Eye, Info } from 'lucide-react';
import { toPersianDigits } from '../../utils/persian';
import type { ResultsDisplayMode } from './useExamSettingsState';

interface ResultsSectionProps {
  resultsDisplayMode: ResultsDisplayMode;
  setResultsDisplayMode: (value: ResultsDisplayMode) => void;
  longAnswersCount: number;
}

export function ResultsSection({
  resultsDisplayMode,
  setResultsDisplayMode,
  longAnswersCount,
}: ResultsSectionProps) {
 return (
 <>
 {/* SECTION 4: نمایش نتیجه */}
 <div className="relative lens p-6 rounded-3xl space-y-4">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
 <Eye className="w-5 h-5 text-[var(--color-accent)]" />
 <span>۴. الگوهای انتشار نتایج و کارنامه</span>
 </h2>

 <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
 انتخاب نحوه نمایش نتیجه بلافاصله پس از فشردن دکمه پایان:
 </span>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {/* Option 1: Immediate Score */}
 <div
 role="radio"
 aria-checked={resultsDisplayMode === 'immediate_score'}
 tabIndex={0}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ')
 setResultsDisplayMode('immediate_score');
 }}
 onClick={() => setResultsDisplayMode('immediate_score')}
 className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
 resultsDisplayMode === 'immediate_score'
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] font-bold'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <span className="text-caption font-bold block">
 ۱. نمایش نمره بلافاصله بعد از ارسال
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 دانش‌آموز نمره کسب شده تستی را سریعاً در یک کارنامه سردست می‌بیند.
 </p>
 </div>

 {/* Option 2: Immediate Score and Answers */}
 <div
 role="radio"
 aria-checked={resultsDisplayMode === 'immediate_score_answers'}
 tabIndex={0}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ')
 setResultsDisplayMode('immediate_score_answers');
 }}
 onClick={() => setResultsDisplayMode('immediate_score_answers')}
 className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
 resultsDisplayMode === 'immediate_score_answers'
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] font-bold'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <span className="text-caption font-bold block">
 ۲. نمایش پاسخ‌های صحیح بعد از ارسال
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 نشان دادن تک تک گزینه‌های اشتباه و بازخوردهای تشریحی بلافاصله.
 </p>
 </div>

 {/* Option 3: Only after manual teacher check */}
 <div
 role="radio"
 aria-checked={resultsDisplayMode === 'after_approval'}
 tabIndex={0}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ')
 setResultsDisplayMode('after_approval');
 }}
 onClick={() => setResultsDisplayMode('after_approval')}
 className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
 resultsDisplayMode === 'after_approval'
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] font-bold'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <span className="text-caption font-bold block">
 ۳. نمایش نتیجه فقط پس از تایید معلم (پیشنهادی)
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 تا قبل تایید و ثبت نمرات تشریحی توسط دبیر کارنامه صادر نمی‌شود.
 </p>
 </div>

 {/* Option 4: Secret Exam (Never Show) */}
 <div
 role="radio"
 aria-checked={resultsDisplayMode === 'none'}
 tabIndex={0}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ') setResultsDisplayMode('none');
 }}
 onClick={() => setResultsDisplayMode('none')}
 className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
 resultsDisplayMode === 'none'
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] font-bold'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <span className="text-caption font-bold block">
 ۴. عدم نمایش نتیجه به دانش‌آموز
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 مکانیزم محرمانه - نتایج آزمون فقط برای شخص معلم بایگانی خواهند شد.
 </p>
 </div>
 </div>

 {/* Manual Grading caution recommendation note */}
 {longAnswersCount > 0 && (
 <div className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 p-3.5 rounded-2xl text-micro text-[var(--color-warning)] flex items-start gap-2.5">
 <Info className="w-4.5 h-4.5 text-[var(--color-warning)] shrink-0 mt-0.5" />
 <div className="space-y-1">
 <span className="font-extrabold block">
 توزیع بارم تشریحی شناسایی شد ({toPersianDigits(longAnswersCount)} سوال تشریحی):
 </span>
 <p className="text-micro text-[var(--color-warning)] leading-relaxed">
 این برگه دارای پاسخ تشریحی است. طبق الگوریتم‌های آزمون‌ساز، توصیه می‌گردد گزینه
 «نمایش نتیجه فقط پس از تایید معلم» حتماً فعال باشد تا دبیر بتواند با معیارهای
 روان‌سنجی نمرات نهایی را دستی ثبت کند.
 </p>
 </div>
 </div>
 )}
 </div>
 </>
 );
}
