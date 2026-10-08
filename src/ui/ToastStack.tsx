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
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:top-4">
      {children}
    </div>
  );
};
