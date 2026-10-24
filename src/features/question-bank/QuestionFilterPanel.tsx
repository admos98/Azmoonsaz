/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Comprehensive multi-filter panel + sort/pagination bar for the question
 * bank.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx — filter state is
 * owned by useQuestionFilters and threaded in value/setter by value/setter
 * with the same identifiers the page previously closed over.
 */
import { Sliders } from 'lucide-react';
import { Button, Dropdown, FieldLabel, PillButton, SearchInput } from '../../ui';
import { toPersianDigits } from '../../utils/persian';
import type { Dispatch, SetStateAction } from 'react';

export function QuestionFilterPanel({
  searchQuery,
  setSearchQuery,
  selectedType,
  setSelectedType,
  selectedGrade,
  setSelectedGrade,
  selectedSubject,
  setSelectedSubject,
  uniqueSubjects,
  selectedSection,
  setSelectedSection,
  uniqueSections,
  selectedDifficulty,
  setSelectedDifficulty,
  selectedTag,
  setSelectedTag,
  uniqueTags,
  selectedStatus,
  setSelectedStatus,
  hasActiveFilters,
  clearAllFilters,
}: {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  selectedType: string;
  setSelectedType: (value: string) => void;
  selectedGrade: string;
  setSelectedGrade: (value: string) => void;
  selectedSubject: string;
  setSelectedSubject: (value: string) => void;
  uniqueSubjects: string[];
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  uniqueSections: string[];
  selectedDifficulty: string;
  setSelectedDifficulty: (value: string) => void;
  selectedTag: string;
  setSelectedTag: (value: string) => void;
  uniqueTags: string[];
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
}) {
  return (
      <div className="lens p-6 rounded-3xl space-y-4" id="filters-container">
        <div className="flex items-center gap-2 border-b border-[var(--color-glass-light-stroke)] pb-2.5 mb-2">
          <Sliders className="w-4 h-4 text-[var(--color-accent)]" />
          <h2 className="text-caption font-bold text-[var(--color-text-secondary)]">
            جستجوی موضوعی و پالایش هوشمند سوالات
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search text */}
          <div className="space-y-1">
            <FieldLabel>
              جستجو در متن سوال یا برچسب‌ها:
            </FieldLabel>
            <SearchInput
              placeholder="کلمه کلیدی، عنوان، هشتگ یا درس..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="space-y-1">
            <FieldLabel>
              نوع قالب‌بندی سوال:
            </FieldLabel>
            <Dropdown
              compact
              value={selectedType}
              onChange={(v) => setSelectedType(v)}
              options={[
                { value: 'all', label: 'همه قالب‌ها (۱۱ نوع)' },
                { value: 'single_choice', label: 'چهارگزینه‌ای تک‌پاسخ' },
                { value: 'multiple_choice', label: 'چندگزینه‌ای چندپاسخ' },
                { value: 'true_false', label: 'درست / نادرست' },
                { value: 'matching', label: 'وصل‌کردنی / تطبیقی' },
                { value: 'ordering', label: 'مرتب‌سازی ترتیبی' },
                { value: 'fill_blank', label: 'جای خالی (تک کلمه‌ای)' },
                { value: 'short_answer', label: 'پاسخ کوتاه تشریحی' },
                { value: 'long_answer', label: 'تشریحی بلند' },
                { value: 'cloze', label: 'کلوز تست (Cloze)' },
                { value: 'reading_comprehension', label: 'درک مطلب متنی' },
                { value: 'image_based', label: 'سوال تصویری' },
              ]}
            />
          </div>

          {/* Grade Filter */}
          <div className="space-y-1">
            <FieldLabel>
              پایه تحصیلی:
            </FieldLabel>
            <Dropdown
              compact
              value={selectedGrade}
              onChange={(v) => setSelectedGrade(v)}
              options={[
                { value: 'all', label: 'همه پایه‌ها' },
                { value: 'اول', label: 'اول', group: 'دبستان' },
                { value: 'دوم', label: 'دوم', group: 'دبستان' },
                { value: 'سوم', label: 'سوم', group: 'دبستان' },
                { value: 'چهارم', label: 'چهارم', group: 'دبستان' },
                { value: 'پنجم', label: 'پنجم', group: 'دبستان' },
                { value: 'ششم', label: 'ششم', group: 'دبستان' },
                { value: 'هفتم', label: 'هفتم', group: 'دوره اول متوسطه' },
                { value: 'هشتم', label: 'هشتم', group: 'دوره اول متوسطه' },
                { value: 'نهم', label: 'نهم', group: 'دوره اول متوسطه' },
                { value: 'دهم', label: 'دهم', group: 'دوره دوم متوسطه' },
                { value: 'یازدهم', label: 'یازدهم', group: 'دوره دوم متوسطه' },
                { value: 'دوازدهم', label: 'دوازدهم', group: 'دوره دوم متوسطه' },
              ]}
            />
          </div>

          {/* Subject Filter */}
          <div className="space-y-1">
            <FieldLabel>
              درس یا موضوع:
            </FieldLabel>
            <Dropdown
              compact
              value={selectedSubject}
              onChange={(v) => setSelectedSubject(v)}
              options={[
                { value: 'all', label: 'همه درس‌ها' },
                ...uniqueSubjects.map((sub) => ({ value: sub, label: sub })),
              ]}
            />
          </div>

          {/* Section/Chapter Filter */}
          <div className="space-y-1">
            <FieldLabel>
              بخش یا فصل کتاب:
            </FieldLabel>
            <Dropdown
              compact
              value={selectedSection}
              onChange={(v) => setSelectedSection(v)}
              options={[
                { value: 'all', label: 'همه فصل‌ها' },
                ...uniqueSections.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          {/* Difficulty Filter */}
          <div className="space-y-1">
            <FieldLabel>
              سطح سختی سوال:
            </FieldLabel>
            <Dropdown
              compact
              value={selectedDifficulty}
              onChange={(v) => setSelectedDifficulty(v)}
              options={[
                { value: 'all', label: 'همه سطوح' },
                { value: 'easy', label: 'آسان' },
                { value: 'medium', label: 'متوسط' },
                { value: 'hard', label: 'سخت' },
              ]}
            />
          </div>

          {/* Selective Tag Filter */}
          <div className="space-y-1">
            <FieldLabel>
              برچسب‌ها (هشتگ):
            </FieldLabel>
            <Dropdown
              compact
              value={selectedTag}
              onChange={(v) => setSelectedTag(v)}
              options={[
                { value: 'all', label: 'همه برچسب‌ها' },
                ...uniqueTags.map((t) => ({ value: t, label: `#${t}` })),
              ]}
            />
          </div>

          {/* Completeness Status Filter */}
          <div className="space-y-1">
            <FieldLabel>
              وضعیت کاملی سوال:
            </FieldLabel>
            <Dropdown
              compact
              value={selectedStatus}
              onChange={(v) => setSelectedStatus(v)}
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'complete', label: 'کامل (دارای جواب معتبر)' },
                { value: 'incomplete', label: 'ناقص (پیشنویس)' },
              ]}
            />
          </div>
        </div>

        {/* Clear Filter tags */}
        {hasActiveFilters && (
          <div className="flex justify-start pt-2 border-t border-[var(--color-glass-light-stroke)]">
            <PillButton
              fill="danger-soft"
              size="lg"
              radius="lg"
              onClick={clearAllFilters}
              className="hover:bg-[var(--color-danger-soft)]/40 transition-all"
            >
              حذف فیلترها و نمایش همگانی
            </PillButton>
          </div>
        )}
      </div>
  );
}

