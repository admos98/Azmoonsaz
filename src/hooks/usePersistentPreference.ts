import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

const PREFIX = 'azmoonsaz:preference:';
const RESET_EVENT = 'azmoonsaz:preferences-reset';

export function resetWorkspacePreferences(): void {
  if (typeof window === 'undefined') return;
  const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
    window.localStorage.key(index),
  ).filter((key): key is string => Boolean(key?.startsWith(PREFIX)));
  keys.forEach((key) => window.localStorage.removeItem(key));
  window.dispatchEvent(new Event(RESET_EVENT));
}

function readPreference<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`${PREFIX}${key}`) ?? 'null');
    const isCompatible = validate
      ? validate(parsed)
      : parsed !== null &&
        typeof parsed === typeof fallback &&
        Array.isArray(parsed) === Array.isArray(fallback);
    return isCompatible ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Persists non-sensitive display/workspace preferences in this browser. */
export function usePersistentPreference<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => readPreference(key, defaultValue, validate));

  useEffect(() => {
    try {
      window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }, [key, value]);

  useEffect(() => {
    const storageKey = `${PREFIX}${key}`;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setValue(readPreference(key, defaultValue, validate));
    };
    const handleReset = () => setValue(defaultValue);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(RESET_EVENT, handleReset);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(RESET_EVENT, handleReset);
    };
  }, [defaultValue, key, validate]);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(`${PREFIX}${key}`);
    } catch {
      // Keep the in-memory reset functional when storage is unavailable.
    }
    setValue(defaultValue);
  }, [defaultValue, key]);

  return [value, setValue, reset];
}
