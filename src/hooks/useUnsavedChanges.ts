import { useCallback, useEffect } from 'react';

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

export function useUnsavedChanges(isDirty: boolean, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const handleAppNavigation = (event: Event) => {
      if (!window.confirm(message)) event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener(NAVIGATION_EVENT, handleAppNavigation);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener(NAVIGATION_EVENT, handleAppNavigation);
    };
  }, [isDirty, message]);

  return useCallback(
    (action: () => void) => {
      if (!isDirty || window.confirm(message)) runWithNavigationBypass(action);
    },
    [isDirty, message],
  );
}
