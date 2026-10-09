/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/* ==========================================
 5. INPUT COMPONENT
 ========================================== */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
 label?: React.ReactNode;
 error?: string;
 helperText?: string;
 /** Leading decorative icon (inline-start / physical right in this RTL app) — non-interactive */
 icon?: React.ReactNode;
 /** Trailing interactive slot (physical left in this RTL app) — e.g. a show-password button */
 trailing?: React.ReactNode;
 /** sm: compact fields inside dense editor rows; md (default): standard form field */
 size?: 'sm' | 'md';
 wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
 (
 {
 label,
 error,
 helperText,
 icon,
 trailing,
 size = 'md',
 id,
 className = '',
 wrapperClassName = '',
 type = 'text',
 ...props
 },
 ref,
 ) => {
 const generatedId = useId();
 const inputId = id || generatedId;
 const sizeBase =
 size === 'sm' ? 'text-micro px-2.5 py-1.5 rounded-lg' : 'text-label px-4 py-2.5 rounded-xl';
 return (
 <div className={`space-y-1.5 text-right w-full ${wrapperClassName}`}>
 {label && (
 <label
 htmlFor={inputId}
 className="block text-caption md:text-label font-bold text-[var(--color-text-secondary)]"
 >
 {label}
 </label>
 )}
 <div className="relative">
 <input
 id={inputId}
 ref={ref}
 type={type}
 aria-invalid={error ? true : undefined}
 aria-describedby={
 error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
 }
 className={`w-full ${sizeBase} glx-inset field hover:brightness-105 border focus:border-[var(--color-accent)] transition-all text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : 'border-[var(--color-glass-light-stroke)]'} ${icon ? 'pr-11' : ''} ${trailing ? 'pl-11' : ''} ${className}`}
 {...props}
 />
 {icon && (
 <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[var(--color-text-tertiary)] pointer-events-none">
 {icon}
 </div>
 )}
 {trailing && (
 <div className="absolute top-1/2 -translate-y-1/2 left-2 flex items-center">
 {trailing}
 </div>
 )}
 </div>
 {error && (
 <p
 id={`${inputId}-error`}
 className="text-micro text-[var(--color-danger)] font-bold flex items-center gap-1 mt-1"
 >
 <AlertCircle className="w-3.5 h-3.5" />
 <span>{error}</span>
 </p>
 )}
 {!error && helperText && (
 <p
 id={`${inputId}-helper`}
 className="text-micro text-[var(--color-text-tertiary)] font-semibold"
 >
 {helperText}
 </p>
 )}
 </div>
 );
 },
);
