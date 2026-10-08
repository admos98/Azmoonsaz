/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FOCUS_RING } from './shared';

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** fill family — the pill's background + default ink */
  fill:
    'accent-soft' | 'danger-soft' | 'success-soft' | 'info-soft' | 'accent-solid' | 'warning-solid';
  /** padding step: xs px-2 py-1 · sm px-2.5 py-1.5 · md px-3 py-1.5 · lg px-3.5 py-1.5 · xl px-5 py-2.5 · none = supply your own (className) */
  size?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  /** role typography: micro (12px, default) · caption (13px) · label (14px) */
  text?: 'micro' | 'caption' | 'label';
  weight?: 'bold' | 'black';
  /** ink override — defaults come from the fill family */
  textColor?: 'accent' | 'danger' | 'success' | 'onSolid' | 'primary' | 'warning' | 'inherit';
  /** no transition is baked: pass transition-all (hover fades) or
      transition-colors in className — the legacy corpus used both */
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  (
    {
      fill,
      size = 'sm',
      radius = 'lg',
      text = 'micro',
      weight = 'bold',
      textColor,
      className = '',
      ...props
    },
    ref,
  ) => {
    const fills = {
      'accent-soft': 'bg-[var(--color-accent-soft)]',
      'danger-soft': 'bg-[var(--color-danger-soft)]/40',
      'success-soft': 'bg-[var(--color-success-soft)]',
      'info-soft': 'bg-[var(--color-info-soft)]/80',
      'accent-solid': 'bg-[var(--color-accent-solid)]',
      'warning-solid': 'bg-[var(--color-warning-solid)]',
    };
    const defaultInk = {
      'accent-soft': 'accent',
      'danger-soft': 'danger',
      'success-soft': 'success',
      'info-soft': 'onSolid',
      'accent-solid': 'onSolid',
      'warning-solid': 'onSolid',
    } as const;
    const sizes = {
      xs: 'px-2 py-1',
      sm: 'px-2.5 py-1.5',
      md: 'px-3 py-1.5',
      lg: 'px-3.5 py-1.5',
      xl: 'px-5 py-2.5',
    };
    const radii = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl' };
    const texts = { micro: 'text-micro', caption: 'text-caption', label: 'text-label' };
    const inks = {
      accent: 'text-[var(--color-accent)]',
      danger: 'text-[var(--color-danger)]',
      success: 'text-[var(--color-success)]',
      onSolid: 'text-[var(--color-text-on-solid)]',
      primary: 'text-[var(--color-text-primary)]',
      warning: 'text-[var(--color-warning)]',
      inherit: '',
    };
    const ink = inks[textColor ?? defaultInk[fill]];
    return (
      <button
        type="button"
        ref={ref}
        className={`cursor-pointer ${fills[fill]} ${size === 'none' ? '' : sizes[size]} ${
          radii[radius]
        } ${texts[text]} ${weight === 'bold' ? 'font-bold' : 'font-black'} ${ink} ${FOCUS_RING} ${className}`}
        {...props}
      />
    );
  },
);
PillButton.displayName = 'PillButton';
