/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SECTION 1: exact exam scheduling — moved verbatim from
 * src/pages/teacher/ExamSettings.tsx. Presentational: schedule state +
 * bound setters in, JSX out.
 */
import { Calendar, Clock } from 'lucide-react';
import { Input } from '../../ui';
import { formatPersianDate } from '../../utils/persian';

interface ScheduleSectionProps {
  startDate: string;
  startHour: string;
  endDate: string;
  endHour: string;
  durationMinutes: number;
  setStartDate: (value: string) => void;
  setStartHour: (value: string) => void;
  setEndDate: (value: string) => void;
  setEndHour: (value: string) => void;
  setDurationMinutes: (value: number) => void;
}

export function ScheduleSection({
  startDate,
  startHour,
  endDate,
  endHour,
  durationMinutes,
  setStartDate,
  setStartHour,
  setEndDate,
  setEndHour,
  setDurationMinutes,
}: ScheduleSectionProps) {
 return (
 <>
 {/* SECTION 1: زمان‌بندی آزمون */}
 <div className="relative lens p-6 rounded-3xl space-y-4">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
 <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
 <span>۱. زمان‌بندی دقیق برگزاری آزمون</span>
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Start Date & Hour */}
 <div className="space-y-2.5">
 <label className="text-caption font-bold text-[var(--color-text-secondary)] block">
 شروع دسترسی به آزمون:
 </label>
 <div className="grid grid-cols-5 gap-2">
 <input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 className="col-span-3 glx field border text-caption font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:border-[var(--color-accent)]/40 focus:bg-[var(--color-accent-soft)]/30"
 />
 <input
 type="time"
 value={startHour}
 onChange={(e) => setStartHour(e.target.value)}
 className="col-span-2 glx field border text-caption font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:border-[var(--color-accent)]/40 focus:bg-[var(--color-accent-soft)]/30 text-center"
 />
 </div>
 {/* Real-time Shamsi displays */}
 {startDate && (
 <div className="p-2 bg-[var(--color-success-soft)] rounded-lg text-[var(--color-success)] border border-[var(--color-success)]/10/50 text-micro font-semibold flex items-center gap-1 px-3">
 <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success-solid)] shrink-0" />
 <span>تقویم شمسی معادل:</span>
 <strong className="text-[var(--color-success)]">
 {formatPersianDate(startDate)}
 </strong>
 </div>
 )}
 </div>

 {/* End Date & Hour */}
 <div className="space-y-2.5">
 <label className="text-caption font-bold text-[var(--color-text-secondary)] block">
 پایان مهلت شرکت در آزمون:
 </label>
 <div className="grid grid-cols-5 gap-2">
 <input
 type="date"
 value={endDate}
 onChange={(e) => setEndDate(e.target.value)}
 className="col-span-3 glx field border text-caption font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:border-[var(--color-accent)]/40 focus:bg-[var(--color-accent-soft)]/30"
 />
 <input
 type="time"
 value={endHour}
 onChange={(e) => setEndHour(e.target.value)}
 className="col-span-2 glx field border text-caption font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:border-[var(--color-accent)]/40 focus:bg-[var(--color-accent-soft)]/30 text-center"
 />
 </div>
 {endDate && (
 <div className="p-2 bg-[var(--color-success-soft)] rounded-lg text-[var(--color-success)] border border-[var(--color-success)]/10/50 text-micro font-semibold flex items-center gap-1 px-3">
 <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success-solid)] shrink-0" />
 <span>تقویم شمسی معادل:</span>
 <strong className="text-[var(--color-success)]">
 {formatPersianDate(endDate)}
 </strong>
 </div>
 )}
 </div>
 </div>

 {/* Duration and Timezone in same row */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--color-glass-light-stroke)]">
 <Input
 label={
 <span className="flex items-center gap-1">
 <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
 <span>مدت زمان مجاز آزمون پس از ورود (دقیقه):</span>
 </span>
 }
 type="number"
 min={5}
 max={240}
 value={durationMinutes}
 onChange={(e) => setDurationMinutes(Number(e.target.value))}
 className="font-bold"
 helperText="هر دانش‌آموز پس از ورود دقیقاً این میزان فرصت دارد پیش از قفل شدن آزمون پاسخ‌ها را بفرستد."
 />

 <div className="space-y-1.5">
 <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
 منطقه زمانی هماهنگ سامانه:
 </span>
 <div className="pane p-2.5 rounded-xl text-caption font-bold text-[var(--color-text-secondary)] flex justify-between items-center px-4">
 <span>نمایش منطقه زمانی:</span>
 <span className="text-[var(--color-accent)] glx field border px-3 py-0.5 rounded-lg text-micro">
 تهران (Tehran)
 </span>
 </div>
 <span className="text-micro text-[var(--color-text-tertiary)] block leading-relaxed">
 ساعت سرور بر حسب زمان رسمی ایران هماهنگ شده است.
 </span>
 </div>
 </div>
 </div>
 </>
 );
}
