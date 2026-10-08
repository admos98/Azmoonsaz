/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useToast — the single toast system of the app (audit §6.5).
 * Manages a small stack of toasts rendered through the library Toast component
 * inside ToastStack, so concurrent toasts stack instead of overlapping.
 * Returns showToast(message, type, action) and toastElement to render in JSX.
 */

import { useState, useCallback, ReactElement } from 'react';
import { Toast, ToastStack } from '../ui';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
  action?: { label: string; onClick: () => void };
}

/** Module-level sequence: distinct keys even when two toasts land in the same ms */
let toastSeq = 0;

/** Maximum toasts visible at once — older ones are dropped */
const MAX_VISIBLE_TOASTS = 3;

export function useToast(): {
  showToast: (
    message: string,
    type?: ToastType,
    action?: { label: string; onClick: () => void },
  ) => void;
  toastElement: ReactElement | null;
} {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      action?: { label: string; onClick: () => void },
    ) => {
      setToasts((current) => {
        // Dedup: an identical active message+type is not appended again
        if (current.some((t) => t.message === message && t.type === type)) return current;
        const next = [...current, { message, type, action, key: ++toastSeq }];
        return next.slice(-MAX_VISIBLE_TOASTS);
      });
    },
    [],
  );

  const removeToast = useCallback((key: number) => {
    setToasts((current) => current.filter((t) => t.key !== key));
  }, []);

  const toastElement =
    toasts.length > 0 ? (
      <ToastStack>
        {toasts.map((t) => (
          <Toast
            key={t.key}
            message={t.message}
            type={t.type}
            action={t.action}
            onClose={() => removeToast(t.key)}
          />
        ))}
      </ToastStack>
    ) : null;

  return { showToast, toastElement };
}
