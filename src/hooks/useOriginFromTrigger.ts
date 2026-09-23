/**
 * useOriginFromTrigger — shared transformOrigin for grow-from / shrink-to panels.
 *
 * Measures the trigger button and the panel it opened, once, after layout, and
 * returns a transformOrigin in panel-local coordinates so an overlay appears to
 * grow out of — and collapse back into — the button that opened it.
 *
 * Returns undefined until measured, so callers can fall back to their own
 * default origin (e.g. 'center bottom'). Kept out of UIComponents on purpose:
 * a non-component export there would break React Fast Refresh.
 */
import { useLayoutEffect, useState } from 'react';

export function useOriginFromTrigger(
  triggerRef: { current: HTMLElement | null } | undefined,
  panelRef: { current: HTMLElement | null },
  active: boolean,
): React.CSSProperties | undefined {
  const [originStyle, setOriginStyle] = useState<React.CSSProperties | undefined>(undefined);

  // Layout effect, measured synchronously: the origin must be known BEFORE the
  // first animated frame. The previous rAF-in-effect version set it a frame late,
  // so panels started at the default origin and jumped to the button center —
  // read as lag on open.
  useLayoutEffect(() => {
    if (!active || !triggerRef?.current || !panelRef.current) {
      setOriginStyle(undefined);
      return;
    }
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const cx = triggerRect.left + triggerRect.width / 2 - panelRect.left;
    const cy = triggerRect.top + triggerRect.height / 2 - panelRect.top;
    setOriginStyle({ transformOrigin: `${cx}px ${cy}px` });
  }, [active, triggerRef, panelRef]);

  return originStyle;
}
