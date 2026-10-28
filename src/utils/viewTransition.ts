/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * View Transitions (Meraj P1 remainder, v7 genie rework) — the whole-app page
 * morph. A navigation is a change of state, not a flash: the outgoing page is
 * SUCKED INTO the menu button (the Mark hamburger, top-right in the RTL
 * chrome) and the incoming page UNFOLDS FROM THE SAME POINT — the macOS-genie
 * move the brand asked for: one anchor, two arcs, zero crossfade mush.
 *
 * Contract:
 *  · Guards first: no API support or reduced motion → the callback runs
 *    directly. The feature is invisible-by-absence, never a broken nav.
 *  · The callback flushes synchronously (flushSync) so the transition
 *    snapshots the post-navigation DOM, not a half-applied React batch.
 *  · Only push-navigations and popstate are moments. replaceState (boot
 *    corrections, deep-link repairs) is NOT a navigation — no transition.
 *  · Genie aiming is pure geometry: the anchor is #hamburger-menu-btn, the
 *    stage is #main-content. Either missing → the flag never lands and CSS
 *    keeps the plain rising handover (vt-exit/vt-enter). transform/opacity
 *    only — compositor-safe, 60fps on mid-tier phones.
 *  · The genie flag + aim vars are cleaned up on transition.finished so a
 *    failed/aborted transition can never strand the CSS in genie mode.
 */

import { flushSync } from 'react-dom';

type StartViewTransition = (callback: () => void) => unknown;

/** Narrow, dependency-free feature probe (TS lib may lag the platform). */
export function supportsViewTransition(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof (document as { startViewTransition?: StartViewTransition })
      .startViewTransition === 'function'
  );
}

/** The menu button every page dives into / unfolds out of. */
const ANCHOR_ID = 'hamburger-menu-btn';
/** The named element whose snapshot the genie animates. */
const STAGE_ID = 'main-content';
/** :root attribute that flips base.css from the plain morph to the genie. */
const GENIE_FLAG = 'data-vt-genie';

/**
 * Aim the genie: write the anchor offset (anchor center − stage center, px)
 * into --vt-ax/--vt-ay on :root, where the ::view-transition keyframes read
 * them. Returns false (and writes nothing) when either element is absent —
 * Login, the student portal and boot screens keep the plain morph.
 */
export function aimGenieAtMenu(): boolean {
  try {
    const anchor = document.getElementById(ANCHOR_ID);
    const stage = document.getElementById(STAGE_ID);
    if (!anchor || !stage) return false;
    const a = anchor.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    // display:none / detached anchors measure 0×0 — not a real target.
    if ((a.width === 0 && a.height === 0) || (s.width === 0 && s.height === 0)) {
      return false;
    }
    const root = document.documentElement;
    root.style.setProperty('--vt-ax', `${Math.round(a.left + a.width / 2 - (s.left + s.width / 2))}px`);
    root.style.setProperty('--vt-ay', `${Math.round(a.top + a.height / 2 - (s.top + s.height / 2))}px`);
    return true;
  } catch {
    return false;
  }
}

/** Clear the genie flag and aim vars — after every genie, success or not. */
export function clearGenie(): void {
  try {
    const root = document.documentElement;
    root.removeAttribute(GENIE_FLAG);
    root.style.removeProperty('--vt-ax');
    root.style.removeProperty('--vt-ay');
  } catch {
    /* clearing is garnish — never let it break the navigation */
  }
}

/**
 * Run `apply` as a view transition when the platform allows and motion is
 * welcome; otherwise run it as a plain update. `reduce` comes from
 * MotionContext ('reduce') — resolved before first paint, so the guard never
 * flickers. When the menu anchor exists the transition runs as the genie
 * (suck-into-menu / unfold-from-menu); otherwise the plain rising handover.
 */
export function runInViewTransition(apply: () => void, reduce: boolean): void {
  if (reduce || !supportsViewTransition()) {
    apply();
    return;
  }
  const genie = aimGenieAtMenu();
  if (genie) document.documentElement.setAttribute(GENIE_FLAG, '');
  const transition = (
    document as { startViewTransition: StartViewTransition }
  ).startViewTransition(() => {
    flushSync(apply);
  });
  const settled = (transition as { finished?: Promise<unknown> }).finished;
  if (settled && typeof settled.finally === 'function') {
    settled.finally(clearGenie).catch(() => clearGenie());
  } else {
    // Impl without .finished — clear on the next macrotask so the genie CSS
    // at least never outlives the frame it was aimed for.
    setTimeout(clearGenie, 1000);
  }
}
