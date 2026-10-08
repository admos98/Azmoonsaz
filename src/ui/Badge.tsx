/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/* ==========================================
   3. BADGE COMPONENT
   ========================================== */
export interface BadgeProps {
  variant?: 'primary' | 'slate' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ variant = 'info', children, className = '' }: BadgeProps) => {
  const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary:
      'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-soft)]',
    slate: 'glx-inset text-[var(--color-text-secondary)] border-[var(--color-glass-light-stroke)]',
    success:
      'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/10',
    warning:
      'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/10',
    danger:
      'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]/10',
    info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]/10',
    accent:
      'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]/10',
  };

  const styleString = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-micro font-bold rounded-lg border leading-none ${styleString} ${className}`}
    >
      {children}
    </span>
  );
};
