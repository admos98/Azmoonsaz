/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

/* ==========================================
   17. TOAST COMPONENT
   ========================================== */
export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export const Toast = ({ message, type = 'info', onClose, duration = 4000, action }: ToastProps) => {
  const [visible, setVisible] = useState(true);
  const innerTimer = useRef<number | null>(null);

  useEffect(() => {
    const outerTimer = window.setTimeout(() => {
      setVisible(false);
      innerTimer.current = window.setTimeout(() => onClose?.(), 300);
    }, duration);
    return () => {
      // both timers cleared — the inner 300ms close used to survive
      // unmount and fire onClose after the toast was gone
      clearTimeout(outerTimer);
      if (innerTimer.current) clearTimeout(innerTimer.current);
    };
  }, [duration, onClose]);

  // family rule: a toast is a floating PANEL -> pane (rim + 2x blur), with the
  // semantic colour carried by icon + text (colored glass, never a solid slab)
  const styles: Record<ToastProps['type'] & {}, string> = {
    success: 'text-[var(--color-success)]',
    error: 'text-[var(--color-danger)]',
    warning: 'text-[var(--color-warning)]',
    info: 'text-[var(--color-text-primary)]',
  };

  const icons: Record<ToastProps['type'] & {}, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  return (
    <div
      className={`pointer-events-auto pane flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl px-4 py-3 text-label font-bold transition-all duration-300 ${styles[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      role={type === 'error' || type === 'warning' ? 'alert' : undefined}
    >
      {icons[type]}
      <span>{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-lg border border-current px-2 py-1 text-micro underline-offset-2 hover:underline"
        >
          {action.label}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن پیام"
          className="btn-glass btn-glass--danger mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-full cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
