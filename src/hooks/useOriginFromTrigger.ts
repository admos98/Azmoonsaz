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
import { useEffect, useState } from 'react';

export function useOriginFromTrigger(
  triggerRef: { current: HTMLElement | null } | undefined,
  panelRef: { current: HTMLElement | null },
  active: boolean,
): React.CSSProperties | undefined {
  const [originStyle, setOriginStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    if (!active || !triggerRef?.current || !panelRef.current) {
      setOriginStyle(undefined);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      if (!panel || !trigger) return;
      const panelRect = panel.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const cx = triggerRect.left + triggerRect.width / 2 - panelRect.left;
      const cy = triggerRect.top + triggerRect.height / 2 - panelRect.top;
      setOriginStyle({ transformOrigin: `${cx}px ${cy}px` });
    });
    return () => cancelAnimationFrame(raf);
  }, [active, triggerRef, panelRef]);

  return originStyle;
}