export function QuestionSortPaginationBar({
  sortOrder,
  setSortOrder,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  safePage,
}: {
  sortOrder: 'newest' | 'oldest' | 'title';
  setSortOrder: (value: 'newest' | 'oldest' | 'title') => void;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  setPageSize: (value: number) => void;
  totalPages: number;
  safePage: number;
}) {
  return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-caption">
          <label htmlFor="question-sort" className="font-bold">
            مرتب‌سازی
          </label>
          <Dropdown
            id="question-sort"
            compact
            value={sortOrder}
            onChange={(v) => {
              setSortOrder(v as 'newest' | 'oldest' | 'title');
              setCurrentPage(1);
            }}
            options={[
              { value: 'newest', label: 'جدیدترین' },
              { value: 'oldest', label: 'قدیمی‌ترین' },
              { value: 'title', label: 'عنوان' },
            ]}
            className="w-28"
          />
          <label htmlFor="question-page-size" className="font-bold">
            در هر صفحه
          </label>
          <Dropdown
            id="question-page-size"
            compact
            value={String(pageSize)}
            onChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
            options={[
              { value: '10', label: '۱۰' },
              { value: '20', label: '۲۰' },
              { value: '50', label: '۵۰' },
            ]}
            className="w-20"
          />
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-caption">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              قبلی
            </Button>
            <span aria-live="polite">
              صفحه {toPersianDigits(safePage)} از {toPersianDigits(totalPages)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              بعدی
            </Button>
          </div>
        )}
      </div>
  );
}
