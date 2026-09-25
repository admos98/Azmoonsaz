/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useToast — hook that manages toast notifications using the Toast component.
 * Returns showToast(message, type) and toastElement to render in JSX.
 */

import { useState, useCallback, ReactElement } from 'react';
import { Toast } from '../components/UIComponents';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
  action?: { label: string; onClick: () => void };
}

export function useToast(): {
  showToast: (
    message: string,
    type?: ToastType,
    action?: { label: string; onClick: () => void },
  ) => void;
  toastElement: ReactElement | null;
} {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      action?: { label: string; onClick: () => void },
    ) => {
      setToast((current) =>
        current?.message === message && current.type === type
          ? current
          : { message, type, action, key: Date.now() },
      );
    },
    [],
  );

  const toastElement = toast ? (
    <Toast
      key={toast.key}
      message={toast.message}
      type={toast.type}
      action={toast.action}
      onClose={() => setToast(null)}
    />
  ) : null;

  return { showToast, toastElement };
}
