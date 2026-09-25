import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type MotionPreference = 'system' | 'reduced' | 'full';
type ResolvedMotion = 'reduce' | 'full';

const STORAGE_KEY = 'azmoonsaz-motion';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

interface MotionContextValue {
  motionPreference: MotionPreference;
  resolvedMotion: ResolvedMotion;
  setMotionPreference: (preference: MotionPreference) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

function readPreference(): MotionPreference {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'reduced' || saved === 'full' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemRequestsReduction() {
  return window.matchMedia?.(REDUCE_QUERY).matches ?? false;
}

function resolveMotion(preference: MotionPreference): ResolvedMotion {
  // The OS accessibility preference is always a safety ceiling. Selecting
  // “full” cannot re-enable motion when the operating system requests less.
  if (preference === 'reduced' || systemRequestsReduction()) return 'reduce';
  return 'full';
}

function applyMotion(preference: MotionPreference, resolved: ResolvedMotion) {
  const root = document.documentElement;
  root.dataset.motionPreference = preference;
  root.dataset.motion = resolved;
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [motionPreference, setPreferenceState] = useState<MotionPreference>(readPreference);
  const [resolvedMotion, setResolvedMotion] = useState<ResolvedMotion>(() =>
    resolveMotion(motionPreference),
  );

  const setMotionPreference = useCallback((preference: MotionPreference) => {
    const resolved = resolveMotion(preference);
    setPreferenceState(preference);
    setResolvedMotion(resolved);
    applyMotion(preference, resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    applyMotion(motionPreference, resolvedMotion);
    const media = window.matchMedia?.(REDUCE_QUERY);
    if (!media) return;
    const handleChange = () => {
      const resolved = resolveMotion(motionPreference);
      setResolvedMotion(resolved);
      applyMotion(motionPreference, resolved);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [motionPreference, resolvedMotion]);

  const value = useMemo(
    () => ({ motionPreference, resolvedMotion, setMotionPreference }),
    [motionPreference, resolvedMotion, setMotionPreference],
  );
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMotionPreference() {
  const context = useContext(MotionContext);
  if (!context) throw new Error('useMotionPreference must be used inside MotionProvider');
  return context;
}
