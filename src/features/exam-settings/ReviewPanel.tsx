/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Left column: final review, validation panel and publishing/link panel plus
 * the action-button footer — moved verbatim from
 * src/pages/teacher/ExamSettings.tsx. Presentational: review values,
 * callbacks and the exam link in, JSX out.
 */
import { AlertTriangle, Check, CheckCircle, Compass, Copy, Link, Play, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { Seal } from '../../components/Seal';
import { toPersianDigits } from '../../utils/persian';
import { ClassGroup, Exam } from '../../types';

interface ReviewPanelProps {
  exam: Exam;
  classGroups: ClassGroup[];
  allowedClasses: string[];
  totalCalculatedStudents: number;
  questionsCount: number;
  totalPoints: number;
  startDate: string;
  startHour: string;
  endDate: string;
  endHour: string;
  durationMinutes: number;
  beastMode: boolean;
  longAnswersCount: number;
  validationErrors: string[];
  examStatus: Exam['status'];
  setExamStatus: (value: Exam['status']) => void;
  handlePublishExam: () => void;
  examLink: string;
  isCopied: boolean;
  handleCopyLink: () => void;
  handleBack: () => void;
  handleSaveSettings: () => void;
}

export function ReviewPanel({
  exam,
  classGroups,
  allowedClasses,
  totalCalculatedStudents,
  questionsCount,
  totalPoints,
  startDate,
  startHour,
  endDate,
  endHour,
  durationMinutes,
  beastMode,
  longAnswersCount,
  validationErrors,
  examStatus,
  setExamStatus,
  handlePublishExam,
  examLink,
  isCopied,
  handleCopyLink,
  handleBack,
  handleSaveSettings,
}: ReviewPanelProps) {
 return (
 <>
 {/* SECTION 6: پنل مرور نهایی */}
 <div className="lens p-6 rounded-3xl space-y-4">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] pb-2.5 border-b border-[var(--color-glass-light-stroke)] flex items-center gap-1.5">
 <Compass className="w-5 h-5 text-[var(--color-accent)]" />
 <span>مرور نهایی برگه</span>
 </h2>

 <div className="space-y-3.5 text-caption text-[var(--color-text-secondary)]">
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)] text-micro">عنوان امتحان:</span>
 <span
 className="font-extrabold text-[var(--color-text-primary)] max-w-[120px] truncate"
 title={exam.title}
 >
 {exam.title}
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)] text-micro">
 ارزیابی مستهدف:
 </span>
 <span className="font-bold text-[var(--color-text-secondary)]">
 {exam.subject} ({exam.grade})
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)] text-micro">
 پایه و نوع کلاس:
 </span>
 <span
 className="font-semibold glx-inset text-[var(--color-text-secondary)] px-2 py-0.5 rounded-md text-micro max-w-[130px] truncate"
 title={allowedClasses
 .map((cid) => classGroups.find((c) => c.id === cid)?.name)
 .join(' و ')}
 >
 {allowedClasses.length > 0
 ? allowedClasses
 .map((cid) => classGroups.find((c) => c.id === cid)?.name)
 .join(' و ')
 : 'کلاسی تعیین نشده'}
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)] text-micro">
 تعداد کل شرکت‌کنندگان:
 </span>
 <span className="font-black text-[var(--color-accent)] font-mono text-caption bg-[var(--color-accent-soft)] px-2 py-0.5 rounded-md">
 {toPersianDigits(totalCalculatedStudents)} دانش‌آموز
 </span>
 </div>

 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)] text-micro">
 تعداد کل سوالات:
 </span>
 <span className="font-extrabold text-[var(--color-text-primary)] font-mono">
 {toPersianDigits(questionsCount)} سوال
 </span>
 </div>

 <div className="flex justify-between items-center pb-2 border-b border-[var(--color-glass-light-stroke)]">
 <span className="text-[var(--color-text-tertiary)] text-micro">
 مجموع بارم و نمرات:
 </span>
 <span className="font-extrabold text-[var(--color-warning)] bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 px-2 py-0.5 rounded-md font-mono">
 {toPersianDigits(totalPoints)} نمره
 </span>
 </div>

 {/* Timing specifications */}
 <div className="space-y-2 pt-1 text-micro">
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-primary)]">تاریخ و ساعت شروع:</span>
 <span className="font-semibold text-[var(--color-text-primary)] font-mono text-micro">
 {toPersianDigits(startDate)} | {toPersianDigits(startHour)}
 </span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-primary)]">تاریخ و ساعت پایان:</span>
 <span className="font-semibold text-[var(--color-text-primary)] font-mono text-micro">
 {toPersianDigits(endDate)} | {toPersianDigits(endHour)}
 </span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-primary)]">مدت انقضای پاسخ‌گو:</span>
 <span className="text-[var(--color-text-primary)] font-mono text-micro">
 {toPersianDigits(durationMinutes)} دقیقه
 </span>
 </div>
 </div>

 {/* Status parameters checkboxes */}
 <div className="space-y-2 pt-2 border-t border-[var(--color-glass-light-stroke)] text-micro">
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">
 وضعیت Beast Mode ضد تقلب:
 </span>
 <span
 className={`font-bold ${beastMode ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-tertiary)]'}`}
 >
 {beastMode ? '🔒 فعال فوق‌حفاظتی' : 'غیرفعال'}
 </span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">تصحیح خودکار تستی:</span>
 <span className="font-bold text-[var(--color-success)] flex items-center gap-1">
 <Check className="w-3.5 h-3.5" />
 <span>فعال در کل سیستم</span>
 </span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[var(--color-text-tertiary)]">
 نیاز به تصحیح دستی تشریحی:
 </span>
 <span
 className={`font-bold ${longAnswersCount > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-primary)]'}`}
 >
 {longAnswersCount > 0
 ? `بله، دارای ${toPersianDigits(longAnswersCount)} سوال تشریحی`
 : 'خیر، تماماً تستی'}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* SECTION 7: بررسی عیوب و اعتبارسنجی قبل انتشار */}
 <div className="lens p-6 rounded-3xl space-y-3.5">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-1.5 pb-2 border-b border-[var(--color-glass-light-stroke)]">
 <ShieldAlert className="w-4.5 h-4.5 text-[var(--color-text-tertiary)]" />
 <span>پایش عیوب طراحی (اعتبارسنجی)</span>
 </h2>

 {validationErrors.length === 0 ? (
 <div className="p-3 bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20 rounded-2xl flex items-start gap-2 text-micro leading-relaxed">
 <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5" />
 <div className="space-y-0.5">
 <strong className="font-extrabold block">آمادگی صددرصدی لایو</strong>
 <p className="text-micro text-[var(--color-success)]">
 هیچ خطای منطقی یا امنیتی در برگه پیدا نشد. می‌توانید با خیال راحت آزمون را لایو
 مندرج کنید.
 </p>
 </div>
 </div>
 ) : (
 <div className="bg-[var(--color-danger-soft)]/40/70 border border-[var(--color-danger)]/20 rounded-2xl p-4.5 space-y-2.5">
 <div className="flex items-center gap-2 text-[var(--color-danger)]/80">
 <AlertTriangle className="w-4.5 h-4.5 text-[var(--color-danger)] shrink-0" />
 <span className="text-micro">
 خطاهای برجا مانده از طراحی ({toPersianDigits(validationErrors.length)} مورد):
 </span>
 </div>
 <ul className="space-y-2 pr-2.5 text-micro text-[var(--color-danger)] list-decimal leading-relaxed">
 {validationErrors.map((err, idx) => (
 <li key={idx} className="font-semibold text-[var(--color-danger)]">
 {err}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>

 {/* SECTION 8: عملیات انتشار و ساخت لینک */}
 <div className="lens p-6 rounded-3xl border-[var(--color-accent)]/20/80 space-y-4">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-accent)]/10/50 flex items-center gap-1.5">
 <Play className="w-4.5 h-4.5 text-[var(--color-accent)]" />
 <span>انتشار نهایی برگه آزمون</span>
 </h2>

 {/* Current layout status displaying */}
 <div className="flex justify-between items-center text-caption">
 <span className="text-[var(--color-text-tertiary)] font-bold">وضعیت فعلی آزمون:</span>
 <span
 className={`px-2.5 py-0.5 rounded-lg font-black text-micro ${
 examStatus === 'draft'
 ? 'glx-inset text-[var(--color-text-secondary)] border border-[var(--color-glass-light-stroke)]'
 : examStatus === 'scheduled'
 ? 'bg-[var(--color-info-soft)] text-[var(--color-info)] border border-[var(--color-info)]/20'
 : examStatus === 'active'
 ? 'bg-[var(--color-warning-soft)]/10/15 text-[var(--color-warning)] border border-[var(--color-warning)]/20/50 animate-pulse'
 : 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20'
 }`}
 >
 {examStatus === 'draft' && 'پیش‌نویس طراح'}
 {examStatus === 'scheduled' && 'زمان‌بندی‌شده (آینده)'}
 {examStatus === 'active' && 'فعال نهایی (زنده 🟢)'}
 {examStatus === 'completed' && 'پایان‌یافته / زمان سپری شده'}
 </span>
 </div>

 {/* Publish Actions Trigger button */}
 {examStatus === 'draft' ? (
 <button
 type="button"
 onClick={handlePublishExam}
 disabled={validationErrors.length > 0}
 className={`w-full py-3 rounded-2xl text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
 validationErrors.length > 0
 ? 'bg-[var(--color-glass-light-fill)] text-[var(--color-text-tertiary)] border border-[var(--color-glass-light-stroke)] cursor-not-allowed'
 : 'bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] border border-[var(--color-accent)]/20'
 }`}
 >
 <Play className="w-4 h-4" />
 <span>بررسی نهایی و انتشار آزمون</span>
 </button>
 ) : (
 <div className="space-y-3">
 <div className="bg-[var(--color-success-solid)]/10 text-[var(--color-success)] border-2 border-[var(--color-success)]/20 rounded-2xl p-4 flex items-center gap-4">
 {/* C.3 — the seal is the success mark on full-panel successes
 (carried rejection: never inside a one-line toast). */}
 <Seal size={96} />
 <div className="space-y-0.5">
 <span className="text-micro block">آزمون به جریان منتشر شد!</span>
 <p className="text-micro text-[var(--color-success)]/90 leading-normal">
 ورود دانش‌آموزان به صورت لایو با لینک زیر برقرار و گزارش پاسخ‌ها زنده بر
 مانیتور معلم در دسترس است.
 </p>
 </div>
 </div>

 {/* Regenerate/Rollback Draft helper to let them revert state */}
 <button
 type="button"
 onClick={() => {
 setExamStatus('draft');
 }}
 className="w-full py-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-xl text-micro border-[var(--color-glass-light-stroke)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <RefreshCw className="w-3.5 h-3.5" />
 <span>برگرداندن به حالت پیش‌نویس (انصراف موقت)</span>
 </button>
 </div>
 )}

 {/* Server-issued exam link panel (derived from exam.examCode) */}
 {examStatus !== 'draft' && examLink && (
 <div className="p-3 pane rounded-2xl border-[var(--color-accent)]/20 space-y-2.5">
 <span className="text-micro text-[var(--color-text-primary)] flex items-center gap-1">
 <Link className="w-3.5 h-3.5 text-[var(--color-accent)]" />
 <span>لینک اختصاصی شرکت در آزمون صادر شد:</span>
 </span>

 <div className="pane p-2.5 rounded-xl flex items-center justify-between text-caption font-mono text-[var(--color-accent)] font-bold overflow-x-auto gap-2">
 <span className="truncate text-micro select-all" title={examLink}>
 {examLink}
 </span>
 <button
 type="button"
 onClick={handleCopyLink}
 className={`p-1 px-2.5 rounded-lg text-micro font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
 isCopied
 ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20'
 : 'bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent)]/20'
 }`}
 >
 <Copy className="w-3 h-3" />
 <span>{isCopied ? 'کپی شد! ✅' : 'کپی لینک'}</span>
 </button>
 </div>

 <p className="text-micro text-[var(--color-text-tertiary)] leading-normal text-center">
 این کد یکتا مختص ورود دانش‌آموزان کلاس‌های تعیین شده می‌باشد.
 </p>
 </div>
 )}
 </div>

 {/* Action buttons footer */}
 <div className="flex gap-2.5 justify-end">
 <button
 type="button"
 onClick={handleBack}
 className="px-5 py-2.5 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-xl text-caption font-bold cursor-pointer shadow-3xs border-[var(--color-glass-light-stroke)]"
 >
 انصراف و بازگشت
 </button>
 <button
 type="button"
 onClick={handleSaveSettings}
 className="px-5 py-2.5 btn-glass btn-glass--primary rounded-xl text-caption font-bold flex items-center gap-2 cursor-pointer"
 >
 <Save className="w-4 h-4" />
 <span>ثبت تغییرات پیکربندی</span>
 </button>
 </div>
 </>
 );
}
