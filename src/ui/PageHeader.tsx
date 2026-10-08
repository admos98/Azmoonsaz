/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from './Button';

/* ==========================================
   18. PAGE HEADER COMPONENT
   One h1 per page (level=1 default); h2 only for sub-view headers.
   ========================================== */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Accent chip icon rendered before the title */
  icon?: React.ReactNode;
  /** Action buttons rendered at the far (inline-end) side */
  actions?: React.ReactNode;
  /** Optional back button (RTL-aware: arrow points toward the start edge) */
  back?: { label: string; onClick: () => void };
  level?: 1 | 2;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  icon,
  actions,
  back,
  level = 1,
  className = '',
}: PageHeaderProps) => {
  const Heading = (level === 1 ? 'h1' : 'h2') as 'h1';
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {back && (
        <Button
          variant="ghost"
          size="sm"
          onClick={back.onClick}
          icon={<ArrowRight className="w-4 h-4" />}
          className="shrink-0"
        >
          {back.label}
        </Button>
      )}
      {icon && (
        <div className="p-2.5 bg-[var(--color-accent-soft)] rounded-xl text-[var(--color-accent)] shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <Heading className="text-heading-3 font-black text-[var(--color-text-primary)]">
          {title}
        </Heading>
        {subtitle && (
          <p className="text-caption text-[var(--color-text-tertiary)] font-medium mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 ms-auto shrink-0">{actions}</div>}
    </div>
  );
};
