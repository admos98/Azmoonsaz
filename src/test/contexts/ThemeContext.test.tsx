import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';

let dark = false;
let changeHandler: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  dark = false;
  changeHandler = undefined;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, handler: () => void) => {
        changeHandler = handler;
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeProvider', () => {
  it('defaults to the system theme and reacts to operating-system changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');

    dark = true;
    act(() => changeHandler?.());

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists an explicit preference and ignores later system changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setPreference('dark'));
    expect(localStorage.getItem('azmoonsaz-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    dark = false;
    act(() => changeHandler?.());
    expect(result.current.resolvedTheme).toBe('dark');
  });
});
