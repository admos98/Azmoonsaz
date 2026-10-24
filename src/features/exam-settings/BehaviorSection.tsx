/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SECTION 3: advanced exam behavior controls (<details> block) — moved
 * verbatim from src/pages/teacher/ExamSettings.tsx. Presentational: rules
 * state + bound setters in, JSX out.
 */
import { FileText, Laptop, Lock, ShieldAlert, Zap } from 'lucide-react';
import { Toggle } from '../../ui';

interface BehaviorSectionProps {
  autoSubmit: boolean;
  setAutoSubmit: (value: boolean) => void;
  allowBacktrack: boolean;
  setAllowBacktrack: (value: boolean) => void;
  autoSaveAnswers: boolean;
  setAutoSaveAnswers: (value: boolean) => void;
  shuffleQuestions: boolean;
  setShuffleQuestions: (value: boolean) => void;
  shuffleOptions: boolean;
  setShuffleOptions: (value: boolean) => void;
  showOneQuestionPerPage: boolean;
  setShowOneQuestionPerPage: (value: boolean) => void;
  beastMode: boolean;
  setBeastMode: (value: boolean) => void;
}

export function BehaviorSection({
  autoSubmit,
  setAutoSubmit,
  allowBacktrack,
  setAllowBacktrack,
  autoSaveAnswers,
  setAutoSaveAnswers,
  shuffleQuestions,
  setShuffleQuestions,
  shuffleOptions,
  setShuffleOptions,
  showOneQuestionPerPage,
  setShowOneQuestionPerPage,
  beastMode,
  setBeastMode,
}: BehaviorSectionProps) {
 return (
 <>
 {/* SECTION 3: رفتار پیشرفته آزمون */}
 <details className="group pane rounded-3xl">
 <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
 <span className="flex items-center gap-2 text-caption font-bold text-[var(--color-text-primary)]">
 <Lock className="w-5 h-5 text-[var(--color-accent)]" />
 <span>۳. رفتار و کنترل‌های پیشرفته آزمون</span>
 </span>
 <span className="text-micro text-[var(--color-accent)] group-open:hidden">
 نمایش تنظیمات
 </span>
 <span className="hidden text-micro text-[var(--color-accent)] group-open:inline">
 بستن تنظیمات
 </span>
 </summary>
 <div className="space-y-4 border-t border-[var(--color-glass-light-stroke)] p-6 pt-4">
 <p className="text-micro leading-relaxed text-[var(--color-text-tertiary)]">
 این گزینه‌ها ترتیب سؤال‌ها، امکان بازگشت، ذخیره پاسخ و محدودیت‌های حفاظتی را تغییر
 می‌دهند. پیش از انتشار، تجربه دانش‌آموز را در پیش‌نمایش بررسی کنید.
 </p>

 {/* Custom checkboxes behavior */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
 <Toggle
 id="auto-submit-toggle"
 checked={autoSubmit}
 onChange={setAutoSubmit}
 label="ارسال خودکار پس از پایان زمان"
 description="بسته شدن سیستم و ثبت نهایی امن برگه به محض صفر شدن ثانیه‌شمار."
 className="p-3.5 pane rounded-2xl"
 />

 <Toggle
 id="allow-backtrack-behavior"
 checked={allowBacktrack}
 onChange={setAllowBacktrack}
 label="امکان بازگشت به سوالات قبلی"
 description="دانش‌آموز بتواند سوالات رد کرده را برگردد و مجدد جواب دهد."
 className="p-3.5 pane rounded-2xl"
 />

 <Toggle
 id="auto-save-answers-toggle"
 checked={autoSaveAnswers}
 onChange={setAutoSaveAnswers}
 label="ذخیره خودکار پاسخ‌ها (Auto-saves)"
 description="پشتیبان‌گیری پیوسته بر ابر پس از زدن هر دکمه جهت جلوگیری از قطعی برق دسکتاپ."
 className="p-3.5 pane rounded-2xl"
 />

 <Toggle
 id="shuffle-questions-behavior"
 checked={shuffleQuestions}
 onChange={setShuffleQuestions}
 label="جابه‌جایی ترتیب سوالات (Shuffle)"
 description="تولید خودکار دفترچه‌های مجزا با ترتیب سوالات به هم‌ریخته برای کنترل تقلب."
 className="p-3.5 pane rounded-2xl"
 />

 <Toggle
 id="shuffle-options-behavior"
 checked={shuffleOptions}
 onChange={setShuffleOptions}
 label="جابه‌جایی ترتیب گزینه‌ها"
 description="جابه‌جایی الف-ب-ج-د به صورت تصادفی در سیستم روی مرورگر دانش‌آموزان به هنگام لود."
 className="p-3.5 pane rounded-2xl"
 />
 </div>

 {/* Question pagination layouts (1 question per page vs all in one page) */}
 <div className="pt-3.5 border-t border-[var(--color-glass-light-stroke)] space-y-2">
 <span className="text-caption font-bold text-[var(--color-text-secondary)] block text-right">
 نحوه نمایش صفحات سوالات آزمون:
 </span>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div
 role="radio"
 aria-checked={showOneQuestionPerPage}
 tabIndex={0}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ')
 setShowOneQuestionPerPage(true);
 }}
 onClick={() => setShowOneQuestionPerPage(true)}
 className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
 showOneQuestionPerPage
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 font-bold text-[var(--color-accent)] shadow-3xs'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <span className="block text-caption font-bold flex items-center gap-1.5">
 <Laptop className="w-4 h-4 text-[var(--color-accent)]" />
 <span>نمایش یک سوال در هر صفحه</span>
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 تضمین تمرکز بالا، مهار عکس گرفتن گروهی از کل اوراق از روی مانیتورها.
 </p>
 </div>

 <div
 role="radio"
 aria-checked={!showOneQuestionPerPage}
 tabIndex={0}
 onKeyDown={(event) => {
 if (event.key === 'Enter' || event.key === ' ')
 setShowOneQuestionPerPage(false);
 }}
 onClick={() => setShowOneQuestionPerPage(false)}
 className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
 !showOneQuestionPerPage
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 font-bold text-[var(--color-accent)] shadow-3xs'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <span className="block text-caption font-bold flex items-center gap-1.5">
 <FileText className="w-4 h-4 text-[var(--color-accent)]" />
 <span>نمایش همه سوالات در یک صفحه</span>
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 امکان مرور یکجای تمام آزمون در ارتفاع کوتاه اسکرول به صورت چاپی سنتی.
 </p>
 </div>
 </div>
 </div>

 {/* Beast Mode high security system */}
 <div
 className={`p-4.5 rounded-2xl border transition-all ${
 beastMode ? 'btn-glass btn-glass--danger' : 'btn-glass btn-glass--bare'
 }`}
 >
 <div className="flex items-start gap-4">
 <Toggle checked={beastMode} onChange={setBeastMode} className="mt-1" />
 <div className="space-y-1.5 flex-1">
 <span className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2">
 <ShieldAlert
 className={`w-5 h-5 ${beastMode ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-tertiary)]'}`}
 />
 <span>فعال‌سازی وضعیت فراحفاظتی (Beast Mode 🔒)</span>
 </span>
 <p className="text-micro leading-relaxed text-[var(--color-text-tertiary)]">
 رویدادهایی مانند خروج از تب، تغییر پنجره و تلاش برای کپی‌کردن را ثبت می‌کند و
 محدودیت‌های قابل‌اعمال مرورگر را فعال می‌سازد. مرورگر نمی‌تواند استفاده از
 دستگاه دوم یا عکس‌برداری بیرونی را تضمینی متوقف کند؛ گزارش‌ها را همراه شواهد
 دیگر بررسی کنید.
 </p>

 {beastMode && (
 <div className="pt-2 flex items-center gap-1.5 text-micro text-[var(--color-danger)]">
 <Zap className="w-3.5 h-3.5 text-[var(--color-danger)] animate-pulse" />
 <span>حفاظت فعال دسکتاپی روشن - سیستم ضد شبیه‌سازها به صف شدند</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </details>
 </>
 );
}
