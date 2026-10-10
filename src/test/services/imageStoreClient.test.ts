import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockTeacherPost, mockUploadToSignedUrl } = vi.hoisted(() => ({
  mockTeacherPost: vi.fn(),
  mockUploadToSignedUrl: vi.fn(),
}));

vi.mock('../../services/teacherApi', () => ({
  teacherPost: (...args: unknown[]) => mockTeacherPost(...args),
}));

vi.mock('../../lib/supabasePublic', () => ({
  getSupabasePublicClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl: (...args: unknown[]) => mockUploadToSignedUrl(...args) }) },
  }),
}));

import {
  isImageStoreKey,
  isLegacyImageValue,
  shrinkImageForUpload,
  uploadQuestionImageFile,
  resolveTeacherImageUrls,
  collectClientImageKeys,
  ImageUploadError,
  TARGET_IMAGE_BYTES,
} from '../../services/imageStoreClient';

/** Minimal canvas/bitmap doubles for jsdom (no canvas package installed). */
function installCanvasDoubles(opts: { webpBytes: number; jpegBytes?: number } = { webpBytes: 100_000 }) {
  const webpBlob = new Blob([new Uint8Array(opts.webpBytes)], { type: 'image/webp' });
  const jpegBlob = new Blob([new Uint8Array(opts.jpegBytes ?? 200_000)], { type: 'image/jpeg' });
  const ctx = { drawImage: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: null as unknown };
  canvas.toBlob = (cb: (b: Blob | null) => void, type: string) => {
    if (type === 'image/webp') cb(webpBlob);
    else if (type === 'image/jpeg') cb(jpegBlob);
    else cb(new Blob([new Uint8Array(10)], { type }));
  };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() }));
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: unknown[]) => {
    if (tag === 'canvas') return canvas as unknown as HTMLElement;
    return (origCreate as (...a: unknown[]) => HTMLElement)(tag, ...rest);
  }) as typeof document.createElement);
}

const pngFile = (size = 3_000_000) =>
  new File([new Uint8Array(size)], 'photo.png', { type: 'image/png' });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockTeacherPost.mockReset();
  mockUploadToSignedUrl.mockReset();
  mockUploadToSignedUrl.mockResolvedValue({ data: {}, error: null });
});

describe('isImageStoreKey / isLegacyImageValue', () => {
  it('accepts minted keys, rejects URLs and tricks', () => {
    const teacher = '11111111-1111-4111-8111-111111111111';
    expect(isImageStoreKey(`${teacher}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`)).toBe(true);
    expect(isImageStoreKey('https://x/y.webp')).toBe(false);
    expect(isImageStoreKey('data:image/png;base64,A')).toBe(false);
    expect(isImageStoreKey('')).toBe(false);
  });

  it('flags legacy content', () => {
    expect(isLegacyImageValue('data:image/png;base64,A')).toBe(true);
    expect(isLegacyImageValue('https://example.com/x.png')).toBe(true);
    expect(
      isLegacyImageValue('11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp'),
    ).toBe(false);
    expect(isLegacyImageValue('')).toBe(false);
  });
});

describe('shrinkImageForUpload', () => {
  it('rejects non-images and HEIC', async () => {
    installCanvasDoubles();
    await expect(shrinkImageForUpload(new File(['x'], 't.txt', { type: 'text/plain' }))).rejects.toThrow(
      ImageUploadError,
    );
    await expect(shrinkImageForUpload(new File(['x'], 'p.heic', { type: 'image/heic' }))).rejects.toThrow(
      ImageUploadError,
    );
  });

  it('returns a webp blob under the target size', async () => {
    installCanvasDoubles({ webpBytes: 120_000 });
    const { blob, contentType } = await shrinkImageForUpload(pngFile());
    expect(contentType).toBe('image/webp');
    expect(blob.size).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
  });

  it('steps quality down when the first encode is too large', async () => {
    // 800KB at q0.82 → still over target → q0.65 must be asked too.
    const sizes = [800_000, 300_000];
    let calls = 0;
    const ctx = { drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob([new Uint8Array(sizes[Math.min(calls++, sizes.length - 1)])], { type: 'image/webp' }));
      },
    };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3000, height: 2000, close: vi.fn() }));
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, ...rest: unknown[]) => {
      if (tag === 'canvas') return canvas as unknown as HTMLElement;
      return (origCreate as (...a: unknown[]) => HTMLElement)(tag, ...rest);
    }) as typeof document.createElement);
    const { blob } = await shrinkImageForUpload(pngFile());
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(blob.size).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
  });

  it('rejects images that stay over the hard cap', async () => {
    installCanvasDoubles({ webpBytes: 5_000_000, jpegBytes: 5_000_000 });
    const origCreate = document.createElement.bind(document);
    // Force PNG path over cap too by making toBlob return large for all types.
    await expect(shrinkImageForUpload(pngFile())).rejects.toThrow(ImageUploadError);
    void origCreate;
  });
});

