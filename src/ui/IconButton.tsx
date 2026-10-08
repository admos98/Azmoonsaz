/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FOCUS_RING } from './shared';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** REQUIRED accessible name — an icon-only control has no visible text */
  label: string;
  /** padding step: xs p-1 · sm p-1.5 · md p-2 (omit for padding-free glyphs) */
  size?: 'xs' | 'sm' | 'md';
  radius?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
  tone?: 'danger' | 'accent' | 'tertiary' | 'secondary' | 'inherit';
  /** hover material: wash = soft background, bright = brightness, plain = ink shift */
  surface?: 'wash' | 'bright' | 'plain' | 'plainMuted' | 'none';
  /** subtle glass stroke (border-glass-light-stroke) */
  border?: boolean;
  /** default true — pass false only to reproduce legacy no-transition buttons */
  motion?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      size,
      radius,
      tone = 'tertiary',
      surface = 'bright',
      border = false,
      motion = true,
      className = '',
      ...props
    },
    ref,
  ) => {
    const sizes = { xs: 'p-1', sm: 'p-1.5', md: 'p-2' };
    const radii = {
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      full: 'rounded-full',
    };
    // tone ink × hover material — the exact pairs the hand-rolled corpus used
    const ink: Record<string, string> = {
      danger: 'text-[var(--color-danger)]',
      accent: 'text-[var(--color-accent)]',
      tertiary: 'text-[var(--color-text-tertiary)]',
      secondary: 'text-[var(--color-text-secondary)]',
      inherit: '',
    };
    const material: Record<string, string> = {
      'danger:wash': 'hover:bg-[var(--color-danger-soft)]/40',
      'danger:bright': 'hover:brightness-105',
      'accent:wash': 'hover:bg-[var(--color-accent-soft)]',
      'accent:bright': 'hover:brightness-105',
      'tertiary:bright': 'hover:brightness-105',
      'tertiary:plain': 'hover:text-[var(--color-text-primary)]',
      'tertiary:plainMuted': 'hover:text-[var(--color-text-secondary)]',
      'secondary:bright': 'hover:brightness-105 hover:text-[var(--color-text-primary)]',
      'secondary:plain': 'hover:text-[var(--color-text-primary)]',
      'inherit:bright': '',
      'inherit:none': '',
    };
    return (
      <button
        type="button"
        ref={ref}
        aria-label={label}
        className={`cursor-pointer ${
          size ? sizes[size] : ''
        } ${radius ? radii[radius] : ''} ${ink[tone]} ${material[`${tone}:${surface}`] ?? ''} ${
          border ? 'border border-[var(--color-glass-light-stroke)]' : ''
        } ${motion ? 'transition-all' : ''} ${FOCUS_RING} ${className}`}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';
