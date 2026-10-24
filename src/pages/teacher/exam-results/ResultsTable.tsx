/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Structured submissions table (desktop rows + mobile cards) for the results list view.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { AlertCircle, Check } from 'lucide-react';

import { Button, Card, Table } from '../../../ui';
import { EmptyStateArt } from '../../../components/EmptyStateArt';
import { toPersianDigits } from '../../../utils/persian';
import type { CollectionKey } from '../../../contexts/TeacherContext';
import type { ResultRow } from './student-rows';

interface ResultsTableProps {
 filteredRows: ResultRow[];
 startGrading: (row: ResultRow) => void;
 reload: (key: CollectionKey) => Promise<void>;
}

export function ResultsTable({
 filteredRows,
 startGrading,
 reload,
}: ResultsTableProps) {
 return (
 <Table
 headers={[
 { key: 'student', label: 'داوطلب سنجش' },
 { key: 'nationalId', label: 'کد ملی داوطلب' },
 { key: 'class', label: 'کلاس آموزشی' },
 { key: 'participation', label: 'وضعیت شرکت', align: 'center' },
 { key: 'startedAt', label: 'شروع', align: 'center' },
 { key: 'submittedAt', label: 'ارسال', align: 'center' },
 { key: 'autoScore', label: 'تستی (خودکار)', align: 'center' },
 { key: 'descriptive', label: 'تصحیح تشریحی', align: 'center' },
 { key: 'finalScore', label: 'نمره نهایی', align: 'center' },
 { key: 'action', label: 'عملیات', align: 'center' },
 ]}
 data={filteredRows}
 emptyTitle="هیچ داوطلبی یافت نشد"
 emptyDesc="هیچ داوطلبی مطابق فیلترهای کنونی در پایگاه داده پیدا نشد."
 emptyArt={<EmptyStateArt kind="grading" />}
 onRetry={() => void reload('submissions')}
 renderRow={(row) => {
 const hasSubmitted = row.status === 'submitted';
 const isGraded = row.status === 'graded';
 const isOngoing = row.status === 'ongoing';
 const isAbsent = row.status === 'absent';

 return (
 <tr
 key={row.id}
 className="hover:brightness-105 transition-all font-medium text-caption md:text-label"
 >
 <td className="p-4 font-bold text-[var(--color-text-primary)]">
 {row.studentName}
 </td>
 <td className="p-4 font-mono text-[var(--color-text-tertiary)] tracking-wider">
 {toPersianDigits(row.maskedNationalId)}
 </td>
 <td className="p-4 text-[var(--color-text-secondary)] font-bold">
 {row.className}
 </td>
 <td className="p-4 text-center">
 <span
 className={`inline-flex px-2.5 py-1 rounded-full text-micro font-bold border ${
 isGraded || hasSubmitted
 ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15'
 : isOngoing
 ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/10 animate-pulse'
 : 'glx-inset text-[var(--color-text-tertiary)] border-[var(--color-glass-light-stroke)]'
 }`}
 >
 {isGraded || hasSubmitted
 ? 'ارسال شده'
 : isOngoing
 ? 'در حال آزمون'
 : 'ارسال نشده'}
 </span>
 </td>
 <td className="p-4 text-center font-mono text-[var(--color-text-tertiary)]">
 {row.startedAt
 ? toPersianDigits(
 new Date(row.startedAt).toLocaleTimeString('fa-IR', {
 hour: '2-digit',
 minute: '2-digit',
 }),
 )
 : '—'}
 </td>
 <td className="p-4 text-center font-mono text-[var(--color-text-tertiary)]">
 {row.submittedAt
 ? toPersianDigits(
 new Date(row.submittedAt).toLocaleTimeString('fa-IR', {
 hour: '2-digit',
 minute: '2-digit',
 }),
 )
 : '—'}
 </td>
 <td className="p-4 text-center font-extrabold text-[var(--color-accent)]">
 {isAbsent || isOngoing ? '—' : toPersianDigits(row.autoScore)}
 </td>
 <td className="p-4 text-center">
 {isAbsent || isOngoing ? (
 <span className="text-[var(--color-text-tertiary)]">—</span>
 ) : !row.hasDescriptive ? (
 <span className="text-label-muted text-[var(--color-text-secondary)]">
 تستی محض
 </span>
 ) : isGraded ? (
 <span className="inline-flex items-center gap-1 text-[var(--color-success)] font-bold bg-[var(--color-success-soft)]/60 px-2 py-0.5 rounded-md border border-[var(--color-success)]/10 text-caption">
 <Check className="w-3.5 h-3.5" />
 <span>تصحیح‌شده</span>
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-[var(--color-danger)] font-bold bg-[var(--color-danger-soft)]/60 px-2 py-0.5 rounded-md border border-[var(--color-danger)]/10 animate-pulse text-caption">
 <AlertCircle className="w-3.5 h-3.5" />
 <span>نیازمند تصحیح</span>
 </span>
 )}
 </td>
 <td className="p-4 text-center font-black text-[var(--color-text-primary)]">
 {isAbsent ? (
 <span className="text-[var(--color-danger)] bg-[var(--color-danger-soft)]/60 font-bold px-2 py-0.5 rounded border border-[var(--color-danger)]/10 text-caption">
 غایب
 </span>
 ) : isOngoing ? (
 <span className="text-[var(--color-text-tertiary)]">—</span>
 ) : (
 <span>
 {toPersianDigits(row.score)}{' '}
 <span className="text-micro text-[var(--color-text-tertiary)] font-normal">
 از {toPersianDigits(row.maxScore)}
 </span>
 </span>
 )}
 </td>
 <td className="p-4 text-center">
 <Button
 id={`btn-open-review-panel-${row.id}`}
 onClick={() => startGrading(row)}
 disabled={isAbsent || isOngoing}
 variant={isGraded ? 'primary' : 'danger'}
 size="sm"
 >
 {isGraded ? 'بازبینی پاسخ‌ها' : 'تصحیح و بررسی ورقه'}
 </Button>
 </td>
 </tr>
 );
 }}
 renderMobileCard={(row) => {
 const hasSubmitted = row.status === 'submitted';
 const isGraded = row.status === 'graded';
 const isOngoing = row.status === 'ongoing';
 const isAbsent = row.status === 'absent';
 return (
 <Card
 hoverable
 key={row.id}
 className="p-4 space-y-3"
 id={`submission-mob-card-${row.id}`}
 >
 <div className="flex justify-between items-center text-caption">
 <span className="font-bold text-[var(--color-text-primary)]">
 {row.studentName}
 </span>
 <span
 className={`inline-flex px-2 py-0.5 rounded-full text-micro font-bold border ${
 isGraded || hasSubmitted
 ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15'
 : isOngoing
 ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/10 animate-pulse'
 : 'bg-[var(--color-glass-light-fill)] text-[var(--color-text-tertiary)] border-[var(--color-glass-light-stroke)]'
 }`}
 >
 {isGraded || hasSubmitted
 ? 'ارسال شده'
 : isOngoing
 ? 'در حال آزمون'
 : 'ارسال نشده'}
 </span>
 </div>
 <div className="text-micro text-[var(--color-text-tertiary)] space-y-1">
 <p>کلاس: {row.className}</p>
 <p>
 کد ملی:{' '}
 <span className="font-mono">{toPersianDigits(row.maskedNationalId)}</span>
 </p>
 <p>
 تحویل:{' '}
 {row.submittedAt
 ? toPersianDigits(
 new Date(row.submittedAt).toLocaleTimeString('fa-IR', {
 hour: '2-digit',
 minute: '2-digit',
 }),
 )
 : '—'}
 </p>
 <p className="font-bold text-[var(--color-accent)]">
 نمره:{' '}
 {isAbsent
 ? 'غایب'
 : isOngoing
 ? 'در جریان'
 : `${toPersianDigits(row.score)} از ${toPersianDigits(row.maxScore)}`}
 </p>
 </div>
 <div className="pt-2 flex justify-end">
 <Button
 onClick={() => startGrading(row)}
 disabled={isAbsent || isOngoing}
 variant={isGraded ? 'primary' : 'danger'}
 size="sm"
 className="w-full"
 >
 {isGraded ? 'بازبینی پاسخ‌ها' : 'تصحیح و بررسی ورقه'}
 </Button>
 </div>
 </Card>
 );
 }}
 />
 );

}
