/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Design tokens — single source of truth for all visual values.
 * Mirrors the CSS custom properties in src/index.css.
 * All values include hex/rgba fallbacks so they work in
 * inline style props as well as CSS var() references.
 */

export const colors = {
  // Brand — The Mark
  ink: '#1a1a2e',
  gold: '#f5b301',
  goldSoft: '#fef9e7',
  goldGlow: 'rgba(245, 179, 1, 0.16)',

  // Page / surface
  pageBg: '#f0f7ff',
  paperWarm: '#f0f7ff',
  surface: '#f8fafc',
  surfaceSecondary: '#e0f2fe',

  // Ink field — sidebar dark
  inkField: '#1a1a2e',
  inkStroke: '#374151',

  // Glass — light
  glassLightFill: 'rgba(255, 255, 255, 0.08)',
  glassLightStroke: 'rgba(255, 255, 255, 0.12)',
  glassLightSheen: 'rgba(255, 255, 255, 0.22)',
  glassLightBottom: 'rgba(0, 0, 0, 0.06)',

  // Glass — ink
  glassInkFill: 'rgba(255, 255, 255, 0.035)',
  glassInkStroke: 'rgba(255, 255, 255, 0.08)',
  glassInkSheen: 'rgba(255, 255, 255, 0.12)',
  glassInkBottom: 'rgba(0, 0, 0, 0.20)',

  // Shared shadow
  glassShadow: 'rgba(26, 26, 46, 0.12)',
  glassShadowStrong: 'rgba(26, 26, 46, 0.18)',

  // Semantic — Primary
  accent: '#6366f1',
  accentHover: '#4f46e5',
  accentSoft: '#eef2ff',

  // Semantic — Status
  success: '#10b981',
  successSoft: '#dcfce7',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  danger: '#ef4444',
  dangerSoft: '#fee2e2',
  info: '#3b82f6',
  infoSoft: '#dbeafe',

  // Text
  textPrimary: '#1a1a2e',
  textSecondary: '#525d72',
  textTertiary: '#9ca3af',
  textOnDark: '#f9fafb',
  textOnDarkSecondary: '#d1d5db',
} as const;

export type ColorKey = keyof typeof colors;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xl2: '24px',
  xl3: '32px',
  full: '9999px',
} as const;

export type RadiusKey = keyof typeof radius;

export const spacing = {
  0: '0px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export type SpacingKey = keyof typeof spacing;
