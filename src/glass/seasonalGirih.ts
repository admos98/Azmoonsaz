/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Seasonal girih (Meraj P3) — the decagram keeps the year. The fold count
 * follows the Persian calendar's seasons; the amplitude NEVER moves (0.22 is
 * the brand constant) and the trough-only physics are untouched. This is the
 * one-liner the girih token was designed for — nothing here may touch amp.
 *
 *   Spring  فروردین–خرداد (1–3)   → 10  the Nowruz decagram (brand default)
 *   Summer  تیر–شهریور   (4–6)    → 8   the eight-fold of summer courtyards
 *   Autumn  مهر–آذر      (7–9)    → 10  the decagram returns with school
 *   Winter  دی–اسفند     (10–12)  → 12  the twelve-fold snow crystal
 *
 * The glass engines read `--lens-girih-fold` from computed style at map-build
 * time, so setting it on :root BEFORE mountGlassEngine is the whole contract.
 * Any failure (no Intl Persian calendar, odd result) is a silent fall-back to
 * 10 — a broken season must never break the glass.
 */

/** Persian-calendar month (1–12) of `date`, or null when unavailable. */
export function jalaliMonth(date: Date): number | null {
  try {
    const s = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'numeric',
    }).format(date);
    const n = Number(
      s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),
    );
    return n >= 1 && n <= 12 ? n : null;
  } catch {
    return null;
  }
}

/** Season → fold table. 10 wherever no season speaks. */
export function seasonGirihFold(month: number | null): number {
  if (month === null) return 10;
  if (month >= 4 && month <= 6) return 8; // summer
  if (month >= 10) return 12; // winter
  return 10; // spring + autumn — the decagram
}

/** Apply the season's fold to :root. Returns the fold it set (for tests/logs). */
export function applySeasonalGirih(date: Date = new Date()): number {
  const fold = seasonGirihFold(jalaliMonth(date));
  if (typeof document !== 'undefined') {
    if (fold === 10) {
      // The brand default lives in tokens.css — an inline override would
      // outvote every future token retune. Absence IS the value.
      document.documentElement.style.removeProperty('--lens-girih-fold');
    } else {
      document.documentElement.style.setProperty('--lens-girih-fold', String(fold));
    }
  }
  return fold;
}
