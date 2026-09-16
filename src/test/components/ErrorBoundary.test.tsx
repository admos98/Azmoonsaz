import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../components/ErrorBoundary';

function Bomb(): React.ReactNode {
  throw new Error('Test bomb');
}

function GoodChild() {
  return <div data-testid="good">Hello</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('good')).toBeTruthy();
  });

  it('catches errors and shows fallback UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/خطایی رخ داد/)).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('retry button re-renders children', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function ConditionalBomb() {
      if (shouldThrow) throw new Error('bomb');
      return <div data-testid="recovered">recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/خطایی رخ داد/)).toBeTruthy();
    shouldThrow = false;

    fireEvent.click(screen.getByText(/تلاش مجدد/));
    rerender(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('recovered')).toBeTruthy();
    consoleSpy.mockRestore();
  });
});
