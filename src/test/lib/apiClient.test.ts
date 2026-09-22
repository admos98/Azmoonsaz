import { describe, it, expect, vi } from 'vitest';
import { ApiError, apiGet, apiPost } from '../../lib/apiClient';

describe('ApiError', () => {
  it('stores status and payload', () => {
    const err = new ApiError('fail', 404, { detail: 'not found' });
    expect(err.message).toBe('fail');
    expect(err.status).toBe(404);
    expect(err.payload).toEqual({ detail: 'not found' });
    expect(err.name).toBe('ApiError');
  });
});

function mockFetch(body: unknown, ok = true, status = 200) {
  const headers = new Map([['content-type', 'application/json']]);
  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: (k: string) => headers.get(k) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('apiGet', () => {
  it('calls fetch with correct URL and returns JSON', async () => {
    const mockData = { ok: true };
    vi.stubGlobal('fetch', mockFetch(mockData));

    const result = await apiGet('/api/test');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'GET' }));
    vi.restoreAllMocks();
  });

  it('throws ApiError on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'bad' }, false, 422));
    await expect(apiGet('/api/bad')).rejects.toThrow(ApiError);
    vi.restoreAllMocks();
  });

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(apiGet('/api/down')).rejects.toThrow('network');
    vi.restoreAllMocks();
  });
});

describe('apiPost', () => {
  it('sends POST with JSON body', async () => {
    vi.stubGlobal('fetch', mockFetch({ created: true }));

    const result = await apiPost('/api/create', { name: 'test' });
    expect(result).toEqual({ created: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    );
    vi.restoreAllMocks();
  });

  it('sends Authorization header when token provided as third arg', async () => {
    vi.stubGlobal('fetch', mockFetch({}));

    await apiPost('/api/auth', {}, { Authorization: 'Bearer my-token' });
    const mockFn = fetch as unknown as ReturnType<typeof vi.fn>;
    const callArgs = mockFn.mock.calls[0];
    expect(callArgs[1].headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer my-token' }),
    );
    vi.restoreAllMocks();
  });
});
