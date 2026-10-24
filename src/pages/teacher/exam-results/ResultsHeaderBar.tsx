/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Top navigation & action title header bar for the results list view.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { ArrowRight, Download, FileSpreadsheet } from 'lucide-react';

import { Button, IconButton } from '../../../ui';
import { Exam } from '../../../types';

interface ResultsHeaderBarProps {
 exam: Exam;
 onBack: () => void;
 handleExportCSV: () => void;
 handleExportExcel: () => void;
}

export function ResultsHeaderBar({
 exam,
 onBack,
 handleExportCSV,
 handleExportExcel,
}: ResultsHeaderBarProps) {
 return (
 <>
 {/* Top Navigation & Action Title Raw header bar */}
 <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lens p-6 rounded-3xl">
 <div className="flex items-center gap-4">
 <IconButton
 id="btn-return-exams-list-arrow"
 label="بازگشت به آزمون‌ها"
 title="بازگشت به آزمون‌ها"
 size="md"
 radius="2xl"
 tone="tertiary"
 surface="bright"
 border
 onClick={onBack}
 >
 <ArrowRight className="w-5 h-5" />
 </IconButton>
 <div>
 <div className="flex items-center gap-2">
 <span className="px-2.5 py-0.5 rounded-full text-micro bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
 دبیرخانه آنلاین آزمون‌ساز
 </span>
 <span className="text-[var(--color-text-tertiary)] text-caption">/</span>
 <span className="text-label-muted">
 ارزیابی پیشرفته تستی و تشریحی
 </span>
 </div>
 <h1 className="text-body md:text-heading-3 font-bold text-[var(--color-text-primary)] mt-1">
 نتایج و تصحیح آزمون
 </h1>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-0.5">
 {exam.title}
 </p>
 </div>
 </div>

 {/* Advanced Export actions */}
 <div className="flex items-center gap-2 self-stretch md:self-auto">
 <Button
 onClick={handleExportCSV}
 variant="secondary"
 className="flex-1 md:flex-initial"
 icon={<Download className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
 id="btn-export-csv"
 >
 خروجی CSV
 </Button>
 <Button
 onClick={handleExportExcel}
 variant="success"
 className="flex-1 md:flex-initial"
 icon={<FileSpreadsheet className="w-4 h-4" />}
 id="btn-export-excel"
 >
 خروجی Excel
 </Button>
 </div>
 </div>
 </>
 );
}
