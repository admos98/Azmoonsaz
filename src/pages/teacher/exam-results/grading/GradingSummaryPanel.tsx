/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Left static metadata summary & finalizing drawer: live grade preview, student block, progress, finalize actions.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { Award, CheckCircle2, ShieldAlert } from 'lucide-react';

import { toPersianDigits } from '../../../../utils/persian';
import { Exam } from '../../../../types';
import type { ResultRow } from '../student-rows';
import { ScoreOdometer } from '../../../../components/ScoreOdometer';
import { Button } from '../../../../ui';

interface GradingSummaryPanelProps {
 exam: Exam;
 activeSubmission: ResultRow;
 assignedScores: Record<string, number>;
 savedDescriptiveQuestions: Record<string, boolean>;
 hasDescriptiveQuestions: boolean;
 getUngradedDescriptiveQuestionsCount: () => number;
 handleFinalizeGrading: () => void;
 setSelectedSubmissionId: (id: string | null) => void;
}

export function GradingSummaryPanel({
 exam,
 activeSubmission,
 assignedScores,
 savedDescriptiveQuestions,
 hasDescriptiveQuestions,
 getUngradedDescriptiveQuestionsCount,
 handleFinalizeGrading,
 setSelectedSubmissionId,
}: GradingSummaryPanelProps) {
 return (
 <div className="pane rounded-3xl p-5 sticky top-6 space-y-5 text-right">
 <div className="flex items-center gap-2 border-b border-[var(--color-glass-light-stroke)] pb-3">
 <Award className="w-5 h-5 text-[var(--color-accent)]" />
 <h2 className="text-caption font-bold text-[var(--color-text-primary)]">
 کاردکس جمع‌بندی تصحیح
 </h2>
 </div>

 {/* Live Grade preview indicator — the grade-reveal moment (Meraj):
      the total rolls odometer-style as descriptive scores land, and a
      gold تذهیب rule seals it once the کارنامه is registered. */}
 <div className="bg-gradient-to-br from-[var(--color-accent-soft)]/50 to-[var(--color-glass-light-fill)] border border-[var(--color-accent)]/20 rounded-2xl p-5 text-center space-y-1 mt-2">
 <span className="text-micro text-[var(--color-accent)] block">
 مجموع نمرات اکتسابی و نهایی
 </span>
 <div className="text-heading-1 text-[var(--color-accent)] font-mono">
 <ScoreOdometer
 value={(Object.values(assignedScores) as number[]).reduce((sum, s) => sum + s, 0)}
 max={activeSubmission.maxScore}
 finalized={activeSubmission.status === 'graded'}
 />
 </div>
 <div className="text-label-muted pt-1">
 <span>
 خودکار سیستم: {toPersianDigits(activeSubmission.autoScore)} بارم نسیب شده
 </span>
 </div>
 </div>

 {/* Detailed Student description block */}
 <div className="space-y-3 text-micro font-semibold text-[var(--color-text-secondary)] pane p-4 rounded-2xl leading-relaxed">
 <div>
 🏫 <strong>آزمون آنلاین:</strong> {exam.title}
 </div>
 <div>
 👤 <strong>نام داوطلب کلاس:</strong> {activeSubmission.studentName}
 </div>
 <div>
 🆔 <strong>کد ملی ثبت‌شده:</strong>{' '}
 {toPersianDigits(activeSubmission.nationalId)}
 </div>
 <div>
 🕒 <strong>آغاز ارزشیابی:</strong>{' '}
 {toPersianDigits(
 activeSubmission.startedAt
 ? new Date(activeSubmission.startedAt).toLocaleTimeString('fa-IR')
 : '—',
 )}
 </div>
 </div>

 {/* Correction Progress meter list */}
 {hasDescriptiveQuestions && (
 <div className="pane rounded-2xl p-4 text-micro text-[var(--color-text-secondary)] space-y-3">
 <span className="text-[var(--color-text-tertiary)] block pb-1 border-b">
 وضعیت تصحیح سوالات تشریحی:
 </span>
 <div className="grid grid-cols-2 gap-2 text-center text-micro">
 <div className="bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10 rounded-xl p-2">
 <span className="text-[var(--color-text-tertiary)] block text-micro">
 تایید شده
 </span>
 <span className="text-label text-[var(--color-success)] font-mono">
 {toPersianDigits(
 Object.values(savedDescriptiveQuestions).filter(Boolean).length,
 )}
 </span>
 </div>
 <div className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 rounded-xl p-2">
 <span className="text-[var(--color-text-tertiary)] block text-micro">
 در انتظار بررسی
 </span>
 <span className="text-label text-[var(--color-warning)] font-mono">
 {toPersianDigits(getUngradedDescriptiveQuestionsCount())}
 </span>
 </div>
 </div>
 </div>
 )}

 {/* 6. FINALIZE GRADINGS FEATURE */}
 {getUngradedDescriptiveQuestionsCount() > 0 && (
 <div className="bg-[var(--color-warning-soft)]/50 border border-[var(--color-warning)]/20 p-4 rounded-2xl text-[var(--color-warning)] text-micro leading-relaxed flex items-start gap-2">
 <ShieldAlert className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
 <div>
 <span className="font-extrabold block">
 توجه: برخی از سؤالات تشریحی هنوز نمره‌دهی نشده‌اند
 </span>
 <p className="font-medium mt-0.5 text-[var(--color-warning)]/80">
 جداول بارم‌بندی تشریحی مربوط به سؤالات تصحیح شده را قفل نمائید تا نمره نهایی
 آنها به طور کامل اضافه گردد.
 </p>
 </div>
 </div>
 )}

 {/* Bottom Master action keys */}
 <div className="space-y-3 pt-2">
 <Button
 type="button"
 id="btn-grading-finalize-worksheet"
 onClick={handleFinalizeGrading}
 variant="success"
 className="w-full"
 >
 <CheckCircle2 className="w-4 h-4" />
 <span>تکمیل تصحیح و ثبت نهایی کارنامه</span>
 </Button>
 <Button
 type="button"
 onClick={() => setSelectedSubmissionId(null)}
 variant="secondary"
 className="w-full border-[var(--color-glass-light-stroke)]"
 >
 <span>انصراف و بازگشت</span>
 </Button>
 </div>
 </div>
 );

}
