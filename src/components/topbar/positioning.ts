/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fixed-dropdown anchor styles for the Topbar bell + hamburger panels.
 * Extracted verbatim from src/components/Topbar.tsx.
 */
import type { CSSProperties } from 'react';

export const buildNotificationStyle = (bellRect: DOMRect | null): CSSProperties => {
  // Notification dropdown position (fixed, anchored to bell — on left side, so use left)
  const notificationStyle: React.CSSProperties = { position: 'fixed' };
  if (bellRect) {
    const dropdownWidth = 320;
    const gap = 12;
    // getBoundingClientRect() is VIEWPORT-relative and `position: fixed`
    // resolves against the viewport (the header is plain `sticky` — no
    // transform/filter ancestor re-anchors fixed), so the coordinates are used
    // AS-IS. The old `+ window.scrollY/scrollX` double-counted the scroll: the
    // sticky header keeps the button at viewport top, so scrolled down S px the
    // panel rendered S px too low — "the menu opens down or on center instead
    // of top" (user report). The earlier 'match the hamburger' scroll
    // compensation above was written for a since-removed transformed ancestor.
    const top = bellRect.bottom + gap;
    notificationStyle.left = `${bellRect.left}px`;
    notificationStyle.top = `${top}px`;
    notificationStyle.width = `${dropdownWidth}px`;
  }
 return notificationStyle;
};

export const buildHamburgerDropdownStyle = (hamburgerRect: DOMRect | null): CSSProperties => {
  // Hamburger dropdown position (fixed, anchored to hamburger button) —
  // viewport coordinates, no scroll compensation (see notification note).
  const hamburgerTop = hamburgerRect ? hamburgerRect.bottom + 12 : 0;
  const hamburgerRight = hamburgerRect ? window.innerWidth - hamburgerRect.right : 0;
  const hamburgerDropdownStyle: React.CSSProperties = {
    position: 'fixed',
    right: `${hamburgerRight}px`,
    top: `${hamburgerTop}px`,
    width: '280px',
  };
 return hamburgerDropdownStyle;
};
