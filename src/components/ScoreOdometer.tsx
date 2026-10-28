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
 *  · Odometer carry (v7): columns are keyed FROM THE RIGHT (the ones wheel
 *    keeps its DOM identity when ۹ → ۱۰ grows the reading a digit wider),
 *    every strip carries a trailing extra ۰ cell, and a ۹→۰ roll takes the
 *    FORWARD step onto that extra cell — applied in a layout effect (so the
 *    browser only ever sees -9em → -10em) and snapped back to the resting ۰
 *    on transitionend — the wheel rolls one step forward like a real
 *    odometer, never spins backward through the whole decade.
 *  · Reduced motion (MotionContext 'reduce'): static number, zero timers, no
 *    transitions — the global data-motion reduce rules also park the CSS
 *    (the -10em pose shows the same ۰ glyph, so no snap is needed there).
 *  · The تذهیب rule (finalized) draws in once — a gold double rule with the
 *    Mark's diamond, the Illumination-style flourish that says "this
 *    کارنامه is sealed". Static forever after (same law as the Seal art).
 *  · A11y: the visual strips are aria-hidden; one sr-only reading carries
 *    the value so screen readers get the number, not the machinery.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

  // The previous reading, keyed by wheel position FROM THE RIGHT (ones wheel
  // = 0). This is what makes the ۹→۰ carry detectable: only a wheel that sat
  // at ۹ takes the forward step onto the trailing extra ۰ cell.
  const prevDigitsRef = useRef<Map<number, number>>(new Map());
  /** The wheel container — the carry applier walks its strips post-commit. */
  const visualRef = useRef<HTMLSpanElement>(null);

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

  /** The carry applier — runs AFTER the DOM updates but BEFORE paint: a wheel
   *  that sat at ۹ and now reads ۰ gets translateY(-10em) (one FORWARD step
   *  onto the trailing extra ۰). The browser never sees the intermediate
   *  -0em the render wrote, so it animates -9em → -10em: a true odometer
   *  carry. Reduced motion has transitions parked, where -10em simply shows
   *  the same ۰ glyph — no snap needed. Refs are touched here only (the
   *  lint-clean home for them). */
  useLayoutEffect(() => {
    const container = visualRef.current;
    if (!container) return;
    const prev = prevDigitsRef.current;
    container.querySelectorAll<HTMLElement>('.odometer__strip').forEach((strip) => {
      const wheel = Number(strip.dataset.wheel);
      const d = Number(strip.dataset.digit);
      if (prev.get(wheel) === 9 && d === 0) {
        strip.style.transform = 'translateY(-10em)';
      }
    });
    // Record the settled reading for the NEXT change.
    const next = new Map<number, number>();
    container.querySelectorAll<HTMLElement>('.odometer__strip').forEach((strip) => {
      next.set(Number(strip.dataset.wheel), Number(strip.dataset.digit));
    });
    prevDigitsRef.current = next;
  });

  /** The carry snap: a wheel that rolled onto the TRAILING ۰ (transform
   *  -10em) silently jumps back to the resting ۰ (0em) once the transition
   *  ends — both cells show the same glyph, so the snap is invisible; the
   *  reflow flush guarantees the jump itself is never animated. */
  const handleStripEnd = (e: React.TransitionEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    if (el.style.transform !== 'translateY(-10em)') return;
    el.style.transition = 'none';
    el.style.transform = 'translateY(0em)';
    void el.offsetHeight;
    el.style.transition = '';
  };

  return (
    <span className="odometer" data-testid="score-odometer">
      <span className="sr-only">{reading}</span>
      <span aria-hidden="true" className="odometer__visual" ref={visualRef}>
        {chars.map((glyph, i) => {
          const d = PERSIAN_DIGITS.indexOf(glyph);
          // Non-digit glyphs (shouldn't occur for scores) render statically.
          if (d < 0) return <span key={i}>{glyph}</span>;
          // Wheels key FROM THE RIGHT: growing ۹→۱۰ keeps the ones wheel
          // mounted (it rolls the carry) instead of remounting it (the jolt).
          const fromRight = chars.length - 1 - i;
          return (
            <span key={`c${fromRight}`} className="odometer__digit">
              <span
                className="odometer__strip"
                data-wheel={fromRight}
                data-digit={d}
                style={{ transform: `translateY(-${d}em)` }}
                onTransitionEnd={handleStripEnd}
              >
                {/* ۰..۹ plus the trailing carry ۰ — the eleventh cell lets
                    ۹→۰ roll FORWARD one step, like a real odometer. */}
                {[...PERSIAN_DIGITS, '۰'].map((g, v) => (
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
