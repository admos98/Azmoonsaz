/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recommended Option Panel (One-click template helper) — moved verbatim from
 * src/pages/teacher/ExamSettings.tsx. Presentational: apply callback +
 * applied-feedback flag in, JSX out.
 */
import { CheckCircle, Compass, Sparkles, Zap } from 'lucide-react';
import { PillButton } from '../../ui';

interface RecommendationsBannerProps {
  handleApplyOfficialRecommendations: () => void;
  showRecommendationsApplied: boolean;
}

export function RecommendationsBanner({
  handleApplyOfficialRecommendations,
  showRecommendationsApplied,
}: RecommendationsBannerProps) {
 return (
 <>
 {/* A. Recommended Option Panel (One-click template helper) */}
 <div className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] p-5 rounded-3xl relative overflow-hidden shadow-xs">
 <div className="absolute top-0 left-0 translate-x-1/10 -translate-y-1/10 opacity-10">
 <Compass className="w-48 h-48" />
 </div>

 <div className="relative z-10 space-y-3">
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-[var(--color-warning)]/70 shrink-0" />
 <p className="text-caption font-bold text-[var(--color-text-on-solid)]">
 سامانه هوشمند پیکربندی رسمی (ویژه ارزشیابی نهایی)
 </p>
 </div>
 <p className="text-micro text-[var(--color-accent)] leading-relaxed max-w-xl">
 آیا این آزمون به صورت رسمی از دانش‌آموزان گرفته می‌شود؟ برای بستن روزنه‌های تخلف و
 بالا بردن امنیت فنی به صورت خودکار، کلیک کنید تا تنظیمات حفاظتی استاندارد ما اعمال
 شود.
 </p>

 <div className="pt-2 flex flex-wrap gap-2 text-micro text-[var(--color-accent)]">
 <span className="glx field px-2 py-0.5 rounded-md flex items-center gap-1">
 ۱ تلاش مجاز
 </span>
 <span className="glx field px-2 py-0.5 rounded-md flex items-center gap-1">
 حفاظت Beast Mode
 </span>
 <span className="glx field px-2 py-0.5 rounded-md flex items-center gap-1">
 ارسال خودکار
 </span>
 <span className="glx field px-2 py-0.5 rounded-md flex items-center gap-1">
 عدم نمایش بلادرنگ کارنامه
 </span>
 </div>

 <div className="pt-1">
 <PillButton
 fill="warning-solid"
 size="none"
 radius="xl"
 text="caption"
 weight="black"
 textColor="primary"
 onClick={handleApplyOfficialRecommendations}
 className="px-4.5 py-2 hover:bg-[var(--color-warning-solid)] transition-all flex items-center gap-1.5 shadow-xs border border-[var(--color-warning)]/20"
 >
 <Zap className="w-4 h-4" />
 <span>اعمال خودکار تنظیمات پیشنهادی امنیت هوشمند</span>
 </PillButton>
 </div>

 {showRecommendationsApplied && (
 <div className="p-3 bg-[var(--color-success-solid)]/25 border border-[var(--color-success)]/20 text-[var(--color-success)] rounded-xl text-micro flex items-center gap-2">
 <CheckCircle className="w-4.5 h-4.5" />
 <span>معیارهای امنیتی با موفقیت روی برگه آزمون سوار و ذخیره شدند!</span>
 </div>
 )}
 </div>
 </div>
 </>
 );
}
