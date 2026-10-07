import { act, render, screen } from '@testing-library/react';
import { useExamGuard } from '../../features/exam-guard/useExamGuard';
import { Watermark } from '../../features/exam-guard/Watermark';

function Harness({ active }: { active: boolean }) {
  const guard = useExamGuard(active);
  return (
    <div>
      <span data-testid="total">{guard.total}</span>
      {guard.total > 0 && <p role="status">flagged</p>}
      <Watermark label="علی رضایی — کد آزمون ABC123" />
    </div>
  );
}

function dispatchOnDocument(type: string): Event {
  const event = new Event(type, { cancelable: true });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

describe('exam guard (Wave A — exam hardening)', () => {
  afterEach(() => {
    document.documentElement.classList.remove('exam-guard-active');
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  it('cancels copy attempts while active and counts them', () => {
    render(<Harness active />);
    const event = dispatchOnDocument('copy');
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId('total').textContent).toBe('1');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('cancels the context menu while active', () => {
    render(<Harness active />);
    const event = dispatchOnDocument('contextmenu');
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId('total').textContent).toBe('1');
  });

  it('blocks Ctrl+C and F12 but lets Ctrl+R (refresh) through', () => {
    render(<Harness active />);
    const copyKey = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      cancelable: true,
    });
    act(() => {
      document.dispatchEvent(copyKey);
    });
    expect(copyKey.defaultPrevented).toBe(true);

    const devtools = new KeyboardEvent('keydown', {
      key: 'F12',
      cancelable: true,
    });
    act(() => {
      document.dispatchEvent(devtools);
    });
    expect(devtools.defaultPrevented).toBe(true);
    expect(screen.getByTestId('total').textContent).toBe('2');

    const refresh = new KeyboardEvent('keydown', {
      key: 'r',
      ctrlKey: true,
      cancelable: true,
    });
    act(() => {
      document.dispatchEvent(refresh);
    });
    expect(refresh.defaultPrevented).toBe(false);
    expect(screen.getByTestId('total').textContent).toBe('2');
  });

  it('counts a tab-hidden transition as a proctor flag', () => {
    render(<Harness active />);
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('total').textContent).toBe('1');
  });

  it('adds the print-block class while active and removes it when inactive', () => {
    const { rerender } = render(<Harness active />);
    expect(document.documentElement.classList.contains('exam-guard-active')).toBe(
      true,
    );
    rerender(<Harness active={false} />);
    expect(document.documentElement.classList.contains('exam-guard-active')).toBe(
      false,
    );
  });

  it('does not intercept anything while inactive', () => {
    render(<Harness active={false} />);
    const event = dispatchOnDocument('copy');
    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByTestId('total').textContent).toBe('0');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the attribution watermark with the student label', () => {
    render(<Harness active />);
    const watermark = screen.getByTestId('exam-watermark');
    expect(watermark).toHaveAttribute('aria-hidden', 'true');
    expect(watermark).toHaveTextContent('علی رضایی — کد آزمون ABC123');
    expect(watermark).toHaveClass('pointer-events-none');
  });
});
