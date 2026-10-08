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
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ConfirmDialog,
  DifficultyBadge,
  Dropdown,
  EmptyState,
  FilterBar,
  IconButton,
  Modal,
  PageHeader,
  PillButton,
  SearchInput,
  StatCard,
  StatusBadge,
  Table,
  Tabs,
  Textarea,
  TextLink,
  Toast,
  ToastStack,
  Toggle,
} from '../../components/UIComponents';
import { EmptyStateArt } from '../../components/EmptyStateArt';
import { BubbleLoader } from '../../components/BubbleLoader';
import { PanelCrest } from '../../components/PanelCrest';
import { Cut } from '../../components/Cut';
import { Seal } from '../../components/Seal';
import { AbsenceArt } from '../../components/AbsenceArt';
import { AbsencePage } from '../../components/AbsencePage';
import { ThemeProvider } from '../../contexts/ThemeContext';

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
  it('maps difficulties to labels', () => {
    render(
      <>
        <DifficultyBadge difficulty="easy" />
        <DifficultyBadge difficulty="hard" />
        <DifficultyBadge difficulty="medium" />
      </>,
    );
    expect(screen.getByText('آسان')).toBeInTheDocument();
    expect(screen.getByText('سخت')).toBeInTheDocument();
    expect(screen.getByText('متوسط')).toBeInTheDocument();
  });

  it('renders nothing when difficulty is absent — never invents a level', () => {
    const { container } = render(<DifficultyBadge />);
    expect(container.firstChild).toBeNull();
  });
});

