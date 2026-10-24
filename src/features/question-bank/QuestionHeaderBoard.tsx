/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Page title board for the question bank: header, card/table view toggle,
 * add-question trigger, and the image maintenance buttons.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx.
 */
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { PlusCircle, Grid, List } from 'lucide-react';
import { Button, PageHeader } from '../../ui';

export function QuestionHeaderBoard({
  viewMode,
  setViewMode,
  drawerTriggerRef,
  openCreateDrawer,
  cleaningImages,
  handleCleanupImages,
  migratingImages,
  handleMigrateImages,
}: {
  viewMode: 'card' | 'table';
  setViewMode: Dispatch<SetStateAction<'card' | 'table'>>;
  drawerTriggerRef: RefObject<HTMLElement | null>;
  openCreateDrawer: () => void;
  cleaningImages: boolean;
  handleCleanupImages: () => Promise<void>;
  migratingImages: boolean;
  handleMigrateImages: () => Promise<void>;
}) {
  return (
    <div
      className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lens p-6 rounded-3xl"
      id="questions-title-plate"
    >
      <PageHeader
        title="مدیریت بانک سوالات نهایی و تستی"
        subtitle="بانک تخصصی با پشتیبانی از ۱۱ نوع قالب تستی، تشریحی، وصل‌کردنی، مرتب‌سازی، درک‌مطلب و کلوز تست با بارگذاری متنی و تصویری"
      />

      <div className="flex items-center gap-2 w-full md:w-auto">
        {/* Card / Table Toggle */}
        <div className="glx field border rounded-xl p-1 flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'card' ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'
            }`}
            title="نمایش کارتی بخر"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'table' ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'
            }`}
            title="نمایش جدولی منظم"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Add Question Button */}
        <Button
          id="btn-add-question-trigger"
          onClick={(e) => {
            drawerTriggerRef.current = e.currentTarget;
            openCreateDrawer();
          }}
          icon={<PlusCircle className="w-4 h-4" />}
          className="flex-1 md:flex-none"
        >
          افزودن سوال جدید
        </Button>

        {/* Orphan image sweep — reaps mint-then-abandon strays */}
        <button
          type="button"
          onClick={() => void handleCleanupImages()}
          disabled={cleaningImages}
          title="حذف تصاویر بلااستفاده"
          className="px-3 py-2 btn-glass btn-glass--quiet rounded-xl text-micro cursor-pointer disabled:opacity-50 shrink-0"
        >
          {cleaningImages ? 'در حال پاک‌سازی…' : 'پاک‌سازی تصاویر بلااستفاده'}
        </button>

        {/* Legacy image migration — moves grandfathered rows into the store */}
        <button
          type="button"
          onClick={() => void handleMigrateImages()}
          disabled={migratingImages}
          title="انتقال تصاویر قدیمی به فضای امن"
          className="px-3 py-2 btn-glass btn-glass--quiet rounded-xl text-micro cursor-pointer disabled:opacity-50 shrink-0"
        >
          {migratingImages ? 'در حال انتقال…' : 'انتقال تصاویر قدیمی'}
        </button>
      </div>
    </div>
  );
}
