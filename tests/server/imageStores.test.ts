/**
 * Image-store DRIVERS — supabaseStore.js and s3Store.js (CQ-8 coverage gap).
 *
 * Both drivers previously had zero test coverage while sitting on the
 * student-facing image path. These suites pin the contract that matters:
 * teacher-scoped key enforcement (403/400 before any network call), signed-URL
 * minting shapes, TTL clamping, and bounded pagination. The network layer is
 * fully mocked — no Supabase, no AWS.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TEACHER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KEY = `${TEACHER}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
const OTHER_KEY = `${OTHER}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
const DAY = 24 * 3600;

/* ------------------------------ supabase ------------------------------- */

const sbStorage = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  getSupabaseAdmin: () => ({ storage: sbStorage }),
}));

function sbFromMethods(overrides: Record<string, unknown> = {}) {
  return {
    createSignedUploadUrl: vi.fn(),
    createSignedUrls: vi.fn(),
    remove: vi.fn(),
    upload: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
}

async function freshSupabaseStore() {
  vi.resetModules();
  return import('../../api/_lib/supabaseStore.js');
}

beforeEach(() => {
  sbStorage.from.mockReset();
});
afterEach(() => {
  vi.resetModules();
});

describe('supabaseImageStore', () => {
  it('mintUploadUrl returns the signed-URL + token contract for an owned key', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    methods.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://sb.example/upload-url', token: 'tok-1' },
      error: null,
    });
    const { supabaseImageStore } = await freshSupabaseStore();
    const out = await supabaseImageStore.mintUploadUrl({ key: KEY, teacherId: TEACHER });
    expect(out).toEqual({
      uploadUrl: 'https://sb.example/upload-url',
      uploadToken: 'tok-1',
      bucket: 'question-images',
      key: KEY,
      expiresIn: 900,
      contentType: 'image/webp',
    });
    expect(methods.createSignedUploadUrl).toHaveBeenCalledWith(KEY, { upsert: false });
    expect(sbStorage.from).toHaveBeenCalledWith('question-images');
  });

  it('mintUploadUrl rejects malformed keys with 400 before any network call', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    const { supabaseImageStore } = await freshSupabaseStore();
    await expect(
      supabaseImageStore.mintUploadUrl({ key: 'https://evil.example/x.webp', teacherId: TEACHER }),
    ).rejects.toMatchObject({ message: 'invalid_image_key', status: 400 });
    expect(methods.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('mintUploadUrl rejects another teacher’s key with 403', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    const { supabaseImageStore } = await freshSupabaseStore();
    await expect(
      supabaseImageStore.mintUploadUrl({ key: OTHER_KEY, teacherId: TEACHER }),
    ).rejects.toMatchObject({ message: 'image_not_owned', status: 403 });
    expect(methods.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('mintReadUrl maps signed rows, filters foreign keys, clamps the TTL', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    methods.createSignedUrls.mockResolvedValue({
      data: [
        { path: KEY, signedUrl: 'https://sb.example/read-1' },
        { path: 'row-without-url', signedUrl: null },
      ],
      error: null,
    });
    const { supabaseImageStore } = await freshSupabaseStore();
    const urls = await supabaseImageStore.mintReadUrl({
      keys: [KEY, OTHER_KEY, 'not-a-key'],
      teacherId: TEACHER,
      expiresIn: 999 * DAY,
    });
    expect(urls).toEqual({ [KEY]: 'https://sb.example/read-1' });
    // TTL clamped to 7 days: max(60, min(7d, garbage-large))
    expect(methods.createSignedUrls).toHaveBeenCalledWith([KEY], 7 * DAY);
  });

  it('mintReadUrl clamps a tiny TTL up to 60s and answers {} when nothing is owned', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    methods.createSignedUrls.mockResolvedValue({ data: [], error: null });
    const { supabaseImageStore } = await freshSupabaseStore();
    await supabaseImageStore.mintReadUrl({ keys: [KEY], teacherId: TEACHER, expiresIn: 1 });
    expect(methods.createSignedUrls).toHaveBeenCalledWith([KEY], 60);

    const none = await supabaseImageStore.mintReadUrl({ keys: [OTHER_KEY], teacherId: TEACHER });
    expect(none).toEqual({});
    expect(methods.createSignedUrls).toHaveBeenCalledTimes(1); // not called for the empty case
  });

  it('mintReadUrlUnchecked mints without ownership checks but still validates key shape', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    methods.createSignedUrls.mockResolvedValue({
      data: [{ path: OTHER_KEY, signedUrl: 'https://sb.example/student-read' }],
      error: null,
    });
    const { supabaseImageStore } = await freshSupabaseStore();
    const urls = await supabaseImageStore.mintReadUrlUnchecked({
      keys: [OTHER_KEY, 'garbage'],
    });
    expect(urls).toEqual({ [OTHER_KEY]: 'https://sb.example/student-read' });
    expect(methods.createSignedUrls).toHaveBeenCalledWith([OTHER_KEY], 60 * 60);
  });

  it('deleteObject and putObject enforce ownership and propagate storage errors', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    methods.remove.mockResolvedValue({ data: null, error: { message: 'boom' } });
    methods.upload.mockResolvedValue({ data: null, error: null });
    const { supabaseImageStore } = await freshSupabaseStore();

    await expect(
      supabaseImageStore.deleteObject({ key: OTHER_KEY, teacherId: TEACHER }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      supabaseImageStore.deleteObject({ key: KEY, teacherId: TEACHER }),
    ).rejects.toMatchObject({ message: 'boom' });

    await expect(
      supabaseImageStore.putObject({ key: KEY, teacherId: OTHER, bytes: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
    const put = await supabaseImageStore.putObject({ key: KEY, teacherId: TEACHER, bytes: 'x' });
    expect(put).toEqual({ ok: true, key: KEY });
    expect(methods.upload).toHaveBeenCalledWith(KEY, 'x', {
      contentType: 'image/webp',
      upsert: false,
    });
  });

  it('listObjects requires prefix === teacherId, paginates, and caps at 2000 keys', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    const page = (n: number, start: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `obj-${start + i}.webp` }));
    methods.list
      .mockResolvedValueOnce({ data: page(1000, 0), error: null })
      .mockResolvedValueOnce({ data: page(1000, 1000), error: null })
      .mockResolvedValueOnce({ data: page(500, 2000), error: null });
    const { supabaseImageStore } = await freshSupabaseStore();

    const keys = await supabaseImageStore.listObjects({ prefix: TEACHER, teacherId: TEACHER });
    expect(keys).toHaveLength(2000); // hard cap: 1000 + 1000, third page never fetched
    expect(keys[0]).toBe(`${TEACHER}/obj-0.webp`);
    expect(methods.list).toHaveBeenLastCalledWith(TEACHER, { limit: 1000, offset: 1000 });
    expect(methods.list).toHaveBeenCalledTimes(2);

    await expect(
      supabaseImageStore.listObjects({ prefix: OTHER, teacherId: TEACHER }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('listObjects stops early on a short page and throws on storage errors', async () => {
    const methods = sbFromMethods();
    sbStorage.from.mockReturnValue(methods);
    methods.list
      .mockResolvedValueOnce({ data: [{ name: 'only.webp' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'list-fail' } });
    const { supabaseImageStore } = await freshSupabaseStore();
    expect(await supabaseImageStore.listObjects({ prefix: TEACHER, teacherId: TEACHER })).toEqual([
      `${TEACHER}/only.webp`,
    ]);
    await expect(
      supabaseImageStore.listObjects({ prefix: TEACHER, teacherId: TEACHER }),
    ).rejects.toMatchObject({ message: 'list-fail' });
  });
});

/* --------------------------------- s3 ---------------------------------- */

const s3Send = vi.hoisted(() => vi.fn());
const getSignedUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    config: unknown;
    send = s3Send;
    constructor(config: unknown) {
      this.config = config;
    }
  }
  const mk =
    (name: string) =>
    class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    };
  return {
    S3Client,
    PutObjectCommand: mk('PutObjectCommand'),
    GetObjectCommand: mk('GetObjectCommand'),
    DeleteObjectCommand: mk('DeleteObjectCommand'),
    ListObjectsV2Command: mk('ListObjectsV2Command'),
  };
});
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

