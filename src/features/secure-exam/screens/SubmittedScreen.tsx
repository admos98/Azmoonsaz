/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ConfirmDialog } from '../../../ui';
import { toPersianDigits } from '../../../utils/persian';
import type { ExamSession } from '../useExamSession';

/** Terminal state after the server accepts the final submission. */
export function SubmittedScreen() {
  return (
    <div className="lens rounded-3xl p-6 md:p-8 max-w-xl mx-auto text-center space-y-4">
      <CheckCircle2 className="w-16 h-16 text-[var(--color-success)] mx-auto" />
      <h2 className="text-[var(--color-text-primary)] text-heading-3">
        پاسخ شما با موفقیت در سامانه ثبت نهایی شد.
      </h2>
      <p className="text-caption text-[var(--color-text-tertiary)] leading-relaxed">
        پس از ارسال نهایی، نشست آزمون قفل شده و امکان تغییر پاسخ‌ها وجود ندارد. برای مشاهده
        کارنامه یا نتایج به دستورالعمل دبیر خود مراجعه نمایید.
      </p>
    </div>
  );
}

/** Shared error banner (auth, save, sync, submit). */
export function ExamErrorBanner({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="mb-5 bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/20 text-[var(--color-danger)]/80 rounded-2xl p-4 text-caption font-bold flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );
}

/** Designed confirmation for irreversible exam actions — never browser chrome. */
export function ExamConfirmDialogs({ session }: { session: ExamSession }) {
  const { confirmStage, queuedCount, handleConfirmSync, dismissConfirm, runFinalSubmit } = session;

  return (
    <>
      <ConfirmDialog
        isOpen={confirmStage === 'sync-queued'}
        title="همگام‌سازی پاسخ‌های آفلاین"
        message={`شما ${toPersianDigits(queuedCount)} پاسخ همگام‌نشدهٔ آفلاین دارید. ابتدا تلاش شود پاسخ‌ها به سرور ارسال شوند؟`}
        confirmText="همگام‌سازی و ادامه"
        cancelText="انصراف"
        onConfirm={handleConfirmSync}
        onCancel={dismissConfirm}
      />
      <ConfirmDialog
        isOpen={confirmStage === 'final-submit'}
        title="ارسال نهایی آزمون"
        message="آیا از ارسال نهایی آزمون مطمئن هستید؟ پس از ارسال امکان تغییر پاسخ‌ها وجود ندارد."
        confirmText="ارسال نهایی"
        cancelText="انصراف"
        variant="danger"
        onConfirm={runFinalSubmit}
        onCancel={dismissConfirm}
      />
    </>
  );
}
