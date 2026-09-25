import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider, useMotionPreference } from '../../contexts/MotionContext';

let systemReduced = false;
let changeHandler: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  systemReduced = false;
  changeHandler = undefined;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return systemReduced;
      },
      media: '(prefers-reduced-motion: reduce)',
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
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <MotionProvider>{children}</MotionProvider>
);

describe('MotionProvider', () => {
  it('tracks the operating-system preference in system mode', () => {
    const { result } = renderHook(() => useMotionPreference(), { wrapper });
    expect(result.current.resolvedMotion).toBe('full');

    systemReduced = true;
    act(() => changeHandler?.());
    expect(result.current.resolvedMotion).toBe('reduce');
    expect(document.documentElement.dataset.motion).toBe('reduce');
  });

  it('persists reduced motion and never overrides the OS safety preference', () => {
    const { result } = renderHook(() => useMotionPreference(), { wrapper });
    act(() => result.current.setMotionPreference('reduced'));
    expect(localStorage.getItem('azmoonsaz-motion')).toBe('reduced');
    expect(result.current.resolvedMotion).toBe('reduce');

    systemReduced = true;
    act(() => result.current.setMotionPreference('full'));
    expect(result.current.resolvedMotion).toBe('reduce');
  });
});