describe('F-9 accessibility wiring', () => {
  it('Toggle names itself from the visible label once (no aria-label echo)', () => {
    render(<Toggle checked={false} onChange={() => {}} label="ارسال خودکار" description="توضیح" />);
    const sw = screen.getByRole('switch');
    expect(sw).not.toHaveAttribute('aria-label');
    const labelledBy = sw.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('ارسال خودکار');
    const describedBy = sw.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe('توضیح');
  });

  it('Tabs without idPrefix keeps ids internal — no dangling aria-controls', () => {
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'الف' },
          { id: 'b', label: 'ب' },
        ]}
        activeTab="a"
        onChange={() => {}}
        ariaLabel="بخش‌ها"
      />,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'بخش‌ها');
    expect(screen.getByRole('tab', { name: 'الف' })).not.toHaveAttribute('aria-controls');
  });

  it('Tabs with idPrefix exposes stable ids the consumer panel links to', () => {
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'الف' },
          { id: 'b', label: 'ب' },
        ]}
        activeTab="a"
        onChange={() => {}}
        idPrefix="demo-tabs"
      />,
    );
    const active = screen.getByRole('tab', { name: 'الف' });
    expect(active).toHaveAttribute('id', 'demo-tabs-tab-a');
    expect(active).toHaveAttribute('aria-controls', 'demo-tabs-panel');
    expect(screen.getByRole('tab', { name: 'ب' })).toHaveAttribute(
      'aria-controls',
      'demo-tabs-panel',
    );
  });

  it('Table header cells carry scope="col"', () => {
    render(
      <Table
        headers={[{ key: 'name', label: 'نام' }]}
        data={[{ id: 'r1', name: 'علی' }]}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
          </tr>
        )}
      />,
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute('scope', 'col');
  });

  it('ConfirmDialog renders the title once — the Modal header owns it', () => {
    render(
      <ConfirmDialog
        isOpen
        title="حذف آزمون"
        message="این عملیات برگشت‌پذیر نیست."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getAllByText('حذف آزمون')).toHaveLength(1);
    expect(screen.getByText('این عملیات برگشت‌پذیر نیست.')).toBeInTheDocument();
  });

  it('Toast clears both timers — no late onClose after unmount', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { unmount } = render(<Toast message="ذخیره شد" onClose={onClose} duration={1000} />);
      unmount();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Toast fires onClose exactly once after duration + fade', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<Toast message="ذخیره شد" onClose={onClose} duration={1000} />);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onClose).not.toHaveBeenCalled(); // fade window still running
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Dropdown listbox is named by its trigger (aria-labelledby, not a copied label)', () => {
    render(
      <Dropdown
        id="cls"
        value="a"
        onChange={() => {}}
        label="کلاس"
        options={[
          { value: 'a', label: 'اول' },
          { value: 'b', label: 'دوم' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-labelledby', 'cls');
    expect(listbox).not.toHaveAttribute('aria-label');
    // trigger id resolves to the visible button
    expect(document.getElementById('cls')).toBe(screen.getByRole('button'));
  });

  it('Dropdown parks focus and scrolls the list onto the selected option', () => {
    render(
      <Dropdown
        value="b"
        onChange={() => {}}
        options={[
          { value: 'a', label: 'اول' },
          { value: 'b', label: 'دوم' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    const selected = screen.getByRole('option', { name: 'دوم' });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute('aria-selected', 'true');
  });

  it('Modal locks body scroll while open and restores it on close (F-9)', () => {
    const { rerender, unmount } = render(
      <Modal isOpen onClose={() => {}} title="پنجره">
        محتوا
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal isOpen={false} onClose={() => {}} title="پنجره">
        محتوا
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
    // unmount from open state also restores (cleanup path)
    rerender(
      <Modal isOpen onClose={() => {}} title="پنجره">
        محتوا
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('BubbleLoader (the sanctioned loop)', () => {
  it('announces via role=status with the default Persian label, four bubbles', () => {
    render(<BubbleLoader />);
    const loader = screen.getByRole('status');
    expect(loader).toHaveAttribute('aria-label', 'در حال بارگذاری…');
    expect(loader.className).toContain('bubble-loader');
    expect(loader.querySelectorAll('i')).toHaveLength(4);
  });

  it('decorative mode is aria-hidden with no live role (outer region owns the message)', () => {
    const { container } = render(<BubbleLoader label={null} />);
    const loader = container.querySelector('.bubble-loader')!;
    expect(loader).toHaveAttribute('aria-hidden', 'true');
    expect(loader).not.toHaveAttribute('role');
    expect(loader.querySelectorAll('i')).toHaveLength(4);
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

  it('EmptyStateArt picks the per-theme pack and stays out of AT (1K)', () => {
    render(
      <ThemeProvider>
        <EmptyStateArt kind="students" size={96} />
      </ThemeProvider>,
    );
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(/^\/empty-art\/(light|dark)\/01-students\.png$/);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('96');
  });

  it('PanelCrest reserves the rail in both states (V2 zero-shift)', () => {
    const { container, rerender } = render(
      <ThemeProvider>
        <PanelCrest kind="grading" state="filled">
          <div id="body">محتوا</div>
        </PanelCrest>
      </ThemeProvider>,
    );
    const root = container.querySelector('.panel-crest')!;
    expect(root.getAttribute('data-state')).toBe('filled');
    expect(root.querySelector('#body')).toBeTruthy();
    const rail = root.querySelector('.panel-crest__rail')!;
    expect(rail.getAttribute('aria-hidden')).toBe('true');
    expect(rail.querySelector('img')!.getAttribute('src')).toMatch(
      /^\/empty-art\/(light|dark)\/04-grading\.png$/,
    );
    // empty keeps the SAME structure — only data-state flips (the rail
    // column is reserved in both states; CSS does the opacity handoff)
    rerender(
      <ThemeProvider>
        <PanelCrest kind="grading" state="empty">
          <div id="body">محتوا</div>
        </PanelCrest>
      </ThemeProvider>,
    );
    expect(container.querySelector('.panel-crest')!.getAttribute('data-state')).toBe('empty');
    expect(container.querySelector('.panel-crest__rail img')).toBeTruthy();
    expect(container.querySelector('#body')).toBeTruthy();
  });

  it('Cut picks the keyed theme pair and stays out of AT (C.1/D.3)', () => {
    render(
      <ThemeProvider>
        <Cut kind="questions" size={24} />
      </ThemeProvider>,
    );
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(/^\/empty-art\/cuts\/(light|dark)\/cut-1\.png$/);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.getAttribute('width')).toBe('24');
    expect(img.getAttribute('height')).toBe('24');
  });

  it('Seal picks the keyed pair, wears the draw-in class, stays out of AT (C.3)', () => {
    render(
      <ThemeProvider>
        <Seal size={96} />
      </ThemeProvider>,
    );
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(/^\/empty-art\/seal\/(light|dark)\/seal\.png$/);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.className).toContain('seal');
    expect(img.getAttribute('width')).toBe('96');
  });

  it('AbsenceArt picks the keyed absence pair and stays out of AT (C.2)', () => {
    render(
      <ThemeProvider>
        <AbsenceArt kind="no-results" size={160} />
      </ThemeProvider>,
    );
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(
      /^\/empty-art\/absence\/(light|dark)\/abs-4-no-results\.png$/,
    );
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('AbsenceArt maps no-classes to the abs-5 key (C.5 onboarding)', () => {
    render(
      <ThemeProvider>
        <AbsenceArt kind="no-classes" size={112} />
      </ThemeProvider>,
    );
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(
      /^\/empty-art\/absence\/(light|dark)\/abs-5-no-classes\.png$/,
    );
    expect(img.getAttribute('width')).toBe('112');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('AbsencePage carries art + title + action (C.2 hosts)', () => {
    const onAction = vi.fn();
    render(
      <ThemeProvider>
        <AbsencePage
          kind="not-found"
          title="صفحه‌ای پیدا نشد"
          description="نشانی درست نیست."
          actionLabel="بازگشت به داشبورد"
          onAction={onAction}
        />
      </ThemeProvider>,
    );
    expect(
      document.querySelector('img[src^="/empty-art/absence/"]'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'صفحه‌ای پیدا نشد',
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('EmptyState renders art above the title; compact stays icon-only', () => {
    const page = render(
      <EmptyState
        title="T"
        description="D"
        art={<img alt="" src="/empty-art/light/06-classes.png" />}
      />,
    );
    const img = page.container.querySelector('img')!;
    const h4 = page.container.querySelector('h4')!;
    // art sits above the title in DOM order
    expect(img.compareDocumentPosition(h4) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // compact ignores art entirely — icon circle only
    const compact = render(
      <EmptyState
        compact
        title="t"
        description="d"
        icon={<span data-testid="icon">ic</span>}
        art={<img alt="" src="/empty-art/light/06-classes.png" />}
      />,
    );
    expect(compact.container.querySelector('img')).toBeNull();
    expect(compact.container.querySelector('[data-testid="icon"]')).not.toBeNull();
  });
});