const S3_ENV = {
  S3_ENDPOINT: 'https://s3.parspack.net/',
  S3_ACCESS_KEY: 'ak',
  S3_SECRET_KEY: 'sk',
  S3_BUCKET: 'azmoonsaz-images',
};

async function freshS3Store() {
  vi.resetModules();
  return import('../../api/_lib/s3Store.js');
}

beforeEach(() => {
  s3Send.mockReset();
  getSignedUrlMock.mockReset();
  getSignedUrlMock.mockResolvedValue('https://presigned.example/object');
  Object.entries(S3_ENV).forEach(([k, v]) => {
    process.env[k] = v;
  });
});
afterEach(() => {
  Object.keys(S3_ENV).forEach((k) => delete process.env[k]);
  vi.resetModules();
});

describe('s3ImageStore', () => {
  it('refuses to run without the full S3_* configuration (dormant by design)', async () => {
    delete process.env.S3_BUCKET;
    const { s3ImageStore } = await freshS3Store();
    await expect(
      s3ImageStore.mintUploadUrl({ key: KEY, teacherId: TEACHER }),
    ).rejects.toThrow(/image_store_not_configured/);
  });

  it('mintUploadUrl returns a raw presigned PUT (uploadToken null) for owned keys', async () => {
    const { s3ImageStore } = await freshS3Store();
    const out = await s3ImageStore.mintUploadUrl({ key: KEY, teacherId: TEACHER });
    expect(out).toEqual({
      uploadUrl: 'https://presigned.example/object',
      uploadToken: null,
      key: KEY,
      expiresIn: 900,
      contentType: 'image/webp',
    });
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [client, command, opts] = getSignedUrlMock.mock.calls[0];
    expect((command as { input: { Key: string; Bucket: string } }).input).toEqual({
      Bucket: 'azmoonsaz-images',
      Key: KEY,
      ContentType: 'image/webp',
    });
    expect(opts).toEqual({ expiresIn: 900 });
    expect((client as { config: { endpoint: string } }).config.endpoint).toBe(
      'https://s3.parspack.net',
    ); // trailing slash stripped
  });

  it('enforces teacher ownership before signing anything (400 / 403)', async () => {
    const { s3ImageStore } = await freshS3Store();
    await expect(
      s3ImageStore.mintUploadUrl({ key: 'garbage', teacherId: TEACHER }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      s3ImageStore.mintUploadUrl({ key: OTHER_KEY, teacherId: TEACHER }),
    ).rejects.toMatchObject({ status: 403 });
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it('mintReadUrl signs only owned keys; mintReadUrlUnchecked only shape-valid ones', async () => {
    const { s3ImageStore } = await freshS3Store();
    const urls = await s3ImageStore.mintReadUrl({
      keys: [KEY, OTHER_KEY, 'nope'],
      teacherId: TEACHER,
      expiresIn: 10,
    });
    expect(urls).toEqual({ [KEY]: 'https://presigned.example/object' });
    // TTL clamped up to the 60s floor
    expect(getSignedUrlMock.mock.calls[0][2]).toEqual({ expiresIn: 60 });

    const unchecked = await s3ImageStore.mintReadUrlUnchecked({ keys: [OTHER_KEY, 'nope'] });
    expect(unchecked).toEqual({ [OTHER_KEY]: 'https://presigned.example/object' });
  });

  it('listObjects paginates with continuation tokens and caps at 2000', async () => {
    s3Send
      .mockResolvedValueOnce({
        Contents: Array.from({ length: 1000 }, (_, i) => ({ Key: `${TEACHER}/k${i}.webp` })),
        IsTruncated: true,
        NextContinuationToken: 'tok-1',
      })
      .mockResolvedValueOnce({
        Contents: Array.from({ length: 1200 }, (_, i) => ({ Key: `${TEACHER}/m${i}.webp` })),
        IsTruncated: false,
      });
    const { s3ImageStore } = await freshS3Store();
    const keys = await s3ImageStore.listObjects({ prefix: TEACHER, teacherId: TEACHER });
    expect(keys).toHaveLength(2000); // 1000 + capped at 2000 mid-second-page
    const first = s3Send.mock.calls[0][0].input;
    expect(first.Prefix).toBe(`${TEACHER}/`);
    expect(first.MaxKeys).toBe(1000);
    expect(s3Send.mock.calls[1][0].input.ContinuationToken).toBe('tok-1');

    await expect(
      s3ImageStore.listObjects({ prefix: OTHER, teacherId: TEACHER }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('deleteObject and putObject route through the client with the right commands', async () => {
    s3Send.mockResolvedValue({});
    const { s3ImageStore } = await freshS3Store();
    await expect(
      s3ImageStore.deleteObject({ key: OTHER_KEY, teacherId: TEACHER }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await s3ImageStore.deleteObject({ key: KEY, teacherId: TEACHER })).toEqual({ ok: true });
    expect(s3Send.mock.calls[0][0].input).toEqual({
      Bucket: 'azmoonsaz-images',
      Key: KEY,
    });
    expect(await s3ImageStore.putObject({ key: KEY, teacherId: TEACHER, bytes: 'zz' })).toEqual({
      ok: true,
      key: KEY,
    });
    expect(s3Send.mock.calls[1][0].input).toEqual({
      Bucket: 'azmoonsaz-images',
      Key: KEY,
      Body: 'zz',
      ContentType: 'image/webp',
    });
  });
});
