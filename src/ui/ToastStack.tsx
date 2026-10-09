/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/* ==========================================
   17A. TOAST STACK CONTAINER
   Fixed placement for the app's toast column. Toast itself is position-free;
   the stack owns placement (bottom on mobile, top on sm+), so concurrent
   toasts stack instead of overlapping.
   ========================================== */
export const ToastStack = ({ children }: { children: React.ReactNode }) => {
  // Live-region map: the STACK is the single polite region for the toast
  // concern (one region per concern — concurrent toasts must not each
  // announce). aria-atomic keeps the whole stack coherent. Individual
  // Toasts are presentational; errors escalate via role="alert" on the
  // toast itself (implicit assertive) without a second live region.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:top-4"
    >
      {children}
    </div>
  );
};
