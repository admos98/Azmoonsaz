import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useToast } from '../../hooks/useToast';

describe('useToast', () => {
  it('starts with no toast element', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toastElement).toBeNull();
  });

  it('shows a toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('ذخیره شد', 'success'));
    expect(result.current.toastElement).not.toBeNull();
    expect(result.current.toastElement!.props.children).toHaveLength(1);
  });

  it('deduplicates an identical active message+type', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('ذخیره شد', 'success'));
    act(() => result.current.showToast('ذخیره شد', 'success'));
    const stack = result.current.toastElement!.props.children;
    expect(stack).toHaveLength(1);
  });

  it('stacks different messages and caps the stack at 3', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('اول', 'success'));
    act(() => result.current.showToast('دوم', 'error'));
    act(() => result.current.showToast('سوم', 'info'));
    expect(result.current.toastElement!.props.children).toHaveLength(3);

    act(() => result.current.showToast('چهارم', 'warning'));
    const stack = result.current.toastElement!.props.children;
    expect(stack).toHaveLength(3);
    expect(stack[stack.length - 1].props.message).toBe('چهارم');
  });

  it('removes a toast through its onClose', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('اول', 'success'));
    act(() => result.current.showToast('دوم', 'error'));
    const stack = result.current.toastElement!.props.children;
    act(() => stack[0].props.onClose());
    expect(result.current.toastElement!.props.children).toHaveLength(1);
  });
});
