import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolve } = vi.hoisted(() => ({ mockResolve: vi.fn() }));

vi.mock('../../services/imageStoreClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/imageStoreClient')>();
  return { ...actual, resolveTeacherImageUrls: (...args: unknown[]) => mockResolve(...args) };
});

import { useResolvedImageUrl } from '../../hooks/useResolvedImageUrl';

const KEY = '11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
const URL = 'https://signed.test/img-1';

beforeEach(() => {
  mockResolve.mockReset();
});

describe('useResolvedImageUrl', () => {
  it('derives sync cases without network: empty, legacy, invalid', () => {
    expect(renderHook(() => useResolvedImageUrl(null)).result.current).toEqual({
      src: null,
      loading: false,
      isLegacy: false,
    });
    expect(renderHook(() => useResolvedImageUrl('https://example.com/x.png')).result.current).toEqual({
      src: 'https://example.com/x.png',
      loading: false,
      isLegacy: true,
    });
    expect(renderHook(() => useResolvedImageUrl('nope')).result.current).toEqual({
      src: null,
      loading: false,
      isLegacy: false,
    });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('resolves a key once and reports loading first', async () => {
    let release!: (urls: Record<string, string>) => void;
    mockResolve.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result, unmount } = renderHook(() => useResolvedImageUrl(KEY));
    expect(result.current).toEqual({ src: null, loading: true, isLegacy: false });
    await act(async () => {
      release({ [KEY]: URL });
    });
    await waitFor(() => expect(result.current.src).toBe(URL));
    expect(result.current).toEqual({ src: URL, loading: false, isLegacy: false });
    expect(mockResolve).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('resolves null when the store has no URL and never stays loading', async () => {
    // NOTE: module-level urlCache persists across tests in this file, so a
    // fresh key is required — the previous test already cached KEY.
    const uncached = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
    mockResolve.mockResolvedValue({});
    const { result, unmount } = renderHook(() => useResolvedImageUrl(uncached));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ src: null, loading: false, isLegacy: false });
    unmount();
  });
});
