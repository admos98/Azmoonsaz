/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Smart reactive filters panel for the results list view.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { Filter } from 'lucide-react';

import { Dropdown, FieldLabel, SearchInput, TextLink } from '../../../ui';
import { ClassGroup, Exam } from '../../../types';

interface ResultsFiltersPanelProps {
 exam: Exam;
 classGroups: ClassGroup[];
 searchQuery: string;
 setSearchQuery: (v: string) => void;
 classFilter: string;
 setClassFilter: (v: string) => void;
 participationFilter: string;
 setParticipationFilter: (v: string) => void;
 correctionFilter: string;
 setCorrectionFilter: (v: string) => void;
 scoreRangeFilter: string;
 setScoreRangeFilter: (v: string) => void;
}

export function ResultsFiltersPanel({
 exam,
 classGroups,
 searchQuery,
 setSearchQuery,
 classFilter,
 setClassFilter,
 participationFilter,
 setParticipationFilter,
 correctionFilter,
 setCorrectionFilter,
 scoreRangeFilter,
 setScoreRangeFilter,
}: ResultsFiltersPanelProps) {
 return (
 <>
 {/* Smart Reactive Filters Panel */}
 <div className="relative lens rounded-3xl p-5 md:p-6 space-y-4">
 <div className="flex items-center justify-between border-b border-[var(--color-glass-light-stroke)] pb-3">
 <div className="flex items-center gap-2">
 <Filter className="w-4.5 h-4.5 text-[var(--color-accent)]" />
 <h2 className="text-caption font-bold text-[var(--color-text-primary)]">
 فیلترها و محدودسازی کارنامه داوطلبان
 </h2>
 </div>
 <TextLink
 size="sm"
 bold
 hover="accent"
 onClick={() => {
 setSearchQuery('');
 setClassFilter('all');
 setParticipationFilter('all');
 setCorrectionFilter('all');
 setScoreRangeFilter('all');
 }}
 >
 پاک کردن همه فیلترها
 </TextLink>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
 {/* Search query Input */}
 <div className="space-y-1.5">
 <label
 htmlFor="results-search-input"
 className="text-label-muted block"
 >
 جستجوی داوطلب بر اساس نام
 </label>
 <SearchInput
 id="results-search-input"
 placeholder="نام دانش‌آموز را بنویسید..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="text-caption"
 />
 </div>

 {/* Class Group Select */}
 <div className="space-y-1.5">
 <FieldLabel>
 فیلتر بر اساس کلاس
 </FieldLabel>
 <Dropdown
 value={classFilter}
 onChange={setClassFilter}
 options={[
 { value: 'all', label: 'همه کلاس‌ها' },
 ...classGroups
 .filter((c) => exam.classGroupIds.includes(c.id))
 .map((group) => ({ value: group.id, label: group.name })),
 ]}
 className="text-caption"
 />
 </div>

 {/* Attendance Status */}
 <div className="space-y-1.5">
 <FieldLabel>
 وضعیت ارسال پاسخ‌برگ
 </FieldLabel>
 <Dropdown
 value={participationFilter}
 onChange={setParticipationFilter}
 options={[
 { value: 'all', label: 'همه وضعیت‌ها' },
 { value: 'submitted', label: 'ارسال شده (تحویل شده)' },
 { value: 'absent', label: 'ارسال نشده (غائب)' },
 { value: 'ongoing', label: 'در حال پاسخ‌دهی زنده' },
 ]}
 className="text-caption"
 />
 </div>

 {/* Descriptive grading status */}
 <div className="space-y-1.5">
 <FieldLabel>
 وضعیت تصحیح تشریحی
 </FieldLabel>
 <Dropdown
 value={correctionFilter}
 onChange={setCorrectionFilter}
 options={[
 { value: 'all', label: 'همه وضعیت‌ها' },
 { value: 'graded', label: 'تصحیح‌شده' },
 { value: 'needs_grading', label: 'نیازمند بررسی دبیر' },
 ]}
 className="text-caption"
 />
 </div>

 {/* Score scale bounds */}
 <div className="space-y-1.5">
 <FieldLabel>
 بازه نمره نهایی دانش‌آموز
 </FieldLabel>
 <Dropdown
 value={scoreRangeFilter}
 onChange={setScoreRangeFilter}
 options={[
 { value: 'all', label: 'همه بازه‌ها' },
 { value: 'high', label: 'سطح عالی (بالای ۸۰٪ نمره کل)' },
 { value: 'mid', label: 'سطح متوسط (بین ۵۰٪ تا ۸۰٪ نمره)' },
 { value: 'low', label: 'نیازمند تلاش بیشتر (زیر ۵۰٪ نمره)' },
 ]}
 className="text-caption"
 />
 </div>
 </div>
 </div>
 </>
 );
}
