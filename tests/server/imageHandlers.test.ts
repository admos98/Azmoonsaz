/**
 * Image pipeline handler coverage (no network, no database):
 *  - upload-url mints a teacher-scoped key and returns the Supabase token shape
 *  - read resolves owned keys, filters foreign/evil values, caps batch size
 *  - question delete removes orphaned objects but keeps shared ones; object
 *    failures never fail the delete
 *  - question create/update enforce the image gate at the handler boundary
 *  - student exam-payload substitutes signed URLs, never leaks keys, and
 *    strips keys (keeping legacy URLs) when minting fails
 *  - orphan cleanup deletes unreferenced objects, keeps referenced ones, and
 *    answers 429 when its strict budget is exhausted
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleTeacherImageUploadUrl,
  handleTeacherImageRead,
  handleTeacherImageCleanup,
  handleTeacherImageMigrate,
} from '../../api/routes/images.js';
import { handleTeacherQuestions } from '../../api/routes/teacher.js';
import { handleStudentExamPayload } from '../../api/routes/student.js';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { createStudentSessionToken } from '../../api/_lib/studentSession.js';
import { createAdmin, createReq, createRes } from './helpers.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({ requireTeacher: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: vi.fn() }));
// Redirect-chain tests stub outbound fetch; DNS resolves to a public IP by
// default (per-test overrides cover the rebinding guard). Real network and
// real DNS are never touched. vi.hoisted: the mock factory is hoisted above
// imports, so the shared spy must be created here to be visible inside it.
const { mockDnsLookup } = vi.hoisted(() => ({
  mockDnsLookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));
vi.mock('node:dns/promises', () => ({
  lookup: mockDnsLookup,
}));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER_B = '22222222-2222-4222-8222-222222222222';
const KEY_OWN = `${TEACHER_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
const KEY_OPT = `${TEACHER_ID}/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
const KEY_PART = `${TEACHER_ID}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp`;
const KEY_FOREIGN = `${TEACHER_B}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp`;
const LEGACY_URL = 'https://example.com/legacy.png';

const EXAM_ID = '33333333-3333-4333-8333-333333333333';
const STUDENT_ID = '44444444-4444-4333-8333-444444444444';
const SESSION_ID = '55555555-5555-4555-8555-555555555555';
const Q1 = '66666666-6666-4666-8666-666666666666';
const Q2 = '77777777-7777-4777-8777-777777777777';
const Q3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Q_DEL = '88888888-8888-4888-8888-888888888888';
const Q_OTHER = '99999999-9999-4999-8999-999999999999';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const minutesAhead = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const teacherWith = (admin: ReturnType<typeof createAdmin>) => {
  vi.mocked(requireTeacher).mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@test.dev',
    admin,
  } as unknown as Teacher);
};

const post = (url: string, body: Record<string, unknown>) =>
  createReq({ method: 'POST', url, body, headers: { authorization: 'Bearer t' } });

// Fake object store behind getSupabaseAdmin().storage — the real Supabase
// driver runs against it, so mint/upload/delete shapes are covered.
let removedKeys: string[] = [];
// Fake signatures must be opaque: real signed URLs are query strings that do
// NOT embed the key, and "never leak raw keys" is what the payload test asserts.
let signCounter = 0;
function fakeSign(keys: string[]) {
  return {
    data: keys.map((k) => ({ path: k, signedUrl: 'https://signed.test/img-' + signCounter++ })),
    error: null,
  };
}
let signedReadImpl: (keys: string[]) => { data?: unknown; error?: unknown } = fakeSign;
const storageApi = {
  from: () => ({
    createSignedUploadUrl: async () => ({
      data: { signedUrl: 'https://store.test/up?token=tok', token: 'tok' },
      error: null,
    }),
    createSignedUrls: async (keys: string[]) => signedReadImpl(keys),
    remove: async (keys: string[]) => {
      removedKeys.push(...keys);
      return { error: null };
    },
  }),
};

beforeEach(() => {
  vi.unstubAllGlobals();
  mockDnsLookup.mockReset();
  mockDnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
  delete process.env.IMAGE_STORE_PROVIDER;
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_SECRET_KEY;
  delete process.env.S3_BUCKET;
  removedKeys = [];
  signCounter = 0;
  signedReadImpl = fakeSign;
  vi.mocked(requireTeacher).mockReset();
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(getSupabaseAdmin).mockReset();
  vi.mocked(getSupabaseAdmin).mockReturnValue({ storage: storageApi } as never);
});

describe('POST /api/teacher/images/upload-url', () => {
  it('mints a teacher-scoped key with the Supabase token shape', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherImageUploadUrl(post('/api/teacher/images/upload-url', { contentType: 'image/webp' }), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(typeof body.key).toBe('string');
    expect(String(body.key).startsWith(`${TEACHER_ID}/`)).toBe(true);
    expect(String(body.key).endsWith('.webp')).toBe(true);
    expect(body.uploadToken).toBe('tok');
    expect(body.bucket).toBe('question-images');
    expect(typeof body.uploadUrl).toBe('string');
  });

  it('rejects unsupported content types before minting', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherImageUploadUrl(post('/api/teacher/images/upload-url', { contentType: 'image/bmp' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'unsupported_image_type' });
  });

  it('accepts gif — the downstream chain (decode/migrate/stores) supports it (L9)', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherImageUploadUrl(post('/api/teacher/images/upload-url', { contentType: 'image/gif' }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as Record<string, unknown>).ok).toBe(true);
  });

  it('returns 429 when the mint budget is exhausted', async () => {
    teacherWith(createAdmin({}));
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false } as never);
    const res = createRes();
    await handleTeacherImageUploadUrl(post('/api/teacher/images/upload-url', {}), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'too_many_requests' });
  });
});

describe('POST /api/teacher/images/read', () => {
  it('resolves owned keys and filters foreign, evil, and duplicate values', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherImageRead(
      post('/api/teacher/images/read', { keys: [KEY_OWN, KEY_OWN, KEY_FOREIGN, 'https://evil/x', ''] }),
      res,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { ok: boolean; urls: Record<string, string> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.urls)).toEqual([KEY_OWN]);
    expect(String(body.urls[KEY_OWN])).toMatch(/^https:\/\/signed\.test\/img-\d+$/);
  });

  it('answers empty urls without touching the store', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherImageRead(post('/api/teacher/images/read', { keys: [] }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, urls: {} });
  });
});

describe('question delete image cascade', () => {
  function deleteAdmin(doomedBody: unknown, siblingBodies: unknown[]) {
    return createAdmin({
      questions: {
        onResult: (ctx) => {
          if (ctx.op === 'delete') return { data: [], error: null };
          if (ctx.op === 'select') {
            if (typeof ctx.filters.id === 'string') return { data: { id: Q_DEL, body: doomedBody }, error: null };
            return {
              data: siblingBodies.map((body, i) => ({ id: `${Q_OTHER}-${i}`, body })),
              error: null,
            };
          }
          return undefined;
        },
      },
    });
  }

  it('deletes orphaned objects and keeps keys still used by siblings', async () => {
    teacherWith(
      deleteAdmin(
        { text: 't', imageUrl: KEY_OWN, options: [{ id: 'o1', imageUrl: KEY_OPT }] },
        [{ text: 's', options: [{ id: 'o1', imageUrl: KEY_OPT }] }],
      ),
    );
    const res = createRes();
    await handleTeacherQuestions(post('/api/teacher/questions', { action: 'delete', id: Q_DEL }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(removedKeys).toEqual([KEY_OWN]);
  });

  it('skips the store entirely when the question has no storage keys', async () => {
    teacherWith(deleteAdmin({ text: 't', imageUrl: LEGACY_URL }, []));
    const res = createRes();
    await handleTeacherQuestions(post('/api/teacher/questions', { action: 'delete', id: Q_DEL }), res);
    expect(res.statusCode).toBe(200);
    expect(removedKeys).toEqual([]);
  });

  it('still returns ok when object deletion fails', async () => {
    teacherWith(deleteAdmin({ text: 't', imageUrl: KEY_OWN }, []));
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      storage: {
        from: () => ({
          remove: async () => {
            throw new Error('store down');
          },
        }),
      },
    } as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = createRes();
      await handleTeacherQuestions(post('/api/teacher/questions', { action: 'delete', id: Q_DEL }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(err).toHaveBeenCalled();
    } finally {
      err.mockRestore();
    }
  });
});

describe('question create/update image gate', () => {
  const baseQuestion = {
    type: 'single_choice',
    grade: 'هفتم',
    category: 'ریاضی',
    text: 'متن سوال',
    points: 2,
    options: [{ id: 'o1', text: 'الف', isCorrect: true }],
  };

  it('create rejects fresh base64 without touching the database', async () => {
    const admin = createAdmin({});
    teacherWith(admin);
    const res = createRes();
    await handleTeacherQuestions(
      post('/api/teacher/questions', {
        action: 'create',
        question: { ...baseQuestion, imageUrl: 'data:image/png;base64,AAA' },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'image_must_be_uploaded' });
    expect(admin.calls).toEqual([]);
  });

  it('create persists storage keys', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherQuestions(
      post('/api/teacher/questions', {
        action: 'create',
        question: { ...baseQuestion, imageUrl: KEY_OWN },
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { question: { imageUrl: string } }).question.imageUrl).toBe(KEY_OWN);
  });

  it('update grandfathers byte-identical legacy values, rejects changed ones', async () => {
    const admin = createAdmin({
      questions: { single: { id: Q1, body: { imageUrl: LEGACY_URL, options: [] } } },
    });
    teacherWith(admin);
    const kept = createRes();
    await handleTeacherQuestions(
      post('/api/teacher/questions', {
        action: 'update',
        question: { ...baseQuestion, id: Q1, imageUrl: LEGACY_URL },
      }),
      kept,
    );
    expect(kept.statusCode).toBe(200);
    expect((kept.body as { question: { imageUrl: string } }).question.imageUrl).toBe(LEGACY_URL);

    const changed = createRes();
    await handleTeacherQuestions(
      post('/api/teacher/questions', {
        action: 'update',
        question: { ...baseQuestion, id: Q1, imageUrl: 'https://example.com/changed.png' },
      }),
      changed,
    );
    expect(changed.statusCode).toBe(400);
    expect(changed.body).toEqual({ error: 'image_must_be_uploaded' });
  });
});

describe('POST /api/teacher/images/cleanup', () => {
  const KEY_ORPHAN = `${TEACHER_ID}/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.webp`;
  const storedKeys = [KEY_OWN, KEY_OPT, KEY_ORPHAN];

  function cleanupApi() {
    return {
      from: (table: string) => {
        if (table === 'questions') {
          return {
            select: () => ({
              eq: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      { body: { text: 'q1', imageUrl: KEY_OWN } },
                      { body: { text: 'q2', options: [{ id: 'o1', imageUrl: KEY_OPT }] } },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) };
      },
      storage: {
        from: () => ({
          list: async () => ({ data: storedKeys.map((full) => ({ name: full.split('/')[1] })), error: null }),
          remove: async (keys: string[]) => {
            removedKeys.push(...keys);
            return { error: null };
          },
        }),
      },
    };
  }

  it('deletes only unreferenced objects and reports scanned/deleted', async () => {
    teacherWith(cleanupApi() as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(cleanupApi() as never);
    const res = createRes();
    await handleTeacherImageCleanup(post('/api/teacher/images/cleanup', {}), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, deleted: [KEY_ORPHAN], failed: [], scanned: 3 });
    expect(removedKeys).toEqual([KEY_ORPHAN]);
  });

  it('returns 429 when the strict cleanup budget is exhausted', async () => {
    teacherWith(createAdmin({}));
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false } as never);
    const res = createRes();
    await handleTeacherImageCleanup(post('/api/teacher/images/cleanup', {}), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'too_many_requests' });
  });
});

describe('POST /api/teacher/images/migrate', () => {
  const DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Redirect-chain fixtures: canned fetch responses for the manual-hop tests.
  const imgBytes = () => ({
    status: 200,
    ok: true,
    headers: {
      get: (name: string) => (String(name).toLowerCase() === 'content-type' ? 'image/png' : null),
    },
    arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  });
  const redirectTo = (location: string) => ({
    status: 302,
    ok: false,
    headers: {
      get: (name: string) => (String(name).toLowerCase() === 'location' ? location : null),
    },
    arrayBuffer: async () => new ArrayBuffer(0),
  });

  function migrateApi(rows: unknown[]) {
    const updates: { id: string; body: unknown }[] = [];
    const api = {
      updates,
      from: (table: string) => {
        if (table === 'questions') {
          const chain: Record<string, unknown> = {};
          chain.select = () => chain;
          chain.eq = () => chain;
          chain.limit = () => Promise.resolve({ data: rows, error: null });
          chain.update = (payload: { body: unknown }) => ({
            eq: (col: string, val: string) => ({
              eq: () => {
                updates.push({ id: val, body: (payload as { body: unknown }).body });
                return Promise.resolve({ data: null, error: null });
              },
            }),
          });
          return chain;
        }
        return {};
      },
      storage: {
        from: () => ({
          upload: async (key: string) => {
            (api as { uploaded?: string[] }).uploaded = [
              ...((api as { uploaded?: string[] }).uploaded || []),
              key,
            ];
            return { error: null };
          },
        }),
      },
    };
    return api;
  }

  it('migrates base64 rows to teacher-scoped keys and rewrites bodies', async () => {
    const api = migrateApi([
      { id: 'q1', body: { text: 't', imageUrl: DATA_URL, options: [{ id: 'o1', imageUrl: DATA_URL }] } },
      { id: 'q2', body: { text: 'clean' } },
    ]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      ok: boolean;
      migrated: { questionId: string; path: string; key: string }[];
      skipped: unknown[];
    };
    expect(body.ok).toBe(true);
    expect(body.migrated).toHaveLength(2);
    expect(body.skipped).toEqual([]);
    for (const m of body.migrated) {
      expect(m.questionId).toBe('q1');
      expect(m.key.startsWith(`${TEACHER_ID}/`)).toBe(true);
      expect(m.key.endsWith('.webp')).toBe(true);
    }
    // Body rewritten to keys, not base64.
    expect(api.updates).toHaveLength(1);
    expect(JSON.stringify(api.updates[0].body)).not.toContain('data:image');
  });

  it('skips unfetchable values with reasons and migrates siblings', async () => {
    const api = migrateApi([
      {
        id: 'q1',
        body: {
          text: 't',
          imageUrl: 'https://169.254.169.254/latest/meta-data/',
          options: [{ id: 'o1', imageUrl: DATA_URL }],
        },
      },
    ]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      migrated: { questionId: string; path: string }[];
      skipped: { questionId: string; path: string; reason: string }[];
    };
    expect(body.migrated).toHaveLength(1);
    expect(body.migrated[0].path).toBe('options.0.imageUrl');
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0].reason).toBe('unfetchable_or_too_large');
  });

  it('follows a public redirect hop with redirect:manual and migrates the bytes', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: unknown) =>
      String(url).endsWith('/start.png') ? redirectTo('https://cdn.test/final.png') : imgBytes(),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: 'https://cdn.test/start.png' } }]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { migrated: { key: string }[]; skipped: unknown[] };
    expect(body.skipped).toEqual([]);
    expect(body.migrated).toHaveLength(1);
    expect(body.migrated[0].key.startsWith(`${TEACHER_ID}/`)).toBe(true);
    // Every hop goes out with manual redirect — the client never auto-chases.
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ redirect: 'manual' });
    }
  });

  it('rejects a redirect hop to an internal address without fetching it', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith('/start.png') ? redirectTo('https://169.254.169.254/x.png') : imgBytes(),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: 'https://cdn.test/start.png' } }]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { migrated: unknown[]; skipped: { reason: string }[] };
    expect(body.migrated).toEqual([]);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0].reason).toBe('unfetchable_or_too_large');
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain('169.254.169.254');
    }
  });

  it('stops after the redirect hop cap instead of looping forever', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => redirectTo(`https://cdn.test/hop-${n++}.png`));
    vi.stubGlobal('fetch', fetchMock);
    const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: 'https://cdn.test/start.png' } }]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    const body = res.body as { migrated: unknown[]; skipped: { reason: string }[] };
    expect(body.migrated).toEqual([]);
    expect(body.skipped).toHaveLength(1);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('rejects a host that resolves to a private IP (DNS-rebinding guard)', async () => {
    mockDnsLookup.mockResolvedValueOnce([{ address: '10.9.9.9', family: 4 }]);
    const fetchMock = vi.fn(async () => imgBytes());
    vi.stubGlobal('fetch', fetchMock);
    const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: 'https://cdn.test/start.png' } }]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    const body = res.body as { migrated: unknown[]; skipped: { reason: string }[] };
    expect(body.migrated).toEqual([]);
    expect(body.skipped).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Broadened denylist (SSRF defense in depth): the whole 169.254.0.0/16
  // link-local block — not just the .169.254 metadata address — plus CGNAT,
  // the documentation/benchmarking blocks, multicast/reserved space, and the
  // IPv4-in-IPv6 and exotic-IPv4 spellings that reach the same addresses.
  const BLOCKED_URLS: [string, string][] = [
    ['link-local outside the metadata address', 'https://169.254.1.1/x.png'],
    ['link-local high end of the /16', 'https://169.254.255.254/x.png'],
    ['cloud metadata (unchanged)', 'https://169.254.169.254/latest/meta-data/'],
    ['CGNAT 100.64.0.0/10', 'https://100.64.0.1/x.png'],
    ['CGNAT high end', 'https://100.127.255.254/x.png'],
    ['benchmarking 198.18.0.0/15', 'https://198.18.0.1/x.png'],
    ['IETF 192.0.0.0/24', 'https://192.0.0.1/x.png'],
    ['documentation 192.0.2.0/24', 'https://192.0.2.5/x.png'],
    ['documentation 198.51.100.0/24', 'https://198.51.100.7/x.png'],
    ['documentation 203.0.113.0/24', 'https://203.0.113.9/x.png'],
    ['multicast 224.0.0.0/4', 'https://224.0.0.1/x.png'],
    ['reserved 240.0.0.0/4', 'https://240.0.0.1/x.png'],
    ['broadcast 255.255.255.255', 'https://255.255.255.255/x.png'],
    ['decimal-encoded loopback', 'https://2130706433/x.png'],
    ['hex-encoded loopback', 'https://0x7f000001/x.png'],
    ['octal-encoded loopback', 'https://0177.0.0.1/x.png'],
    ['short-form loopback', 'https://127.1/x.png'],
    ['IPv4-mapped IPv6 metadata', 'https://[::ffff:169.254.169.254]/x.png'],
    ['IPv4-mapped IPv6 CGNAT', 'https://[::ffff:100.64.0.1]/x.png'],
    ['IPv6 link-local fe80::/10', 'https://[fe80::1]/x.png'],
    ['IPv6 unique-local fc00::/7', 'https://[fd00::1]/x.png'],
    ['IPv6 unspecified ::', 'https://[::]/x.png'],
    ['IPv6 multicast ff00::/8', 'https://[ff02::1]/x.png'],
    ['IPv6 documentation 2001:db8::/32', 'https://[2001:db8::1]/x.png'],
    ['IPv6 NAT64 64:ff9b::/96', 'https://[64:ff9b::7f00:1]/x.png'],
  ];

  for (const [label, url] of BLOCKED_URLS) {
    it(`rejects ${label} (${url})`, async () => {
      const fetchMock = vi.fn(async () => imgBytes());
      vi.stubGlobal('fetch', fetchMock);
      const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: url } }]);
      teacherWith(api as never);
      vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
      const res = createRes();
      await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
      expect(res.statusCode).toBe(200);
      const body = res.body as { migrated: unknown[]; skipped: { reason: string }[] };
      expect(body.migrated).toEqual([]);
      expect(body.skipped).toHaveLength(1);
      expect(body.skipped[0].reason).toBe('unfetchable_or_too_large');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it('rejects a host resolving to link-local / CGNAT / mapped-private space', async () => {
    for (const address of ['169.254.1.1', '100.64.0.1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', 'fe80::1']) {
      mockDnsLookup.mockResolvedValueOnce([{ address, family: address.includes(':') ? 6 : 4 }]);
      const fetchMock = vi.fn(async () => imgBytes());
      vi.stubGlobal('fetch', fetchMock);
      const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: 'https://cdn.test/start.png' } }]);
      teacherWith(api as never);
      vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
      const res = createRes();
      await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
      const body = res.body as { migrated: unknown[] };
      expect(body.migrated, `resolved ${address} must be rejected`).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('still migrates a genuinely public host (denylist does not over-block)', async () => {
    mockDnsLookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    const fetchMock = vi.fn(async () => imgBytes());
    vi.stubGlobal('fetch', fetchMock);
    const api = migrateApi([{ id: 'q1', body: { text: 't', imageUrl: 'https://cdn.test/ok.png' } }]);
    teacherWith(api as never);
    vi.mocked(getSupabaseAdmin).mockReturnValue(api as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    const body = res.body as { migrated: unknown[]; skipped: unknown[] };
    expect(body.skipped).toEqual([]);
    expect(body.migrated).toHaveLength(1);
  });

  it('returns 429 when the strict migrate budget is exhausted', async () => {
    teacherWith(createAdmin({}));
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false } as never);
    const res = createRes();
    await handleTeacherImageMigrate(post('/api/teacher/images/migrate', {}), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'too_many_requests' });
  });
});

describe('student exam-payload image substitution', () => {
  const examRow = {
    id: EXAM_ID,
    exam_code: 'TEST1',
    teacher_id: TEACHER_ID,
    status: 'active',
    mode: 'official',
    starts_at: minutesAgo(60),
    ends_at: minutesAhead(60),
    duration_minutes: 60,
  };
  const sessionRow = {
    id: SESSION_ID,
    exam_id: EXAM_ID,
    student_id: STUDENT_ID,
    status: 'ongoing',
    started_at: minutesAgo(10),
    submitted_at: null,
    exam: examRow,
  };
  const token = () =>
    createStudentSessionToken({ type: 'student_exam', sid: SESSION_ID, eid: EXAM_ID, stid: STUDENT_ID }, 7200);

  function payloadAdmin() {
    const admin = createAdmin({
      student_exam_sessions: { single: sessionRow },
      exams: { single: examRow },
      students: { single: { id: STUDENT_ID, full_name: 'دانش‌آموز نمونه', grade: 'هفتم' } },
      exam_questions: {
        rows: [
          { question_id: Q1, section_title: '', position: 0, points: 2 },
          { question_id: Q2, section_title: '', position: 1, points: 2 },
          { question_id: Q3, section_title: '', position: 2, points: 1 },
        ],
      },
      questions: {
        rows: [
          {
            id: Q1,
            type: 'single_choice',
            grade: 'هفتم',
            subject: 'ریاضی',
            title: 'سوال ۱',
            body: {
              text: 'متن',
              imageUrl: KEY_OWN,
              options: [{ id: 'A', text: 'الف', imageUrl: KEY_OPT }],
              parts: [{ id: 'p1', text: 'مینی', type: 'single_choice', imageUrl: KEY_PART, options: [] }],
            },
            points: 2,
          },
          {
            id: Q2,
            type: 'single_choice',
            grade: 'هفتم',
            subject: 'ریاضی',
            title: 'سوال ۲',
            body: { text: 'متن', imageUrl: LEGACY_URL, options: [{ id: 'A', text: 'الف' }] },
            points: 2,
          },
          {
            id: Q3,
            type: 'short_answer',
            grade: 'هفتم',
            subject: 'ریاضی',
            title: 'سوال ۳',
            // Grandfathered cross-tenant row: another teacher's key predating
            // the write-time ownership check. The payload must never mint it.
            body: { text: 'متن خارجی', imageUrl: KEY_FOREIGN },
            points: 1,
          },
        ],
      },
      student_answers: { rows: [] },
    });
    return { ...admin, storage: storageApi };
  }

  const payloadReq = () =>
    createReq({
      method: 'POST',
      url: '/api/student/exam-payload',
      body: {},
      headers: { authorization: 'Bearer ' + token() },
    });

  it('swaps every key for a signed URL and never leaks raw keys', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(payloadAdmin() as never);
    const res = createRes();
    await handleStudentExamPayload(payloadReq(), res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      ok: boolean;
      questions: Array<{ id: string; body: Record<string, never> }>;
    };
    expect(body.ok).toBe(true);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(KEY_OWN);
    expect(raw).not.toContain(KEY_OPT);
    expect(raw).not.toContain(KEY_PART);
    const q1 = body.questions.find((q) => q.id === Q1);
    const q1json = JSON.stringify(q1);
    expect((q1json.match(/https:\/\/signed\.test\/img-\d+/g) || []).length).toBe(3);
    expect(q1json).not.toContain(LEGACY_URL);
    // Legacy rows keep rendering untouched.
    const q2 = body.questions.find((q) => q.id === Q2);
    expect(JSON.stringify(q2)).toContain(LEGACY_URL);
  });

  it('strips keys but keeps legacy URLs when minting fails', async () => {
    signedReadImpl = () => {
      throw new Error('store down');
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(payloadAdmin() as never);
    const res = createRes();
    await handleStudentExamPayload(payloadReq(), res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      questions: Array<{ id: string; body: Record<string, unknown> }>;
    };
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(KEY_OWN);
    expect(raw).not.toContain(KEY_OPT);
    expect(raw).not.toContain(KEY_PART);
    expect(raw).toContain(LEGACY_URL);
  });

  it('never mints foreign-tenant keys and strips them from the paper', async () => {
    let minted: string[] = [];
    signedReadImpl = (keys: string[]) => {
      minted = keys;
      return fakeSign(keys);
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(payloadAdmin() as never);
    const res = createRes();
    await handleStudentExamPayload(payloadReq(), res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      ok: boolean;
      questions: Array<{ id: string; body: Record<string, unknown> }>;
    };
    expect(body.ok).toBe(true);
    // The foreign key never reaches the store — no cross-tenant signed URL.
    expect(minted).not.toContain(KEY_FOREIGN);
    expect(minted).toEqual(expect.arrayContaining([KEY_OWN, KEY_OPT, KEY_PART]));
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(KEY_FOREIGN);
    expect(raw).not.toContain(TEACHER_B);
    const q3 = body.questions.find((q) => q.id === Q3);
    expect(q3?.body.imageUrl).toBeUndefined();
  });
});
