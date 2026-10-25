/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * ScoreOdometer (Meraj P1 remainder) — the grade-reveal moment: the score as
 * Persian-digit odometer physics. Each digit is a vertical strip of ۰..۹ that
 * rolls to its value with the brand's stamp-and-settle curve — watching the
 * total climb as descriptive scores land IS the moment.
 *
 * Contract:
 *  · One-shot responses to value changes — never a loop (pulse discipline).
 *  · First paint rolls from ۰ to the value (the reveal); later changes roll
 *    per-digit from the previous reading.
 *  · Reduced motion (MotionContext 'reduce'): static number, zero timers, no
 *    transitions — the global data-motion reduce rules also park the CSS.
 *  · The تذهیب rule (finalized) draws in once — a gold double rule with the
 *    Mark's diamond, the Illumination-style flourish that says "this
 *    کارنامه is sealed". Static forever after (same law as the Seal art).
 *  · A11y: the visual strips are aria-hidden; one sr-only reading carries
 *    the value so screen readers get the number, not the machinery.
 */

import { useEffect, useState } from 'react';
import { toPersianDigits } from '../utils/persian';
import { useMotionPreference } from '../contexts/MotionContext';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

interface ScoreOdometerProps {
  value: number;
  /** Denominator shown after «از». Omitted → the odometer stands alone. */
  max?: number;
  /** کارنامه registered: draws the gold تذهیب rule once. */
  finalized?: boolean;
}

export function ScoreOdometer({ value, max, finalized = false }: ScoreOdometerProps) {
  const { resolvedMotion } = useMotionPreference();
  const reduced = resolvedMotion === 'reduce';

  // Reveal gate: first paint shows ۰, the next frame flips to the real value
  // so the strips roll once. Under reduced motion `revealed` starts true —
  // the value paints immediately and no state ever changes.
  const [revealed, setRevealed] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const shown = revealed ? value : 0;
  // Zero-pad the resting ۰ to the target's width so every column EXISTS from
  // the first paint — the reveal rolls each wheel, it never remounts columns.
  const width = String(Math.max(0, Math.trunc(value))).length || 1;
  const chars = toPersianDigits(String(Math.max(0, shown)).padStart(width, '0')).split('');

  const reading = `${toPersianDigits(value)}${max !== undefined ? ` از ${toPersianDigits(max)}` : ''}`;

  return (
    <span className="odometer" data-testid="score-odometer">
      <span className="sr-only">{reading}</span>
      <span aria-hidden="true" className="odometer__visual">
        {chars.map((glyph, i) => {
          const d = PERSIAN_DIGITS.indexOf(glyph);
          // Non-digit glyphs (shouldn't occur for scores) render statically.
          if (d < 0) return <span key={i}>{glyph}</span>;
          return (
            <span key={i} className="odometer__digit">
              <span
                className="odometer__strip"
                style={{ transform: `translateY(-${d}em)` }}
              >
                {PERSIAN_DIGITS.map((g, v) => (
                  <span key={v} className="odometer__cell">
                    {g}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>

      {finalized && (
        <span className="odometer__sealed" data-testid="score-tazhib">
          <svg
            className="tazhib-rule"
            viewBox="0 0 160 14"
            width="160"
            height="14"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 9 H66" className="tazhib-rule__line" />
            <path d="M94 9 H156" className="tazhib-rule__line" />
            {/* the Mark's lozenge, seated between the rules */}
            <path d="M80 3 L87 9 L80 15 L73 9 Z" className="tazhib-rule__gem" />
          </svg>
          <span className="odometer__sealed-caption">کارنامه نهایی شد</span>
        </span>
      )}
    </span>
  );
}
