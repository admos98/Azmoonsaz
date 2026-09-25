import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAppNavigation, useUnsavedChanges } from '../../hooks/useUnsavedChanges';

afterEach(() => vi.restoreAllMocks());

describe('useUnsavedChanges', () => {
  it('guards in-app actions and browser unload only while dirty', () => {
    const action = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result, rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: true },
    });

    act(() => result.current(action));
    expect(confirm).toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(requestAppNavigation()).toBe(false);

    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    rerender({ dirty: false });
    act(() => result.current(action));
    expect(action).toHaveBeenCalledOnce();
  });
});
