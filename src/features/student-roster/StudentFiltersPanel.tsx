/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Students page filter board — the multi-filter panel (search, grade, class
 * group, status) and the sort/page-size/pager row, moved verbatim from
 * src/pages/teacher/Students.tsx (de-indented). Presentational: filter
 * state and setters in, JSX out.
 */
import { Activity, Filter, GraduationCap } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Dropdown, PillButton, SearchInput } from '../../ui';
import { toPersianDigits } from '../../utils/persian';
import type { ClassGroup } from '../../types';

export type StudentFiltersPanelProps = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedGrade: string;
  setSelectedGrade: (value: string) => void;
  selectedClassGroup: string;
  setSelectedClassGroup: (value: string) => void;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  resetSelectedGrade: () => void;
  resetSelectedClassGroup: () => void;
  resetSelectedStatus: () => void;
  classGroups: ClassGroup[];
};

export function StudentFiltersPanel({
  searchQuery,
  setSearchQuery,
  selectedGrade,
  setSelectedGrade,
  selectedClassGroup,
  setSelectedClassGroup,
  selectedStatus,
  setSelectedStatus,
  resetSelectedGrade,
  resetSelectedClassGroup,
  resetSelectedStatus,
  classGroups,
}: StudentFiltersPanelProps) {
  return (
    <>
    {/* Multi-Filter Panel: Search, Grade, Class Group, and Status! */}
    <div
      className="relative lens p-5 rounded-2xl flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center"
      id="multi-filter-wrapper"
    >
      {/* Real-time search by name/nationalId */}
      <div className="flex-1 max-w-md">
        <SearchInput
          placeholder="جستجوی دانش‌آموز با نام و کد ملی..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Selective Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Grade filter */}
        <div className="flex items-center gap-1.5 glx field border px-3 py-1.5 rounded-xl">
          <Filter className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          <span className="text-label-muted">
            پایه تحصیلی:
          </span>
          <Dropdown
            id="filter-grade"
            compact
            value={selectedGrade}
            onChange={(v) => setSelectedGrade(v)}
            options={[
              { value: 'all', label: 'همه پایه‌ها' },
              { value: 'هفتم', label: 'پایه هفتم' },
              { value: 'هشتم', label: 'پایه هشتم' },
              { value: 'نهم', label: 'پایه نهم' },
            ]}
          />
        </div>

        {/* Class Group filter */}
        <div className="flex items-center gap-1.5 glx field border px-3 py-1.5 rounded-xl">
          <GraduationCap className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          <span className="text-label-muted">
            گروه کلاسی:
          </span>
          <Dropdown
            id="filter-class"
            compact
            value={selectedClassGroup}
            onChange={(v) => setSelectedClassGroup(v)}
            options={[
              { value: 'all', label: 'همه کلاس‌ها' },
              ...classGroups.map((cg) => ({ value: cg.id, label: cg.name })),
            ]}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 glx field border px-3 py-1.5 rounded-xl">
          <Activity className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          <span className="text-label-muted">
            وضعیت دانش‌آموز:
          </span>
          <Dropdown
            id="filter-status"
            compact
            value={selectedStatus}
            onChange={(v) => setSelectedStatus(v)}
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'active', label: 'فعال' },
              { value: 'examining', label: 'در حال آزمون' },
              { value: 'suspended', label: 'کاربر غیرفعال' },
            ]}
          />
        </div>

        {/* Clear Filter button if active */}
        {(searchQuery ||
          selectedGrade !== 'all' ||
          selectedClassGroup !== 'all' ||
          selectedStatus !== 'all') && (
          <PillButton
            fill="danger-soft"
            size="sm"
            radius="lg"
            onClick={() => {
              setSearchQuery('');
              resetSelectedGrade();
              resetSelectedClassGroup();
              resetSelectedStatus();
            }}
            className="hover:bg-[var(--color-danger-soft)]/40 transition-all"
          >
            حذف فیلترها
          </PillButton>
        )}
      </div>
    </div>
    </>
  );
}

export type StudentSortBarProps = {
  sortOrder: 'name' | 'grade';
  setSortOrder: (value: 'name' | 'grade') => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  safePage: number;
};

export function StudentSortBar({
  sortOrder,
  setSortOrder,
  pageSize,
  setPageSize,
  setCurrentPage,
  totalPages,
  safePage,
}: StudentSortBarProps) {
  return (
    <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <label htmlFor="student-sort" className="font-bold">
          مرتب‌سازی
        </label>
        <Dropdown
          id="student-sort"
          compact
          value={sortOrder}
          onChange={(v) => {
            setSortOrder(v as 'name' | 'grade');
            setCurrentPage(1);
          }}
          options={[
            { value: 'name', label: 'نام' },
            { value: 'grade', label: 'پایه' },
          ]}
          className="w-24"
        />
        <label htmlFor="student-page-size" className="font-bold">
          در هر صفحه
        </label>
        <Dropdown
          id="student-page-size"
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
    </>
  );
}
