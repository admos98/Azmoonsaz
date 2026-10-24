/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Comprehensive analytics metrics dashboard grid (7 StatCards).
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import {
 AlertCircle,
 Award,
 CheckCircle2,
 Percent,
 UserCheck,
 Users,
 UserX,
} from 'lucide-react';

import { StatCard } from '../../../ui';
import { toPersianDigits } from '../../../utils/persian';

interface ResultsStatsGridProps {
 totalCohortsCount: number;
 participantsCount: number;
 absentCount: number;
 avgScore: string;
 highestScore: number;
 needsCorrectionCount: number;
 completedCorrectionCount: number;
}

export function ResultsStatsGrid({
 totalCohortsCount,
 participantsCount,
 absentCount,
 avgScore,
 highestScore,
 needsCorrectionCount,
 completedCorrectionCount,
}: ResultsStatsGridProps) {
 return (
 <>
 {/* Comprehensive Analytics Metrics Dashboard grid */}
 <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
 {/* Card 1: Total Allocated classes */}
 <StatCard
 label="کل کارنامه تخصصی"
 value={toPersianDigits(totalCohortsCount)}
 unit="نفر"
 footnote="منتسب از کلاس‌های اختصاصی"
 icon={<Users className="w-4 h-4" />}
 tone="neutral"
 glassLayer="light"
 valueSize="md"
 />

 {/* Card 2: Participated */}
 <StatCard
 label="تعداد شرکت‌کنندگان"
 value={toPersianDigits(participantsCount)}
 unit="نفر"
 footnote="حضور یافته در سیستم امتحان"
 footnoteTone="success"
 valueClassName="text-[var(--color-success)]"
 icon={<UserCheck className="w-4 h-4" />}
 tone="success"
 glassLayer="light"
 valueSize="md"
 />

 {/* Card 3: Absents */}
 <StatCard
 label="غائبین ارزیابی"
 value={toPersianDigits(absentCount)}
 unit="نفر"
 footnote="بدون شروع کدرهگیری"
 footnoteTone="danger"
 valueClassName="text-[var(--color-danger)]"
 icon={<UserX className="w-4 h-4" />}
 tone="danger"
 glassLayer="light"
 valueSize="md"
 />

 {/* Card 4: Average score */}
 <StatCard
 label="میانگین کلی نمرات"
 value={toPersianDigits(avgScore)}
 footnote="معدل کتبی کلاس داوطلبان"
 footnoteTone="accent"
 valueClassName="text-[var(--color-accent)]"
 icon={<Percent className="w-4 h-4" />}
 tone="accent"
 glassLayer="light"
 valueSize="md"
 />

 {/* Card 5: Highest score */}
 <StatCard
 label="بالاترین نمره کلاس"
 value={toPersianDigits(highestScore)}
 footnote="بهترین رتبه ثبت نهایی شده"
 footnoteTone="warning"
 valueClassName="text-[var(--color-warning)]"
 icon={<Award className="w-4 h-4" />}
 tone="warning"
 glassLayer="light"
 valueSize="md"
 />

 {/* Card 6: Needs correction */}
 <StatCard
 label="نیازمند تصحیح تشریحی"
 value={toPersianDigits(needsCorrectionCount)}
 unit="برگه"
 footnote="در برگیرنده پاسخ‌های توصیفی"
 footnoteTone="warning"
 valueClassName="text-[var(--color-warning)]"
 icon={<AlertCircle className="w-4 h-4" />}
 tone="warning"
 glassLayer="light"
 valueSize="md"
 />

 {/* Card 7: Completed corrections */}
 <StatCard
 label="تصحیح‌های تکمیل‌شده"
 value={toPersianDigits(completedCorrectionCount)}
 unit="کارنامه"
 footnote="ثبت قطعی در کارتابل دبیران"
 footnoteTone="success"
 valueClassName="text-[var(--color-success)]"
 icon={<CheckCircle2 className="w-4 h-4" />}
 tone="success"
 glassLayer="light"
 valueSize="md"
 />
 </div>
 </>
 );
}
