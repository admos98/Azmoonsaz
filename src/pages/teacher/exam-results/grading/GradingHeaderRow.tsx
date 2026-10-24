/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Grading panel title row: back button, student heading, proctor flags, invalidate action.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { ArrowRight, ShieldAlert } from 'lucide-react';

import { Button, IconButton } from '../../../../ui';
import { toPersianDigits } from '../../../../utils/persian';
import { ProctorFlags } from '../../../../features/exam-guard/ProctorFlags';
import type { ResultRow } from '../student-rows';

interface GradingHeaderRowProps {
 activeSubmission: ResultRow;
 assignedScores: Record<string, number>;
 setSelectedSubmissionId: (id: string | null) => void;
 setConfirmInvalidate: (v: boolean) => void;
 invalidateBusy: boolean;
}

export function GradingHeaderRow({
 activeSubmission,
 assignedScores,
 setSelectedSubmissionId,
 setConfirmInvalidate,
 invalidateBusy,
}: GradingHeaderRowProps) {
 return (
 <>
 {/* Grading panel title row */}
 <div className="pane p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div className="flex items-center gap-3">
 <IconButton
 label="بازگشت به فهرست پاسخ‌برگ‌ها"
 title="بازگشت"
 id="btn-close-and-return-list"
 size="md"
 radius="2xl"
 tone="tertiary"
 surface="bright"
 border
 motion={false}
 onClick={() => setSelectedSubmissionId(null)}
 >
 <ArrowRight className="w-5 h-5" />
 </IconButton>
 <div>
 <span className="text-micro text-[var(--color-accent)] block bg-[var(--color-accent-soft)]/30 px-2.5 py-0.5 rounded-full w-fit">
 مدیریت پاسخ‌برگ داوطلب
 </span>
 <h2 className="text-heading-3 text-[var(--color-text-primary)] mt-1">
 پاسخ‌برگ تحویلی: {activeSubmission.studentName}
 </h2>
 </div>
 </div>

 <ProctorFlags
 flags={activeSubmission.rawSubmission?.proctorFlags}
 warningCount={activeSubmission.rawSubmission?.warningCount}
 />

 <div className="flex justify-end">
 <Button
 variant="danger"
 size="sm"
 className="px-4 py-2"
 icon={<ShieldAlert className="w-4 h-4" />}
 onClick={() => setConfirmInvalidate(true)}
 disabled={invalidateBusy}
 >
 {invalidateBusy ? 'در حال اعمال...' : 'اقدام انضباطی (هشدار / مسدودسازی)'}
 </Button>
 </div>

 <div className="pane px-4 py-2.5 rounded-2xl flex items-center gap-4 text-caption">
 <div>
 <span className="text-label-muted block mb-0.5">
 ثبت نهایی ساعت:
 </span>
 <span className="font-mono text-[var(--color-text-secondary)] font-bold">
 {activeSubmission.submittedAt
 ? toPersianDigits(
 new Date(activeSubmission.submittedAt).toLocaleTimeString('fa-IR', {
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 }),
 )
 : 'در حال آزمون'}
 </span>
 </div>
 <div className="w-[1px] h-8 bg-[var(--color-glass-light-stroke)]" />
 <div className="text-left">
 <span className="text-label-muted block mb-0.5 text-right">
 میانگین پیشرفت بارم:
 </span>
 <span className="text-[var(--color-accent)] text-label block">
 %
 {toPersianDigits(
 Number(
 (
 ((Object.values(assignedScores) as number[]).reduce(
 (sum, s) => sum + s,
 0,
 ) /
 activeSubmission.maxScore) *
 100
 ).toFixed(0),
 ),
 )}
 </span>
 </div>
 </div>
 </div>
 </>
 );
}
