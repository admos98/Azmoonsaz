/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Mark (علامت) — Brand SVG Component
 * Four answer bubbles, one gold-filled. The product's core identity.
 *
 * Variants:
 *   row    — 4 circles horizontal (wordmark/header, ≥24px)
 *   grid   — 2×2 circles (app icon, 16–512px)
 *   palette — 3×3 circles (question navigation)
 *   core   — single circle with dot (favicon)
 *
 * Props:
 *   variant  — 'row' | 'grid' | 'palette' | 'core'
 *   size     — width in px (height auto for row, square for others)
 *   animated — enable gold pop animation (default: true)
 *   className — additional classes
 *
 * SVG specs from docs/brand-the-mark.md:
 *   D = diameter, spacing = 1.4×D, stroke = 0.22×D, gold = 3rd of 4
 */

import React from 'react';

interface TheMarkProps {
  variant?: 'row' | 'grid' | 'palette' | 'core';
  size?: number;
  animated?: boolean;
  className?: string;
}

export function TheMark({
  variant = 'row',
  size = 80,
  animated = true,
  className = '',
}: TheMarkProps) {
  const ink = 'var(--color-ink, #221E4A)';
  const gold = 'var(--color-gold, #F5B301)';
  const popClass = animated ? 'goldpop' : '';

  if (variant === 'row') {
    return (
      <svg
        width={size}
        viewBox="0 0 128.40 44.40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ExamForge — The Mark"
        role="img"
      >
        <circle cx="22.2" cy="22.2" r="10" stroke={ink} strokeWidth="4.4" />
        <circle cx="50.2" cy="22.2" r="10" stroke={ink} strokeWidth="4.4" />
        <circle className={popClass} cx="78.2" cy="22.2" r="10" fill={gold} />
        <circle cx="106.2" cy="22.2" r="10" stroke={ink} strokeWidth="4.4" />
      </svg>
    );
  }

  if (variant === 'grid') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 104 104"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ExamForge — The Mark"
        role="img"
      >
        <circle cx="28" cy="28" r="14.5" stroke={ink} strokeWidth="5.2" />
        <circle className={popClass} cx="76" cy="28" r="14.5" fill={gold} />
        <circle cx="28" cy="76" r="14.5" stroke={ink} strokeWidth="5.2" />
        <circle cx="76" cy="76" r="14.5" stroke={ink} strokeWidth="5.2" />
      </svg>
    );
  }

  if (variant === 'palette') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 108 108"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ExamForge — Question palette"
        role="img"
      >
        <circle cx="20" cy="20" r="8" stroke={ink} strokeWidth="3.6" />
        <circle cx="54" cy="20" r="8" stroke={ink} strokeWidth="3.6" />
        <circle cx="88" cy="20" r="8" stroke={ink} strokeWidth="3.6" />
        <circle cx="20" cy="54" r="8" stroke={ink} strokeWidth="3.6" />
        <circle className={popClass} cx="54" cy="54" r="8" fill={gold} />
        <circle cx="88" cy="54" r="8" stroke={ink} strokeWidth="3.6" />
        <circle cx="20" cy="88" r="8" stroke={ink} strokeWidth="3.6" />
        <circle cx="54" cy="88" r="8" stroke={ink} strokeWidth="3.6" />
        <circle cx="88" cy="88" r="8" stroke={ink} strokeWidth="3.6" />
      </svg>
    );
  }

  // core — favicon
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ExamForge"
      role="img"
    >
      <circle cx="32" cy="32" r="16.5" stroke={ink} strokeWidth="5.6" />
      <circle className={popClass} cx="32" cy="32" r="7.5" fill={gold} />
    </svg>
  );
}

/**
 * MarkBubble — Single answer bubble for use in option selection, progress bars, etc.
 *
 * Props:
 *   answered — whether this bubble is filled (gold)
 *   size     — diameter in px
 *   animated — enable pop animation on fill
 */
interface MarkBubbleProps {
  answered?: boolean;
  size?: number;
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MarkBubble({
  answered = false,
  size = 24,
  animated = true,
  className = '',
  onClick,
}: MarkBubbleProps) {
  const ink = 'var(--color-ink, #221E4A)';
  const gold = 'var(--color-gold, #F5B301)';
  const r = size / 2;
  const stroke = Math.round(r * 0.22 * 10) / 10;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? answered : undefined}
    >
      {answered ? (
        <circle
          className={animated ? 'goldpop' : ''}
          cx={r}
          cy={r}
          r={r - stroke}
          fill={gold}
        />
      ) : (
        <circle cx={r} cy={r} r={r - stroke} stroke={ink} strokeWidth={stroke} />
      )}
    </svg>
  );
}
