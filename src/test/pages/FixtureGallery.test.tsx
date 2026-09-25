/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The material laboratory must render with no backend, no session and no
 * network — it is the fixture the whole visual baseline is captured from, so a
 * crash here would silently invalidate every before/after comparison.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FixtureGallery from '../../pages/dev/FixtureGallery';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { MotionProvider } from '../../contexts/MotionContext';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
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
  <ThemeProvider>
    <MotionProvider>{children}</MotionProvider>
  </ThemeProvider>
);

describe('FixtureGallery', () => {
  it('renders every fixture section without a backend', () => {
    render(<FixtureGallery />, { wrapper });

    expect(screen.getByTestId('fixture-gallery')).toBeInTheDocument();
    // all nine sections
    for (const heading of [
      '۱. دستور پخت مواد',
      '۲. نردبان ارتفاع',
      '۳. کنترل‌ها',
      '۴. فیلد‌ها',
      '۵. وضعیت‌ها',
      '۶. لایه‌های شناور',
      '۷. حالت خالی',
      '۸. نشان',
      '۹. مقیاس تایپوگرافی',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    // all five material recipes are present (name appears once per recipe, and
    // `glx-inset` is also referenced in the fields section)
    for (const material of ['glx', 'glx-strong', 'glx-dark', 'glx-inset', 'glx-clear']) {
      expect(screen.getAllByText(material, { exact: false }).length).toBeGreaterThan(0);
    }
  });

  it('switches theme from the toolbar', async () => {
    const user = userEvent.setup();
    render(<FixtureGallery />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'dark' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
  });

  it('opens the modal from its trigger button', async () => {
    const user = userEvent.setup();
    render(<FixtureGallery />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'باز کردن مودال' }));

    expect(await screen.findByText('مودال آزمایشی')).toBeInTheDocument();
  });
});
