import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectivityStatus from '../../components/ConnectivityStatus';

describe('ConnectivityStatus', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => vi.useRealTimers());

  it('announces offline and reconnected states, then dismisses the recovery message', () => {
    render(<ConnectivityStatus />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent('اتصال اینترنت قطع است');

    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.getByRole('status')).toHaveTextContent('اتصال دوباره برقرار شد');

    fireEvent.click(screen.getByRole('button', { name: 'بستن پیام اتصال' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
