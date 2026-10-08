/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FOCUS_RING } from './shared';

export interface TextLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** sm = text-micro (12px), md = text-caption (13px); omit to inherit the parent's size */
  size?: 'sm' | 'md';
  tone?: 'accent' | 'danger' | 'success' | 'tertiary' | 'inherit';
  /** bold body (font-bold) — the canonical link weight in this app */
  bold?: boolean;
  /** hover affordance: underline (default), a hover colour, or none */
  hover?: 'underline' | 'accent' | 'secondary' | 'none';
}

export const TextLink = React.forwardRef<HTMLButtonElement, TextLinkProps>(
  ({ size, tone = 'accent', bold = false, hover = 'underline', className = '', ...props }, ref) => {
    const sizes = { sm: 'text-micro', md: 'text-caption' };
    const tones = {
      accent: 'text-[var(--color-accent)]',
      danger: 'text-[var(--color-danger)]',
      success: 'text-[var(--color-success)]',
      tertiary: 'text-[var(--color-text-tertiary)]',
      inherit: '',
    };
    const hovers = {
      underline: 'hover:underline',
      accent: 'hover:text-[var(--color-accent-hover)]',
      secondary: 'hover:text-[var(--color-text-secondary)]',
      none: '',
    };
    return (
      <button
        type="button"
        ref={ref}
        className={`cursor-pointer ${size ? sizes[size] : ''} ${tones[tone]} ${
          bold ? 'font-bold' : ''
        } ${hovers[hover]} ${FOCUS_RING} ${className}`}
        {...props}
      />
    );
  },
);
TextLink.displayName = 'TextLink';
