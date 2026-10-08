/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';

/* ==========================================
   11. EMPTY STATE COMPONENT
   ========================================== */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Compact variant for inline spots: table cells, pickers, modal bodies */
  compact?: boolean;
  /** CTA directly under the title — for panels whose action would otherwise
      clip at the viewport bottom (Round-1 1E) */
  actionFirst?: boolean;
  /** Real empty-state illustration above the title (EmptyStateArt).
      Page-level states only — compact stays icon-only (Round-1 1K). */
  art?: React.ReactNode;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  compact = false,
  actionFirst = false,
  art,
}: EmptyStateProps) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center border border-dashed glx field ${
        compact ? 'p-6 md:p-8 space-y-2.5 rounded-2xl' : 'p-10 md:p-14 space-y-4 rounded-3xl'
      }`}
    >
      {!compact && art ? (
        art
      ) : (
        <div
          className={`bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-full ${
            compact ? 'p-2.5' : 'p-4'
          }`}
        >
          {icon || <HelpCircle className={compact ? 'w-5 h-5' : 'w-8 h-8'} />}
        </div>
      )}
      <div className={`space-y-1 w-full ${compact ? 'max-w-xs' : 'max-w-sm'}`}>
        <h4
          className={`font-bold text-[var(--color-text-primary)] ${
            compact ? 'text-caption md:text-label' : 'text-label md:text-body'
          }`}
        >
          {title}
        </h4>
        {actionFirst && action && <div className="pt-2">{action}</div>}
        <p
          className={`text-[var(--color-text-tertiary)] font-medium leading-relaxed ${
            compact ? 'text-micro md:text-caption' : 'text-caption'
          }`}
        >
          {description}
        </p>
      </div>
      {!actionFirst && action && <div className={compact ? 'pt-1' : 'pt-2'}>{action}</div>}
    </div>
  );
};
