/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Glass layer system — pre-computed rgba values.
 * Replaces CSS color-mix() with plain rgba() so glass effects
 * work identically in Firefox, Safari, and Chromium.
 */

import type { CSSProperties } from 'react';

export type GlassLayer = 'light' | 'strong' | 'dark' | 'inset';

/**
 * Each layer returns React.CSSProperties so it can be spread
 * directly into a <div style={{...}}>.
 */
export function getGlassStyle(layer: GlassLayer): CSSProperties {
  switch (layer) {
    case 'light':
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.22), ' +
          'inset 0 -1px 1px rgba(0, 0, 0, 0.06), ' +
          'inset 1px 0 1px rgba(255, 255, 255, 0.0646), ' +
          'inset -1px 0 1px rgba(255, 255, 255, 0.0493), ' +
          '0 6px 30px rgba(26, 26, 46, 0.12)',
        backdropFilter: 'blur(6px) saturate(1.17) brightness(1.04)',
        WebkitBackdropFilter: 'blur(6px) saturate(1.17) brightness(1.04)',
      };

    case 'strong':
      return {
        background: 'rgba(255, 255, 255, 0.104)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.2571), ' +
          'inset 0 -1px 1px rgba(0, 0, 0, 0.06), ' +
          'inset 3px 0 4px rgba(255, 255, 255, 0.088), ' +
          'inset -3px 0 4px rgba(255, 255, 255, 0.0493), ' +
          '0 40px 100px rgba(26, 26, 46, 0.18)',
        backdropFilter: 'blur(12px) saturate(1.31)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.31)',
      };

    case 'dark':
      return {
        background: 'rgba(26, 26, 46, 1)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.12), ' +
          'inset 0 -1px 4px rgba(0, 0, 0, 0.20), ' +
          '0 4px 24px rgba(26, 26, 46, 0.12)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      };

    case 'inset':
      return {
        background: 'rgba(240, 247, 255, 0.508)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.22), ' +
          'inset 0 -1px 1px rgba(0, 0, 0, 0.06), ' +
          'inset 2px 0 2px rgba(255, 255, 255, 0.0342), ' +
          'inset -2px 0 2px rgba(255, 255, 255, 0.0186)',
        backdropFilter: 'blur(1.33px) saturate(1) brightness(1.03)',
        WebkitBackdropFilter: 'blur(1.33px) saturate(1) brightness(1.03)',
      };
  }
}

/**
 * CSS variable name for a given glass layer.
 * Use when you want the CSS to drive the glass style
 * (e.g. className="glass" with the variable already set).
 */
export const glassVar: Record<GlassLayer, string> = {
  light: 'var(--color-glass-light-fill)',
  strong: 'color-mix(in srgb, var(--color-glass-light-fill) 130%, transparent)',
  dark: 'var(--color-ink-field)',
  inset: 'color-mix(in srgb, var(--color-paper-warm) 55%, var(--color-glass-light-fill) 45%)',
};
