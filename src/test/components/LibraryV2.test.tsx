/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Library v2 component tests — Phase 3 additions.
 * Covers PageHeader, StatCard, SearchInput, Textarea, Toggle, FilterBar,
 * DifficultyBadge, StatusBadge (new statuses), EmptyState compact, Table onRetry,
 * and the Toast/ToastStack layout contract.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  DifficultyBadge,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchInput,
  StatCard,
  StatusBadge,
  Table,
  Textarea,
  Toast,
  ToastStack,
  Toggle,
} from '../../components/UIComponents';

describe('PageHeader', () => {
  it('renders an h1 by default (one h1 per page)', () => {
    render(<PageHeader title="مدیریت آزمون‌ها" subtitle="زیرعنوان" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('مدیریت آزمون‌ها');
    expect(screen.getByText('زیرعنوان')).toBeInTheDocument();
  });

  it('renders an h2 for sub-view headers', () => {
    render(<PageHeader level={2} title="تنظیمات آزمون" />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('fires the back button', () => {
    const onBack = vi.fn();
    render(<PageHeader title="تیتر" back={{ label: 'بازگشت', onClick: onBack }} />);
    fireEvent.click(screen.getByRole('button', { name: /بازگشت/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('StatCard', () => {
  it('renders label, value and unit', () => {
    render(<StatCard label="تعداد دانش‌آموزان" value={42} unit="نفر" />);
    expect(screen.getByText('تعداد دانش‌آموزان')).toBeInTheDocument();
    expect(screen.getByText('نفر')).toBeInTheDocument();
  });

  it('renders the footnote with tone', () => {
    render(<StatCard label="l" value={1} footnote="پاسخ‌های تشریحی در انتظار نمره" footnoteTone="danger" />);
    expect(screen.getByText('پاسخ‌های تشریحی در انتظار نمره')).toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('renders a search field and accepts typing', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="جستجو..." />);
    const field = screen.getByPlaceholderText('جستجو...');
    expect(field).toHaveAttribute('type', 'search');
    fireEvent.change(field, { target: { value: 'علی' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Textarea', () => {
  it('associates label with the field and shows helper text', () => {
    render(<Textarea label="توضیحات" helperText="اختیاری" />);
    expect(screen.getByLabelText('توضیحات')).toBeInTheDocument();
    expect(screen.getByText('اختیاری')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('exposes role=switch and toggles on click', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="ارسال خودکار" />);
    const sw = screen.getByRole('switch', { name: 'ارسال خودکار' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked state via aria-checked', () => {
    render(<Toggle checked onChange={() => {}} label="x" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('FilterBar', () => {
  it('shows the clear-all action only when filters are active', () => {
    const onClearAll = vi.fn();
    const { rerender } = render(
      <FilterBar hasActiveFilters={false} onClearAll={onClearAll}>
        <div>controls</div>
      </FilterBar>,
    );
    expect(screen.queryByRole('button', { name: /پاک کردن فیلترها/ })).toBeNull();
    rerender(
      <FilterBar hasActiveFilters onClearAll={onClearAll}>
        <div>controls</div>
      </FilterBar>,
    );
    fireEvent.click(screen.getByRole('button', { name: /پاک کردن فیلترها/ }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('DifficultyBadge', () => {
  it('maps difficulties to labels and defaults undefined to متوسط', () => {
    render(
      <>
        <DifficultyBadge difficulty="easy" />
        <DifficultyBadge difficulty="hard" />
        <DifficultyBadge />
      </>,
    );
    expect(screen.getByText('آسان')).toBeInTheDocument();
    expect(screen.getByText('سخت')).toBeInTheDocument();
    expect(screen.getAllByText('متوسط').length).toBe(1);
  });
});

describe('StatusBadge — phase-3 statuses', () => {
  it('renders the new present / needs-grading statuses', () => {
    render(
      <>
        <StatusBadge status="present" />
        <StatusBadge status="needs-grading" />
      </>,
    );
    expect(screen.getByText('حاضر')).toBeInTheDocument();
    expect(screen.getByText('نیازمند تصحیح')).toBeInTheDocument();
  });
});

describe('EmptyState compact', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        compact
        title="موردی یافت نشد"
        description="فیلترها را تغییر دهید"
        action={<button type="button">retry</button>}
      />,
    );
    expect(screen.getByText('موردی یافت نشد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
  });
});

describe('Table onRetry', () => {
  it('renders the designed retry button instead of a page reload', () => {
    const onRetry = vi.fn();
    render(
      <Table headers={[{ key: 'a', label: 'A' }]} data={[]} renderRow={() => null} onRetry={onRetry} />,
    );
    const btn = screen.getByRole('button', { name: /تلاش دوباره/ });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders no action without onRetry/emptyAction', () => {
    render(<Table headers={[{ key: 'a', label: 'A' }]} data={[]} renderRow={() => null} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Toast / ToastStack layout contract', () => {
  it('Toast is position-free; ToastStack owns fixed placement', () => {
    render(
      <ToastStack>
        <Toast message="ذخیره شد" type="success" duration={60_000} />
        <Toast message="خطا" type="error" duration={60_000} />
      </ToastStack>,
    );
    const first = screen.getByText('ذخیره شد').parentElement!;
    expect(first.className).not.toContain('fixed');
    const stack = first.parentElement!;
    expect(stack.className).toContain('fixed');
    expect(stack.className).toContain('flex-col');
  });
});