describe('uploadQuestionImageFile', () => {
  const KEY = '11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';

  it('completes via Supabase signed-upload when a token is minted', async () => {
    installCanvasDoubles({ webpBytes: 50_000 });
    const mintResponse = {
      ok: true,
      uploadUrl: 'https://supabase.test/object/upload/sign/x?token=abc',
      uploadToken: 'abc-token',
      bucket: 'question-images',
      key: KEY,
      expiresIn: 900,
      contentType: 'image/webp',
    };
    mockTeacherPost.mockResolvedValue(mintResponse);
    const key = await uploadQuestionImageFile(pngFile(100_000));
    expect(key).toBe(KEY);
    expect(mockTeacherPost).toHaveBeenCalledWith(
      '/api/teacher/images/upload-url',
      expect.objectContaining({ contentType: 'image/webp' }),
    );
    expect(mockUploadToSignedUrl).toHaveBeenCalledTimes(1);
    const [putKey, putToken, putBlob, putOpts] = mockUploadToSignedUrl.mock.calls[0];
    expect(putKey).toBe(KEY);
    expect(putToken).toBe('abc-token');
    expect((putBlob as Blob).size).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
    expect(putOpts).toEqual(expect.objectContaining({ contentType: 'image/webp' }));
  });

  it('surfaces upload failures with a Persian message', async () => {
    installCanvasDoubles({ webpBytes: 50_000 });
    mockTeacherPost.mockResolvedValue({
      ok: true,
      uploadUrl: 'https://supabase.test/x',
      uploadToken: 'tok',
      bucket: 'question-images',
      key: KEY,
      expiresIn: 900,
      contentType: 'image/webp',
    });
    mockUploadToSignedUrl.mockResolvedValue({ data: null, error: new Error('denied') });
    await expect(uploadQuestionImageFile(pngFile(100_000))).rejects.toThrow(ImageUploadError);
  });

  it('PUTs raw bytes for S3-style mints (no token)', async () => {
    installCanvasDoubles({ webpBytes: 50_000 });
    const mintResponse = {
      ok: true,
      uploadUrl: 'https://s3.example.com/bucket/key?sig=1',
      uploadToken: null,
      key: KEY,
      expiresIn: 900,
      contentType: 'image/webp',
    };
    mockTeacherPost.mockResolvedValue(mintResponse);
    const puts: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        puts.push({ url: String(url), init: init as RequestInit });
        return Promise.resolve({ ok: true, status: 200 });
      }),
    );
    const key = await uploadQuestionImageFile(pngFile(100_000));
    expect(key).toBe(KEY);
    expect(mockTeacherPost).toHaveBeenCalledWith(
      '/api/teacher/images/upload-url',
      expect.objectContaining({ contentType: 'image/webp' }),
    );
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe('https://s3.example.com/bucket/key?sig=1');
    expect(puts[0].init.method).toBe('PUT');
    expect((puts[0].init.headers as Record<string, string>)['Content-Type']).toBe('image/webp');
    expect((puts[0].init.body as Blob).size).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
  });

  it('surfaces PUT failures with a Persian message', async () => {
    installCanvasDoubles({ webpBytes: 50_000 });
    mockTeacherPost.mockResolvedValue({
      ok: true,
      uploadUrl: 'https://s3.example.com/bucket/key?sig=1',
      uploadToken: null,
      key: KEY,
      expiresIn: 900,
      contentType: 'image/webp',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(uploadQuestionImageFile(pngFile(100_000))).rejects.toThrow(ImageUploadError);
  });
});

describe('resolveTeacherImageUrls', () => {
  it('returns {} without network when no keys qualify', async () => {
    expect(await resolveTeacherImageUrls(['https://example.com/x.png', ''])).toEqual({});
    expect(mockTeacherPost).not.toHaveBeenCalled();
  });

  it('batch-resolves owned keys through the read endpoint', async () => {
    const k1 = '11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
    mockTeacherPost.mockResolvedValue({ ok: true, urls: { [k1]: 'https://signed/x' } });
    const out = await resolveTeacherImageUrls([k1, 'https://example.com/legacy.png']);
    expect(mockTeacherPost).toHaveBeenCalledWith('/api/teacher/images/read', { keys: [k1] });
    expect(out).toEqual({ [k1]: 'https://signed/x' });
  });

  it('returns {} when the server answers without urls', async () => {
    const k1 = '11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
    mockTeacherPost.mockResolvedValue({ ok: false });
    expect(await resolveTeacherImageUrls([k1])).toEqual({});
  });
});

describe('collectClientImageKeys', () => {
  it('collects from body and question shapes', () => {
    const k1 = '11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp';
    const k2 = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp';
    expect(collectClientImageKeys({ imageUrl: k1, options: [{ imageUrl: k2 }] })).toEqual([k1, k2]);
    expect(collectClientImageKeys({ imageUrl: k1 })).toEqual([k1]);
    expect(collectClientImageKeys(null)).toEqual([]);
  });
});
