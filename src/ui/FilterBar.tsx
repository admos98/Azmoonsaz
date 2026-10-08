/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/* ==========================================
   23. FILTER BAR COMPONENT
   One row: search + dropdown filters + optional clear-all.
   ========================================== */
export interface FilterBarProps {
  /** SearchInput slot — rendered first */
  search?: React.ReactNode;
  /** Dropdown filters and other inline controls */
  children?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearAll?: () => void;
  className?: string;
}

export const FilterBar = ({
  search,
  children,
  hasActiveFilters = false,
  onClearAll,
  className = '',
}: FilterBarProps) => {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {search}
      {children}
      {hasActiveFilters && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          icon={<X className="w-3.5 h-3.5" />}
          className="ms-auto"
        >
          پاک کردن فیلترها
        </Button>
      )}
    </div>
  );
};
