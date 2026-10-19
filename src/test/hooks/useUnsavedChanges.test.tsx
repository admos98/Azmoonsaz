import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAppNavigation, useUnsavedChanges } from '../../hooks/useUnsavedChanges';

afterEach(() => vi.restoreAllMocks());

describe('useUnsavedChanges', () => {
  it('guards in-app actions behind the glass dialog and browser unload while dirty', () => {
    const action = vi.fn();
    const { result, rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: true },
    });

    // while dirty the action is parked, the dialog opens, nothing runs
    act(() => result.current.guarded(action));
    expect(result.current.dialogProps.isOpen).toBe(true);
    expect(result.current.dialogProps.message).toContain('تغییرات');
    expect(action).not.toHaveBeenCalled();
    expect(requestAppNavigation()).toBe(false);

    // the designed path: confirm runs the parked action once
    act(() => result.current.dialogProps.onConfirm());
    expect(result.current.dialogProps.isOpen).toBe(false);
    expect(action).toHaveBeenCalledOnce();

    // cancel discards the parked action
    act(() => result.current.guarded(action));
    expect(result.current.dialogProps.isOpen).toBe(true);
    act(() => result.current.dialogProps.onCancel());
    expect(result.current.dialogProps.isOpen).toBe(false);
    expect(action).toHaveBeenCalledOnce();

    // browser unload stays guarded only while dirty
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    rerender({ dirty: false });
    const unload2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload2);
    expect(unload2.defaultPrevented).toBe(false);

    act(() => result.current.guarded(action));
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.dialogProps.isOpen).toBe(false);
  });

  it('runs clean actions through the navigation bypass without a dialog', () => {
    const { result } = renderHook(() => useUnsavedChanges(false));
    const action = vi.fn();
    act(() => result.current.guarded(action));
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.dialogProps.isOpen).toBe(false);
  });
});
