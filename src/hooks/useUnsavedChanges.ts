import { useCallback, useEffect, useState } from 'react';

const DEFAULT_MESSAGE = 'تغییرات ذخیره‌نشده دارید. بدون ذخیره از این صفحه خارج می‌شوید؟';
const NAVIGATION_EVENT = 'azmoonsaz:before-navigation';
let navigationBypassDepth = 0;

export function requestAppNavigation(): boolean {
  if (navigationBypassDepth > 0) return true;
  return window.dispatchEvent(new Event(NAVIGATION_EVENT, { cancelable: true }));
}

function runWithNavigationBypass(action: () => void) {
  navigationBypassDepth += 1;
  try {
    action();
  } finally {
    navigationBypassDepth -= 1;
  }
}

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Guards unsaved edits without a native dialog. The hook stays a hook: it
 * returns dialog props, and the page that mounts the hook renders the
 * ConfirmDialog with them — the interaction keeps its designed glass
 * surface (Modal + ConfirmDialog) everywhere the hook is used.
 *
 * Two concerns, two mechanisms:
 *  - the TABBED in-app flow: callers wrap their action in the guarded
 *    callback; when dirty the action is parked and the dialog opens,
 *    confirming runs it, cancelling discards it.
 *  - the beforeunload browser chrome stays native (we cannot render into
 *    the browser's own prompt) — only event wiring, never a
 *    window.confirm() call of our own.
 */
export function useUnsavedChanges(isDirty: boolean, message = DEFAULT_MESSAGE) {
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const handleAppNavigation = (event: Event) => {
      // dirty: every app-navigation event must re-ask — the glass dialog is
      // the only authorizer, and confirming runs the action through the
      // navigation bypass itself. Block everything else.
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener(NAVIGATION_EVENT, handleAppNavigation);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener(NAVIGATION_EVENT, handleAppNavigation);
    };
  }, [isDirty]);

  const guarded = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        runWithNavigationBypass(action);
        return;
      }
      setPending(() => action);
    },
    [isDirty],
  );

  const confirm = useCallback(() => {
    const action = pending;
    setPending(null);
    if (action) runWithNavigationBypass(action);
  }, [pending]);

  const cancel = useCallback(() => setPending(null), []);

  const dialogProps: UnsavedChangesDialogProps = {
    isOpen: pending != null,
    message,
    onConfirm: confirm,
    onCancel: cancel,
  };

  return { guarded, dialogProps };
}
