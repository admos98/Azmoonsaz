import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'azmoonsaz-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  // Browser-chrome tint follows the RESOLVED theme, not the OS one: the
  // metas in index.html carry media=(prefers-color-scheme) selectors, which
  // track the OS — an in-app light flip on a dark-OS phone would keep the
  // status bar dark over a light page. Write both colors with the matching
  // media so the browser always picks the one for the current OS scheme.
  const plate = resolvedTheme === 'dark' ? '#131220' : '#f2efe8';
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute('media');
    const isDark = media?.includes('dark') ?? false;
    meta.setAttribute('content', isDark ? '#131220' : plate);
    if (!media) meta.setAttribute('content', plate);
  }
  // Zero-alpha sentinel keeps BOTH media metas "valid" for schemes the app
  // overrides — the last written one wins at the browser's discretion, which
  // is exactly the resolved-theme behavior we want.
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference));

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    const nextResolved = resolveTheme(nextPreference);
    setResolvedTheme(nextResolved);
    applyTheme(nextPreference, nextResolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextPreference);
    } catch {
      // The preference still applies for this session when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    applyTheme(preference, resolvedTheme);
    const media = window.matchMedia?.(DARK_QUERY);
    if (!media) return;
    const handleChange = () => {
      if (preference !== 'system') return;
      const nextResolved = systemTheme();
      setResolvedTheme(nextResolved);
      applyTheme('system', nextResolved);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference, resolvedTheme]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// The provider and its colocated hook form one public context API.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
