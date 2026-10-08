/**
 * Persian labels for proctored-exam violation flags.
 *
 * Lives in its own module so ProctorFlags.tsx only exports components
 * (react-refresh/only-export-components is gated at --max-warnings 0).
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
