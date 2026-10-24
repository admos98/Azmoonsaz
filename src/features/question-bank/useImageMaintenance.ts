/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Orphan image sweep + legacy image migration handlers for the question bank.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx — state, comments,
 * and toasts are byte-identical to the page version.
 */
import { useState } from 'react';
import { teacherPost } from '../../services/teacherApi';
import { toPersianDigits } from '../../utils/persian';

export function useImageMaintenance(
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    action?: { label: string; onClick: () => void },
  ) => void,
) {
  const [cleaningImages, setCleaningImages] = useState(false);
  const [migratingImages, setMigratingImages] = useState(false);

  // Orphan image sweep: reaps mint-then-abandon strays (drawer canceled,
  // upload succeeded but no question was ever saved). Bounded server-side
  // (200/call, own folder only); re-run until nothing is reported.
  const handleCleanupImages = async () => {
    if (cleaningImages) return;
    setCleaningImages(true);
    try {
      const result = await teacherPost<{
        ok: boolean;
        deleted: string[];
        failed: string[];
        scanned: number;
      }>('/api/teacher/images/cleanup', {});
      const deleted = result?.deleted?.length || 0;
      const failed = result?.failed?.length || 0;
      if (failed > 0) {
        showToast(`پاک‌سازی تصاویر: ${toPersianDigits(deleted)} مورد حذف شد، ${toPersianDigits(failed)} مورد ناموفق بود.`, 'warning');
      } else if (deleted > 0) {
        showToast(`${toPersianDigits(deleted)} تصویر بلااستفاده پاک شد.`, 'success');
      } else {
        showToast('تصویر بلااستفاده‌ای پیدا نشد.', 'info');
      }
    } catch {
      showToast('پاک‌سازی تصاویر ممکن نشد. دوباره تلاش کنید.', 'error');
    } finally {
      setCleaningImages(false);
    }
  };

  // Legacy image migration: moves grandfathered data:/external rows into the
  // private store (server fetches/decodes, SSRF-guarded, 10/call). Re-run
  // until nothing migrates — then remote pixels stop loading entirely.
  const handleMigrateImages = async () => {
    if (migratingImages) return;
    setMigratingImages(true);
    try {
      const result = await teacherPost<{
        ok: boolean;
        migrated: { questionId: string; path: string; key: string }[];
        skipped: { questionId: string; path: string; reason: string }[];
      }>('/api/teacher/images/migrate', {});
      const done = result?.migrated?.length || 0;
      const skipped = result?.skipped?.length || 0;
      if (done > 0 && skipped > 0) {
        showToast(`انتقال تصاویر: ${toPersianDigits(done)} مورد منتقل شد، ${toPersianDigits(skipped)} مورد نیازمند بررسی است.`, 'warning');
      } else if (done > 0) {
        showToast(`${toPersianDigits(done)} تصویر قدیمی به فضای امن منتقل شد.`, 'success');
      } else if (skipped > 0) {
        showToast('تصویری منتقل نشد؛ موارد باقی‌مانده نیازمند بررسی است.', 'warning');
      } else {
        showToast('تصویر قدیمی برای انتقال پیدا نشد.', 'info');
      }
    } catch {
      showToast('انتقال تصاویر ممکن نشد. دوباره تلاش کنید.', 'error');
    } finally {
      setMigratingImages(false);
    }
  };

  return { cleaningImages, migratingImages, handleCleanupImages, handleMigrateImages };
}
