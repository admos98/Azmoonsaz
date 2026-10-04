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
  IconButton,
  PageHeader,
  PillButton,
  SearchInput,
  StatCard,
  StatusBadge,
  Table,
  Textarea,
  TextLink,
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
    render(
      <StatCard
        label="l"
        value={1}
        footnote="پاسخ‌های تشریحی در انتظار نمره"
        footnoteTone="danger"
      />,
    );
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
      <Table
        headers={[{ key: 'a', label: 'A' }]}
        data={[]}
        renderRow={() => null}
        onRetry={onRetry}
      />,
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

describe('Micro controls — TextLink / IconButton / PillButton (F-6 primitives)', () => {
  const RING = 'focus-visible:outline-[var(--color-focus-ring)]';

  it('TextLink composes size/tone/weight/hover and stays a typed button', () => {
    render(
      <TextLink size="sm" bold>
        فراموشی رمز
      </TextLink>,
    );
    const b = screen.getByRole('button', { name: 'فراموشی رمز' });
    expect(b.className).toContain('cursor-pointer');
    expect(b.className).toContain('text-micro');
    expect(b.className).toContain('text-[var(--color-accent)]');
    expect(b.className).toContain('font-bold');
    expect(b.className).toContain('hover:underline');
    expect(b.className).toContain(RING);
    expect(b.getAttribute('type')).toBe('button');
    // size omitted = inherit parent size (no text-* class emitted)
    const bare = render(
      <TextLink tone="danger" hover="none">
        حذف
      </TextLink>,
    );
    const b2 = bare.container.querySelector('button')!;
    expect(b2.className).not.toMatch(/text-(micro|caption)/);
    expect(b2.className).toContain('text-[var(--color-danger)]');
    expect(b2.className).not.toContain('hover:underline');
  });

  it('IconButton requires its accessible name and maps tone×surface', () => {
    render(
      <IconButton
        label="باز کردن گذرواژه"
        size="xs"
        tone="tertiary"
        surface="plain"
        motion={false}
      />,
    );
    const b = screen.getByRole('button', { name: 'باز کردن گذرواژه' });
    expect(b.className).toContain('p-1');
    expect(b.className).toContain('text-[var(--color-text-tertiary)]');
    expect(b.className).toContain('hover:text-[var(--color-text-primary)]');
    expect(b.className).not.toContain('transition-all'); // motion=false (legacy parity)
    expect(b.className).toContain(RING);
    // danger wash is the destructive row-action pair
    const c = render(<IconButton label="حذف" tone="danger" surface="wash" radius="lg" />);
    const b2 = c.container.querySelector('button')!;
    expect(b2.className).toContain('text-[var(--color-danger)]');
    expect(b2.className).toContain('hover:bg-[var(--color-danger-soft)]/40');
    expect(b2.className).toContain('rounded-lg');
    expect(b2.className).toContain('transition-all'); // motion defaults on
  });

  it('PillButton composes fill family, default ink, and size ladder', () => {
    render(<PillButton fill="danger-soft">حذف آزمون</PillButton>);
    const b = screen.getByRole('button', { name: 'حذف آزمون' });
    expect(b.className).toContain('bg-[var(--color-danger-soft)]/40');
    expect(b.className).toContain('text-[var(--color-danger)]'); // default ink from fill
    expect(b.className).toContain('px-2.5 py-1.5'); // default size sm
    expect(b.className).toContain('rounded-lg');
    expect(b.className).toContain('text-micro');
    expect(b.className).toContain('font-bold');
    expect(b.className).toContain(RING);
    // solid fill flips ink to on-solid unless overridden
    const c = render(
      <PillButton fill="warning-solid" textColor="primary" size="lg" text="caption" weight="black">
        شروع
      </PillButton>,
    );
    const b2 = c.container.querySelector('button')!;
    expect(b2.className).toContain('bg-[var(--color-warning-solid)]');
    expect(b2.className).toContain('text-[var(--color-text-primary)]');
    expect(b2.className).toContain('px-3.5 py-1.5');
    expect(b2.className).toContain('text-caption');
    expect(b2.className).toContain('font-black');
  });

  it('EmptyState actionFirst puts the CTA above the description (1E)', () => {
    const { container } = render(
      <EmptyState
        title="هیچ آزمونی"
        description="توضیحات"
        actionFirst
        action={<button type="button">بسازید</button>}
      />,
    );
    const texts = container.querySelector('div.space-y-1')!;
    const kids = [...texts.children].map((el) => el.tagName);
    expect(kids).toEqual(['H4', 'DIV', 'P']); // title, action, description
    // default order unchanged: description then action outside the text block
    const d = render(
      <EmptyState title="t" description="d" action={<button type="button">a</button>} />,
    );
    const block = d.container.querySelector('div.space-y-1')!;
    expect([...block.children].map((el) => el.tagName)).toEqual(['H4', 'P']);
  });
});
