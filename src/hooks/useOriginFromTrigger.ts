/**
 * useOriginFromTrigger — shared transformOrigin for grow-from / shrink-to panels.
 *
 * Measures the trigger button and the panel it opened and returns origins in
 * panel-local coordinates so an overlay appears to grow out of — and collapse
 * back into — the button that opened it.
 *
 * Returns a tuple `[panelOrigin, companionOrigin]`; both are undefined until
 * measured, so callers can fall back to their own default origin
 * (e.g. 'center bottom'). Kept out of UIComponents on purpose: a non-component
 * export there would break React Fast Refresh.
 *
 * Three subtleties this implementation exists to get right:
 *
 * 1. Closing keeps the last origin. `active` flipping false must NOT clear the
 *    value — the exit animation still collapses into the same button. Clearing
 *    it made close shrink around the panel's own center (origin "falls off"
 *    the button the moment you close).
 *
 * 2. The panel's transform is neutralised while measuring. framer applies
 *    `initial: { scale: 0 }` inline during render, so by the time this layout
 *    effect runs the panel's box has already collapsed toward the PREVIOUS
 *    origin — getBoundingClientRect() on that returns a point ~half a
 *    panel-width away from the trigger. Measure the laid-out box instead.
 *
 * 3. `companionRef` (the area-blur halo sibling) has a larger, negative-inset
 *    box than the panel, so the same viewport point maps to different local
 *    coordinates — its origin is measured too and returned separately.
 */
import { useLayoutEffect, useState } from 'react';

type Origins = readonly [React.CSSProperties | undefined, React.CSSProperties | undefined];

export function useOriginFromTrigger(
  triggerRef: { current: HTMLElement | null } | undefined,
  panelRef: { current: HTMLElement | null },
  active: boolean,
  companionRef?: { current: HTMLElement | null },
): Origins {
  const [origins, setOrigins] = useState<Origins>([undefined, undefined]);

  // Layout effect, measured synchronously: the origin must be known BEFORE the
  // first animated frame. The previous rAF-in-effect version set it a frame late,
  // so panels started at the default origin and jumped to the button center —
  // read as lag on open.
  useLayoutEffect(() => {
    // Closed / closing: keep whatever was last measured (needed for the exit).
    if (!active) return;

    const panel = panelRef.current;
    // Some callers don't thread a trigger ref through; the focused element at
    // open time is the button that was clicked. Body means "not a real trigger".
    const trigger =
      triggerRef?.current ??
      (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null);
    if (!panel || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();

    const measureLaidOut = (el: HTMLElement) => {
      const prev = el.style.transform;
      el.style.transform = 'none';
      const rect = el.getBoundingClientRect();
      el.style.transform = prev;
      return rect;
    };

    const panelRect = measureLaidOut(panel);
    const cx = triggerRect.left + triggerRect.width / 2 - panelRect.left;
    const cy = triggerRect.top + triggerRect.height / 2 - panelRect.top;
    const panelOrigin: React.CSSProperties = { transformOrigin: `${cx}px ${cy}px` };

    const companion = companionRef?.current;
    let companionOrigin: React.CSSProperties | undefined;
    if (companion) {
      const companionRect = measureLaidOut(companion);
      const hx = cx + panelRect.left - companionRect.left;
      const hy = cy + panelRect.top - companionRect.top;
      companionOrigin = { transformOrigin: `${hx}px ${hy}px` };
    }
    setOrigins([panelOrigin, companionOrigin]);
  }, [active, triggerRef, panelRef, companionRef]);

  return origins;
}
