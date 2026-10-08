/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

/* ==========================================
   1. BUTTON COMPONENT
   ========================================== */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'start',
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyle =
      'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-50 disabled:pointer-events-none';

    // kube-style glass buttons: the material, tint and press states all live
    // in the library (@utility btn-glass) — variants only pick the tint.
    const variants: Record<ButtonProps['variant'] & {}, string> = {
      primary: 'btn-glass btn-glass--primary',
      secondary: 'btn-glass btn-glass--quiet',
      outline: 'btn-glass btn-glass--quiet',
      ghost: 'btn-glass btn-glass--bare',
      danger: 'btn-glass btn-glass--danger',
      success: 'btn-glass btn-glass--success',
      gold: 'btn-glass btn-glass--gold',
    };

    const sizes: Record<ButtonProps['size'] & {}, string> = {
      sm: 'px-3 py-1.5 text-caption',
      md: 'px-4.5 py-2.5 text-caption md:text-label',
      lg: 'px-6 py-3.5 text-label md:text-body',
    };

    return (
      <button
        type="button"
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {!isLoading && icon && iconPosition === 'start' && icon}
        {children}
        {!isLoading && icon && iconPosition === 'end' && icon}
      </button>
    );
  },
);
