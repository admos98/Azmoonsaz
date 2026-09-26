import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** `null` until the user picks a tier — the first visit stays auto-detected. */
export type GlassPreference = 'full' | 'light' | null;
export type ResolvedGlass = 'full' | 'light';

const STORAGE_KEY = 'azmoonsaz-glass';

interface GlassContextValue {
  glassPreference: GlassPreference;
  resolvedGlass: ResolvedGlass;
  /** True when the current tier came from the device probe, not a user choice. */
  isAutoDetected: boolean;
  setGlassPreference: (preference: GlassPreference) => void;
}

const GlassContext = createContext<GlassContextValue | null>(null);

function readPreference(): GlassPreference {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'full' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

/**
 * The same probe index.html runs before first paint. It has to agree exactly,
 * or the app re-paints the wrong tier a moment after the pre-paint one.
 */
function detectGlass(): ResolvedGlass {
  // `deviceMemory` is Chromium-only and absent from lib.dom's Navigator, so it
  // needs a local cast rather than a global type augmentation.
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  return memory <= 4 || cores <= 4 ? 'light' : 'full';
}

function applyGlass(preference: GlassPreference, resolved: ResolvedGlass) {
  const root = document.documentElement;
  root.dataset.glassPreference = preference ?? 'auto';
  root.dataset.glass = resolved;
}

export function GlassProvider({ children }: { children: React.ReactNode }) {
  const [glassPreference, setPreferenceState] = useState<GlassPreference>(readPreference);
  const [resolvedGlass, setResolvedGlass] = useState<ResolvedGlass>(
    () => glassPreference ?? detectGlass(),
  );

  const setGlassPreference = useCallback((preference: GlassPreference) => {
    const resolved = preference ?? detectGlass();
    setPreferenceState(preference);
    setResolvedGlass(resolved);
    applyGlass(preference, resolved);
    try {
      if (preference) window.localStorage.setItem(STORAGE_KEY, preference);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  const value = useMemo(
    () => ({
      glassPreference,
      resolvedGlass,
      isAutoDetected: glassPreference === null,
      setGlassPreference,
    }),
    [glassPreference, resolvedGlass, setGlassPreference],
  );
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlassQuality() {
  const context = useContext(GlassContext);
  if (!context) throw new Error('useGlassQuality must be used inside GlassProvider');
  return context;
}
