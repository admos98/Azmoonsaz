import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExamCountdown } from '../../components/ExamCountdown';

afterEach(() => vi.useRealTimers());

describe('ExamCountdown', () => {
  it('updates its timer semantics and expires exactly once', async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(<ExamCountdown durationMinutes={1 / 30} onExpire={onExpire} />);

    // Announcement discipline: the label names minutes only (no ticking
    // seconds for screen readers); the timer stays explicitly silent.
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByRole('timer')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('دقیقه'),
    );
    expect(screen.getByRole('timer').getAttribute('aria-label')).not.toContain('ثانیه');
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('announces whole minutes, not seconds', () => {
    render(<ExamCountdown durationMinutes={12} onExpire={() => {}} />);
    expect(screen.getByRole('timer')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('۱۲ دقیقه'),
    );
  });
});
