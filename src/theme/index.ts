/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Theme library entry point.
 * Re-exports all design tokens for single-import usage:
 * import { colors, radius, typography, getGlassStyle } from '@/theme';
 */

export { colors, radius, spacing, type ColorKey, type RadiusKey, type SpacingKey } from './tokens';
export { getGlassStyle, glassVar, type GlassLayer } from './glass';
export { statusColors, statusColorVar, type StatusVariant, type ColorSet } from './colors';
export { typography, type TypographyKey, type TextStyle } from './typography';

/**
 * Convenience: returns a CSS var reference string for any token.
 * e.g. cssVar('color-accent') => 'var(--color-accent)'
 */
export function cssVar(name: string): string {
  return `var(--${name})`;
}

/**
 * Combines class names, filtering out falsy values.
 * Use instead of clsx for a lightweight no-dependency option.
 */
export function cx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
