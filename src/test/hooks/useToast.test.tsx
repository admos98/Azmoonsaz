import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useToast } from '../../hooks/useToast';

describe('useToast', () => {
  it('deduplicates an identical active message', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('ذخیره شد', 'success'));
    const first = result.current.toastElement?.key;
    act(() => result.current.showToast('ذخیره شد', 'success'));
    expect(result.current.toastElement?.key).toBe(first);

    act(() => result.current.showToast('خطا', 'error'));
    expect(result.current.toastElement?.key).not.toBe(first);
  });
});
