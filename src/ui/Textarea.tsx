/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/* ==========================================
   21. TEXTAREA COMPONENT
   ========================================== */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  /** sm: compact fields inside dense editor rows; md (default): standard form field */
  size?: 'sm' | 'md';
  /** When set, renders an LTR `used/max` counter under the field (controlled `value` required) */
  maxCount?: number;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      size = 'md',
      maxCount,
      value,
      id,
      className = '',
      wrapperClassName = '',
      rows = 3,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    const sizeBase =
      size === 'sm' ? 'text-micro px-2.5 py-1.5 rounded-lg' : 'text-label px-4 py-2.5 rounded-xl';
    const valueLength = typeof value === 'string' ? value.length : 0;
    return (
      <div className={`space-y-1.5 text-right w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={fieldId}
            className="block text-caption md:text-label font-bold text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <textarea
          id={fieldId}
          ref={ref}
          rows={rows}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${fieldId}-error` : helperText ? `${fieldId}-helper` : undefined
          }
          className={`w-full ${sizeBase} glx-inset field hover:brightness-105 border outline-hidden focus:border-[var(--color-accent)] transition-all text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] resize-y leading-relaxed ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : 'border-[var(--color-glass-light-stroke)]'} ${className}`}
          {...props}
        />
        {maxCount !== undefined && (
          <p
            className="text-micro text-[var(--color-text-tertiary)] font-semibold tabular-nums text-left"
            dir="ltr"
            aria-live="polite"
          >
            {valueLength}/{maxCount}
          </p>
        )}
        {error && (
          <p
            id={`${fieldId}-error`}
            className="text-micro text-[var(--color-danger)] font-bold flex items-center gap-1 mt-1"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${fieldId}-helper`}
            className="text-micro text-[var(--color-text-tertiary)] font-semibold"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
