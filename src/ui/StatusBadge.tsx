/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Badge, type BadgeProps } from './Badge';

/* ==========================================
   4. STATUS BADGE COMPONENT
   ========================================== */
export interface StatusBadgeProps {
  status:
    | 'draft'
    | 'scheduled'
    | 'active'
    | 'completed'
    | 'ongoing'
    | 'submitted'
    | 'graded'
    | 'absent'
    | 'present'
    | 'needs-grading'
    | 'expired'
    | 'invalidated';
  className?: string;
}

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  // Canonical status labels + tones for the whole app (one source of truth).
  // Live states pulse — the only place that animation is allowed.
  const config: Record<
    StatusBadgeProps['status'],
    { variant: BadgeProps['variant']; label: string; live?: boolean }
  > = {
    draft: { variant: 'info', label: 'پیش\u200cنویس' },
    scheduled: { variant: 'info', label: 'برنامه\u200cریزی شده' },
    active: { variant: 'warning', label: 'در حال برگزاری', live: true },
    completed: { variant: 'success', label: 'برگزار شده' },
    ongoing: { variant: 'warning', label: 'در حال آزمون', live: true },
    submitted: { variant: 'info', label: 'تحویل داده شده' },
    graded: { variant: 'success', label: 'تصحیح شده' },
    expired: { variant: 'danger', label: 'منقضی شده' },
    invalidated: { variant: 'danger', label: 'مسدود شده' },
    absent: { variant: 'danger', label: 'غایب' },
    present: { variant: 'success', label: 'حاضر' },
    'needs-grading': { variant: 'warning', label: 'نیازمند تصحیح' },
  };

  const item = config[status] || { variant: 'info' as const, label: String(status) };

  return (
    <Badge variant={item.variant} className={`${item.live ? 'animate-pulse ' : ''}${className}`}>
      {item.label}
    </Badge>
  );
};
