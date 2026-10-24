/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Top veil scroll tracker for the Topbar.
 *
 * Extracted verbatim from src/components/Topbar.tsx.
 */
import { useEffect, useState } from 'react';

export function useTopbarScrollVeil() {
  const [topScrolled, setTopScrolled] = useState(false);

  // Top veil — iOS nav-bar behavior: while content scrolls UNDER the floating
  // topbar, a page-colored gradient fades in behind it so the icons never
  // collide with passing text (the crop the user sent). At rest it is fully
  // transparent, so the hero composition at scrollY=0 is untouched. One
  // passive listener, rAF-gated, keyed on a boolean — no re-render churn.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setTopScrolled(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

 return topScrolled;
}
