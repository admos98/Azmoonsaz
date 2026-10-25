/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../contexts/MotionContext';
import { ScoreOdometer } from '../../components/ScoreOdometer';

vi.stubGlobal(
  'matchMedia',
  vi.fn(() => ({
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);

describe('ScoreOdometer', () => {
  it('reads the value in Persian digits for assistive tech', () => {
    render(
      <MotionProvider>
        <ScoreOdometer value={18} max={20} />
      </MotionProvider>,
    );
    expect(screen.getByText('۱۸ از ۲۰')).toBeInTheDocument();
  });

  it('renders one strip per digit, rolling to the target', async () => {
    const { container } = render(
      <MotionProvider>
        <ScoreOdometer value={145} />
      </MotionProvider>,
    );
    // after the reveal flip (next animation frame) the strips carry the value
    await waitFor(() => {
      const strips = container.querySelectorAll('.odometer__strip');
      expect(strips).toHaveLength(3);
      expect(strips[2].getAttribute('style')).toContain('translateY(-5em)');
      expect(strips[1].getAttribute('style')).toContain('translateY(-4em)');
      expect(strips[0].getAttribute('style')).toContain('translateY(-1em)');
    });
  });

  it('finalized draws the تذهیب rule with its caption; default does not', () => {
    const { rerender, container } = render(
      <MotionProvider>
        <ScoreOdometer value={10} />
      </MotionProvider>,
    );
    expect(container.querySelector('.tazhib-rule')).toBeNull();
    rerender(
      <MotionProvider>
        <ScoreOdometer value={10} finalized />
      </MotionProvider>,
    );
    expect(container.querySelector('.tazhib-rule')).not.toBeNull();
    expect(screen.getByText('کارنامه نهایی شد')).toBeInTheDocument();
  });
});
