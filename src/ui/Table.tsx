/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

/* ==========================================
   14. RESPONSIVE CUSTOM TABLE COMPONENT
   ========================================== */
export interface TableColumn {
  key: string;
  label: string;
  align?: 'right' | 'center' | 'left';
}

export interface TableProps<T> {
  headers: TableColumn[];
  data: T[];
  renderRow: (row: T, idx: number) => React.ReactNode;
  renderMobileCard?: (row: T, idx: number) => React.ReactNode;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyAction?: React.ReactNode;
  /** Illustration for the empty state (EmptyStateArt) — page-level tables */
  emptyArt?: React.ReactNode;
  /** Standard retry handler — renders the designed retry button in the empty state.
   *  The design system never falls back to a full page reload. */
  onRetry?: () => void;
}

export const Table = <T,>({
  headers,
  data,
  renderRow,
  renderMobileCard,
  emptyTitle = 'هیچ اطلاعاتی یافت نشد',
  emptyDesc = 'اطلاعاتی سازگار با فیلترهای کنونی در سیستم وجود ندارد.',
  emptyAction,
  emptyArt,
  onRetry,
}: TableProps<T>) => {
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDesc}
        art={emptyArt}
        action={
          emptyAction ??
          (onRetry ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onRetry}
            >
              تلاش دوباره
            </Button>
          ) : undefined)
        }
      />
    );
  }

  return (
    <div className="w-full">
      {/* Table for Desktop Viewports */}
      <div
        tabIndex={0}
        role="region"
        aria-label="جدول داده؛ برای مشاهده ستون‌های بیشتر به‌صورت افقی پیمایش کنید"
        className={`overflow-x-auto rounded-2xl border border-[var(--color-glass-light-stroke)] hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${renderMobileCard ? 'md:block' : 'block'}`}
      >
        <table className="w-full text-right border-collapse text-caption md:text-label glx-inset">
          <thead>
            <tr className="border-b border-[var(--color-glass-light-stroke)] text-[var(--color-text-tertiary)] font-bold text-micro md:text-caption">
              {headers.map((col, idx) => {
                const alignStyles: Record<NonNullable<TableColumn['align']>, string> = {
                  right: 'text-right',
                  center: 'text-center',
                  left: 'text-left',
                };
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`p-4 font-bold ${alignStyles[col.align || 'right']} ${idx === 0 ? 'rounded-r-2xl' : ''} ${idx === headers.length - 1 ? 'rounded-l-2xl' : ''}`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]">
            {data.map((row, idx) => renderRow(row, idx))}
          </tbody>
        </table>
      </div>

      {/* Cards for Mobile Viewports */}
      {renderMobileCard && (
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {data.map((row, idx) => renderMobileCard(row, idx))}
        </div>
      )}
    </div>
  );
};
