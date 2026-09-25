import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, Modal, Table, Toast } from '../../components/UIComponents';

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
  it('uses announcement priority appropriate to toast severity', () => {
    const { rerender } = render(<Toast message="ذخیره شد" type="success" duration={60_000} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    rerender(<Toast message="ذخیره نشد" type="error" duration={60_000} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
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
