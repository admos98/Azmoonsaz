/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card } from './Card';

/* ==========================================
   19. STAT CARD COMPONENT
   ========================================== */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Micro footnote under the value — color comes from footnoteTone */
  footnote?: React.ReactNode;
  footnoteTone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Color override for the value line (defaults to primary ink) */
  valueClassName?: string;
  icon?: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** inset when the card sits inside an already-glass panel, light when standalone */
  glassLayer?: 'light' | 'inset';
  valueSize?: 'lg' | 'md';
  id?: string;
  className?: string;
}

const statToneChips: Record<NonNullable<StatCardProps['tone']>, string> = {
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  neutral: 'glx-inset text-[var(--color-text-secondary)]',
};

const statToneText: Record<NonNullable<StatCardProps['footnoteTone']>, string> = {
  accent: 'text-[var(--color-accent)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
  /* neutral footnotes read as text-secondary, not tertiary — tertiary on the
     inset fill measured ~1.9:1 in the pics audit ("invisible values"). */
  neutral: 'text-[var(--color-text-secondary)]',
};

export const StatCard = ({
  label,
  value,
  unit,
  footnote,
  footnoteTone = 'neutral',
  valueClassName = '',
  icon,
  tone = 'accent',
  glassLayer = 'inset',
  valueSize = 'lg',
  id,
  className = '',
}: StatCardProps) => {
  return (
    <Card glassLayer={glassLayer} id={id} className={`flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-[var(--color-text-tertiary)]">{label}</span>
        {icon && <div className={`p-2.5 rounded-xl shrink-0 ${statToneChips[tone]}`}>{icon}</div>}
      </div>
      <div className="mt-4">
        <span
          className={`font-black tracking-tight leading-tight block ${
            valueSize === 'lg' ? 'text-heading-1' : 'text-heading-2'
          } ${valueClassName || 'text-[var(--color-text-primary)]'}`}
        >
          {value}
          {unit && (
            <span className="text-caption font-normal text-[var(--color-text-secondary)]">
              {' '}
              {unit}
            </span>
          )}
        </span>
        {footnote && (
          <span className={`text-micro font-semibold mt-1.5 block ${statToneText[footnoteTone]}`}>
            {footnote}
          </span>
        )}
      </div>
    </Card>
  );
};
