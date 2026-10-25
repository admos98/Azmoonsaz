/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * View Transitions (Meraj P1 remainder) — the whole-app page morph. A
 * navigation is a change of state, not a flash: the outgoing page hands over
 * to the incoming one through the browser's snapshot machinery, timed by the
 * brand's motion grammar (--dur-flow / --ease-glass / --ease-exit, styled in
 * base.css under ::view-transition-*).
 *
 * Contract:
 *  · Guards first: no API support or reduced motion → the callback runs
 *    directly. The feature is invisible-by-absence, never a broken nav.
 *  · The callback flushes synchronously (flushSync) so the transition
 *    snapshots the post-navigation DOM, not a half-applied React batch.
 *  · Only push-navigations and popstate are moments. replaceState (boot
 *    corrections, deep-link repairs) is NOT a navigation — no transition.
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

/**
 * Run `apply` as a view transition when the platform allows and motion is
 * welcome; otherwise run it as a plain update. `reduce` comes from
 * MotionContext ('reduce') — resolved before first paint, so the guard never
 * flickers.
 */
export function runInViewTransition(apply: () => void, reduce: boolean): void {
  if (reduce || !supportsViewTransition()) {
    apply();
    return;
  }
  (
    document as { startViewTransition: StartViewTransition }
  ).startViewTransition(() => {
    flushSync(apply);
  });
}
