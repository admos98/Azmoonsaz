/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';

/* ==========================================
   22. TOGGLE (SWITCH) COMPONENT
   Accessible switch: role=switch + aria-checked; knob slides toward the
   inline-end edge when on (correct in both RTL and LTR via dir variants).
   ========================================== */
export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle = ({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
  className = '',
}: ToggleProps) => {
  const generatedId = useId();
  const toggleId = id || generatedId;
  const labelId = `${toggleId}-label`;
  const descId = `${toggleId}-desc`;
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        /* labelled by the VISIBLE label — aria-label here used to announce
           the text twice (once from the attribute, once from the span) */
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-all cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
          checked
            ? 'bg-[var(--color-accent-solid)] border-transparent'
            : 'glx-inset border-[var(--color-glass-light-stroke)]'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 rounded-full shadow-sm transition-transform duration-200 ${
            checked
              ? 'bg-[var(--color-text-on-solid)] rtl:-translate-x-[1.375rem] ltr:translate-x-[1.375rem]'
              : 'translate-x-0 bg-[var(--color-surface-secondary)]'
          }`}
        />
      </button>
      {(label || description) && (
        <div className="space-y-0.5 min-w-0">
          {label && (
            <span
              id={labelId}
              className="block text-caption font-bold text-[var(--color-text-primary)]"
            >
              {label}
            </span>
          )}
          {description && (
            <span
              id={descId}
              className="block text-micro text-[var(--color-text-tertiary)] leading-normal"
            >
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
