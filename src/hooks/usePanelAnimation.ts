/**
 * usePanelAnimation — Unified panel open/close animation hook.
 *
 * Provides consistent "come up from trigger" (open) and "suck back into trigger"
 * (close) animations for any panel/modal/dropdown that opens relative to a trigger
 * element. Uses CSS utility classes (.panel-in /.panel-out) with inline
 * transformOrigin computed relative to the trigger button.
 *
 * Usage:
 *   const { panelRef, triggerRef, open, setOpen, toggle, transformOriginStyle } = usePanelAnimation<HTMLDivElement>();
 *   // triggerRef = the button that opens the panel
 */
import { useState, useRef, useEffect, useCallback } from 'react';

export function usePanelAnimation<T extends HTMLElement = HTMLElement>() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const [transformOriginStyle, setTransformOriginStyle] = useState<React.CSSProperties | undefined>(
    undefined,
  );

  const triggerOpen = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Compute transformOrigin relative to the panel element based on trigger position
  const computeTransformOrigin = useCallback(() => {
    if (!panelRef.current || !triggerRef.current) return undefined;

    const panelRect = panelRef.current.getBoundingClientRect();
    const triggerRect = triggerRef.current.getBoundingClientRect();

    // X: center of trigger relative to panel's left edge
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const relativeX = triggerCenterX - panelRect.left;

    // Y: center of trigger relative to panel's top edge
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const relativeY = triggerCenterY - panelRect.top;

    return {
      transformOrigin: `${relativeX}px ${relativeY}px`,
    };
  }, []);

  // Set transformOrigin when panel opens — via effect, not render
  useEffect(() => {
    if (!open) {
      setTransformOriginStyle(undefined);
      return;
    }
    // Wait a tick for the panel to mount and measure
    const raf = requestAnimationFrame(() => {
      const style = computeTransformOrigin();
      if (style) setTransformOriginStyle(style);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, computeTransformOrigin]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return {
    panelRef,
    triggerRef,
    open,
    setOpen,
    triggerOpen,
    close,
    toggle,
    transformOriginStyle,
  };
}
