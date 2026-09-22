/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Typography scale — semantic text styles for consistent hierarchy.
 * Maps to pixel values and maps onto Tailwind utilities.
 *
 * Use as className: "text-display" or style: { fontSize: tokens.typography.display.fontSize }
 */

export interface TextStyle {
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
}

export const typography = {
  display: {
    fontSize: '2.25rem',
    fontWeight: '800',
    lineHeight: '1.1',
    letterSpacing: '-0.02em',
  },
  heading1: {
    fontSize: '1.75rem',
    fontWeight: '800',
    lineHeight: '1.2',
  },
  heading2: {
    fontSize: '1.25rem',
    fontWeight: '700',
    lineHeight: '1.3',
  },
  heading3: {
    fontSize: '1.125rem',
    fontWeight: '700',
    lineHeight: '1.4',
  },
  body: {
    fontSize: '0.9375rem',
    fontWeight: '400',
    lineHeight: '1.6',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    lineHeight: '1.4',
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: '600',
    lineHeight: '1.3',
  },
  micro: {
    fontSize: '0.625rem',
    fontWeight: '700',
    lineHeight: '1.2',
  },
} as const;

export type TypographyKey = keyof typeof typography;
