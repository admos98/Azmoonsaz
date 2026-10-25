/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../contexts/MotionContext';
import { SealCeremony } from '../../features/secure-exam/SealCeremony';
import { SEAL_BEATS } from '../../features/secure-exam/sealBeats';
import { isSealSoundEnabled, playSealThump } from '../../lib/sealSound';

// The Seal art reads the theme context — decorative here, stubbed out.
vi.mock('../../components/Seal', () => ({
  Seal: ({ size }: { size?: number }) => (
    <img src="/seal-stub.png" width={size} height={size} alt="" />
  ),
}));

let systemReduced = false;

beforeEach(() => {
  localStorage.clear();
  systemReduced = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return systemReduced;
      },
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderCeremony = (onDone?: () => void) =>
  render(
    <MotionProvider>
      <SealCeremony onDone={onDone} />
    </MotionProvider>,
  );

describe('SealCeremony (Meraj P1-a)', () => {
  it('plays the choreography on the documented beat map, then removes itself', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    renderCeremony(onDone);

    const el = screen.getByTestId('seal-ceremony');
    expect(el.className).toContain('seal-ceremony--fold');
    expect(screen.getByRole('status')).toHaveTextContent('آزمون با موفقیت مهر و موم شد');

    act(() => {
      vi.advanceTimersByTime(SEAL_BEATS.wax + 10);
    });
    expect(screen.getByTestId('seal-ceremony').className).toContain('seal-ceremony--wax');

    act(() => {
      vi.advanceTimersByTime(SEAL_BEATS.stamp - SEAL_BEATS.wax);
    });
    expect(screen.getByTestId('seal-ceremony').className).toContain('seal-ceremony--stamp');

    // settle → fade → onDone (unmount decision left to the host)
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: no overlay, no timers, immediate onDone', () => {
    systemReduced = true;
    const onDone = vi.fn();
    renderCeremony(onDone);
    expect(screen.queryByTestId('seal-ceremony')).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('explicit saved preference "reduced" also disables the ceremony', () => {
    localStorage.setItem('azmoonsaz-motion', 'reduced');
    const onDone = vi.fn();
    renderCeremony(onDone);
    expect(screen.queryByTestId('seal-ceremony')).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('seal sound preference (Meraj P1-b)', () => {
  it('defaults ON, honors an explicit OFF, and never throws without AudioContext', () => {
    expect(isSealSoundEnabled()).toBe(true);
    localStorage.setItem('azmoonsaz:preference:seal-sound', 'false');
    expect(isSealSoundEnabled()).toBe(false);
    localStorage.setItem('azmoonsaz:preference:seal-sound', 'true');
    expect(isSealSoundEnabled()).toBe(true);
    // jsdom has no AudioContext — the guard path must stay silent-safe.
    expect(() => playSealThump()).not.toThrow();
  });
});
