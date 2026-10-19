/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * The form-field label — the ONLY place in the app that encodes the label
 * vocabulary (text-label-muted block). The tier sits one step quieter than
 * body but well above the hint floor (tokens.css: --color-text-label-muted,
 * 4.53:1 light / 6.94:1 dark on page-bg).
 *
 *   <FieldLabel htmlFor="name" required>نام کلاس</FieldLabel>
 */
export interface FieldLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  htmlFor?: string;
  /** Appends the app's required marker to the label text (aria-hidden glyph
   *  + sr-only suffix — the required state itself is the input's job). */
  required?: boolean;
}

export function FieldLabel({ htmlFor, required, children, className = '', ...props }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={`text-label-muted block ${className}`.trim()} {...props}>
      {children}
      {required && (
        <>
          {' '}
          <span aria-hidden="true" className="text-[var(--color-danger)]">
            *
          </span>
          <span className="sr-only">(الزامی)</span>
        </>
      )}
    </label>
  );
}
