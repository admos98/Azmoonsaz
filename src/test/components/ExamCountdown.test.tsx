import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExamCountdown } from '../../components/ExamCountdown';

afterEach(() => vi.useRealTimers());

describe('ExamCountdown', () => {
  it('updates its timer semantics and expires exactly once', async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(<ExamCountdown durationMinutes={1 / 30} onExpire={onExpire} />);

    expect(screen.getByRole('timer')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('۲ ثانیه'),
    );
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('timer')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('۰ ثانیه'),
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
