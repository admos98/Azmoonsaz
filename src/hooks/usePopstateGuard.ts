/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * The popstate side of the app's URL state (extracted from App.tsx at v7,
 * where it also gained the dirty-guard it always needed).
 *
 * Contract:
 *  · Back/forward IS a navigation moment — same view-transition morph as
 *    push (genie when the menu anchor exists, plain handover otherwise).
 *  · The dirty-guard fix: tab clicks always went through
 *    requestAppNavigation(); popstate used to BYPASS it, so the browser back
 *    button could abandon unsaved edits silently. Now a refused popstate is
 *    undone with pushState (which fires no popstate), so the refused page
 *    never paints and the URL bar snaps back to where the user was.
 *  · currentPathRef must be the LIVE mirror of the app's current path — the
 *    effect subscribes once ([] deps), so restoring a refused nav reads the
 *    ref, not a stale closure.
 *  · applyPath must be dep-stable (setState closures + module imports only).
 */

import { useEffect, type RefObject } from 'react';
import { requestAppNavigation } from './useUnsavedChanges';
import { runInViewTransition } from '../utils/viewTransition';

export function usePopstateGuard(
  applyPath: (path: string) => void,
  currentPathRef: RefObject<string>,
  reducedMotionRef: RefObject<boolean>,
): void {
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      // Dirty and refused: undo the browser's URL change. pushState fires
      // no popstate, so nothing re-enters this handler and the refused
      // page never paints.
      if (!requestAppNavigation()) {
        window.history.pushState(null, '', currentPathRef.current);
        return;
      }
      runInViewTransition(() => applyPath(path), reducedMotionRef.current);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyPath, currentPathRef, reducedMotionRef]);
}
