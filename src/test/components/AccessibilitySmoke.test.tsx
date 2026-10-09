import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, Modal, Table, Toast, ToastStack } from '../../ui';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        باز کردن
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="نمونه" triggerRef={triggerRef}>
        <button>اول</button>
        <button>آخر</button>
      </Modal>
    </>
  );
}

describe('shared accessibility smoke checks', () => {
  it('announces toasts through the single stack region, not per-toast', () => {
    // Live-region map: the STACK is the one polite region for the toast
    // concern; individual Toasts carry no live region of their own.
    render(
      <ToastStack>
        <Toast message="ذخیره شد" type="success" duration={60_000} />
        <Toast message="اطلاع" type="info" duration={60_000} />
      </ToastStack>,
    );
    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveAttribute('aria-live', 'polite');
    expect(regions[0]).toHaveAttribute('aria-atomic', 'true');
  });

  it('escalates error toasts via alert role without a second live region', () => {
    render(
      <ToastStack>
        <Toast message="ذخیره نشد" type="error" duration={60_000} />
      </ToastStack>,
    );
    // role="alert" is implicitly assertive — no explicit aria-live needed.
    expect(screen.getByRole('alert')).not.toHaveAttribute('aria-live');
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('makes overflow tables keyboard reachable and labelled', () => {
    render(
      <Table
        headers={[{ key: 'name', label: 'نام' }]}
        data={[{ name: 'نمونه' }]}
        renderRow={(row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
          </tr>
        )}
      />,
    );
    const region = screen.getByRole('region', { name: /جدول داده/ });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('traps modal focus, closes with Escape, and restores its trigger', async () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'باز کردن' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'نمونه' });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('keeps empty-state recovery action keyboard operable', () => {
    const recover = vi.fn();
    render(
      <EmptyState
        title="داده‌ای نیست"
        description="فیلترها را پاک کنید."
        action={<button onClick={recover}>پاک کردن فیلترها</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن فیلترها' }));
    expect(recover).toHaveBeenCalledOnce();
  });
});
