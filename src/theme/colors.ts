/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Semantic color mapping — maps status/brand concepts to CSS variables.
 * Every status color is expressed as a CSS var reference so it
 * switches correctly in dark mode.
 *
 * Usage: className={`bg-[var(--color-success-soft)] text-[var(--color-success)]`}
 */

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'accent';

export interface ColorSet {
  bg: string;
  text: string;
  border: string;
  ring: string;
}

export const statusColors: Record<StatusVariant, ColorSet> = {
  success: {
    bg: 'var(--color-success-soft)',
    text: 'var(--color-success)',
    border: 'var(--color-success)',
    ring: 'var(--color-success-soft)',
  },
  warning: {
    bg: 'var(--color-warning-soft)',
    text: 'var(--color-warning)',
    border: 'var(--color-warning)',
    ring: 'var(--color-warning-soft)',
  },
  danger: {
    bg: 'var(--color-danger-soft)',
    text: 'var(--color-danger)',
    border: 'var(--color-danger)',
    ring: 'var(--color-danger-soft)',
  },
  info: {
    bg: 'var(--color-accent-soft)',
    text: 'var(--color-accent)',
    border: 'var(--color-accent)',
    ring: 'var(--color-accent-soft)',
  },
  accent: {
    bg: 'var(--color-accent-soft)',
    text: 'var(--color-accent)',
    border: 'var(--color-accent)',
    ring: 'var(--color-accent-soft)',
  },
};

/**
 * Convenience: returns a CSS var string for a status color.
 */
export function statusColorVar(
  variant: StatusVariant,
  channel: 'bg' | 'text' | 'border' | 'ring' = 'text',
): string {
  return statusColors[variant][channel];
}
