/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Lantern ambience (Meraj P1 remainder) — حالت شب امتحان. Evening exams get
 * candlelight: a warm token shift (--glass-p-tint, --glass-scrim-color in
 * themes.css) plus a faint warm wash, because the physics of the room change
 * at night and the product should admit it.
 *
 * Contract:
 *  · Student-portal-only: mounted by SecureExamPortal, cleaned up on unmount.
 *    The teacher workspace never carries the wash — grading needs neutral light.
 *  · Window 19:00–06:00 local. The wash is a ~5% overlay; every text token is
 *    untouched, so AA contrast is exactly the theme's own.
 *  · Preference `azmoonsaz:preference:lantern` (JSON boolean, default ON) —
 *    the ambience is an offer, not a rule.
 *  · No timers while the window state can't flip: one re-check per 5 minutes
 *    is enough (a night exam outlasting the window boundary is the only case).
 */

export const LANTERN_PREF_KEY = 'azmoonsaz:preference:lantern';

/** 19:00–06:59:59 local — the lamp hours. Pure, table-tested. */
export function isLanternHour(now: Date): boolean {
  const h = now.getHours();
  return h >= 19 || h < 6;
}

export function isLanternEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(LANTERN_PREF_KEY);
    if (raw === null) return true; // default ON — the offer stands
    return JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

/** Pure decision: should the lantern attribute be on right now? */
export function lanternActive(now: Date = new Date()): boolean {
  return isLanternHour(now) && isLanternEnabled();
}

const RECHECK_MS = 5 * 60 * 1000;

/**
 * Mount the ambience on :root (`data-ambience="lantern"`), keep it current
 * across the window boundary, and always clean up. Returns a disposer.
 */
export function mountLanternAmbience(now: Date = new Date()): () => void {
  if (typeof document === 'undefined') return () => {};
  const root = document.documentElement;
  // First paint decides from the injected clock (testable); the interval
  // re-reads the real clock, so crossing the window boundary at 06:00
  // clears the wash mid-session.
  if (lanternActive(now)) root.dataset.ambience = 'lantern';
  else delete root.dataset.ambience;
  const sync = () => {
    if (lanternActive(new Date())) root.dataset.ambience = 'lantern';
    else delete root.dataset.ambience;
  };
  const id = window.setInterval(sync, RECHECK_MS);
  return () => {
    window.clearInterval(id);
    delete root.dataset.ambience;
  };
}
