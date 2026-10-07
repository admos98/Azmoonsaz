import { ShieldAlert } from 'lucide-react';
import { toPersianDigits } from '../../utils/persian';

/**
 * Wave C: teacher-facing proctor report for one submission.
 * Server stores counters ONLY (no IP/UA — F-21), so this renders exactly
 * what the guard hook counted: tab switches, copy attempts, print attempts.
 * Null when there is nothing to report.
 */
export const PROCTOR_FLAG_LABELS: Record<string, string> = {
  tabHidden: 'ترک صفحه آزمون',
  windowBlur: 'خروج از فوکوس پنجره',
  copyAttempt: 'تلاش برای کپی',
  contextMenu: 'بازکردن منوی راست‌کلیک',
  printAttempt: 'تلاش برای چاپ',
  shortcutBlocked: 'میان‌بر کلیدی مسدودشده',
  fullscreenExit: 'خروج از حالت تمام‌صفحه',
};

export function ProctorFlags({
  flags,
  warningCount,
}: {
  flags?: Record<string, number>;
  warningCount?: number;
}) {
  const entries = Object.entries(flags || {}).filter(
    ([key, value]) => PROCTOR_FLAG_LABELS[key] && Number(value) > 0,
  );
  const warnings = Number(warningCount || 0);
  if (entries.length === 0 && warnings === 0) return null;
  return (
    <div
      role="status"
      data-testid="proctor-flags"
      className="lens rounded-2xl p-4 border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 space-y-2"
    >
      <div className="flex items-center gap-2 text-[var(--color-warning)]">
        <ShieldAlert className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
        <span className="font-black text-caption">گزارش نظارت آزمون</span>
      </div>
      {warnings > 0 && (
        <p className="text-caption font-bold text-[var(--color-danger)]">
          هشدار قبلی: {toPersianDigits(warnings)} مورد — تکرار تخلف منجر به
          مسدودسازی دائمی این دانش‌آموز در همین آزمون می‌شود.
        </p>
      )}
      {entries.length > 0 && (
        <ul className="text-caption text-[var(--color-text-secondary)] space-y-1">
          {entries.map(([key, value]) => (
            <li key={key} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
              {PROCTOR_FLAG_LABELS[key]}: {toPersianDigits(value)} بار
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
