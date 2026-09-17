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
}

export function useToast(): {
  showToast: (message: string, type?: ToastType) => void;
  toastElement: ReactElement | null;
} {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const toastElement = toast ? (
    <Toast
      key={toast.key}
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  ) : null;

  return { showToast, toastElement };
}
