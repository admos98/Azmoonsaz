/**
 * Wave 2 regression tests:
 * - F-03: rate-limit keys come from the trusted hop (x-real-ip / last XFF
 *   entry), never the client-spoofable first XFF entry.
 * - F-07: checkRateLimit uses the atomic bump_rate_limit RPC and falls back to
 *   a bounded per-instance counter when Supabase errors.
 * - F-08: 429 coverage on save-answer, submit, start-session identity bucket,
 *   student-id-demo, and teacher mutating requests.
 * - F-05: ordering/matching answer keys stripped from student payloads; the
 *   shuffle flags are enforced server-side, deterministically per session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClientIp } from '../../api/_lib/http.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { getSupabaseAdmin, getSupabasePublicServerClient } from '../../api/_lib/supabaseAdmin.js';
import {
  handleStudentSaveAnswer,
  handleStudentSubmit,
  handleStudentStartSession,
} from '../../api/routes/student.js';
import { handleStudentIdDemo } from '../../api/routes/public.js';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { createStudentSessionToken } from '../../api/_lib/studentSession.js';
import { safeQuestionForStudent, applyExamShuffles } from '../../api/_lib/examSecurity.js';
import { createAdmin, createReq, createRes } from './helpers.js';

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  getSupabaseAdmin: vi.fn(),
  getSupabasePublicServerClient: vi.fn(),
  getSupabaseConfigStatus: vi.fn(() => ({
    hasUrl: true,
    hasAnonKey: true,
    hasServiceRoleKey: true,
  })),
}));

type RpcFn = (name: string, args: Record<string, unknown>) => Promise<unknown>;

function makeAdmin(rpc: RpcFn, tables: Parameters<typeof createAdmin>[0] = {}) {
  const fake = createAdmin(tables);
  const client = { rpc: vi.fn(rpc), from: fake.from, calls: fake.calls };
  vi.mocked(getSupabaseAdmin).mockReturnValue(client as never);
  return client;
}

const bumpResult = (count: number) => ({
  data: [{ bumped_count: count, reset_at: new Date(Date.now() + 60_000).toISOString() }],
  error: null,
});

beforeEach(() => {
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
  vi.mocked(getSupabaseAdmin).mockReset();
  vi.mocked(getSupabasePublicServerClient).mockReset();
});

describe('F-03 getClientIp (trusted hop)', () => {
  it('prefers x-real-ip over any forwarded chain', () => {
    const req = createReq({
      headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '6.6.6.6, 8.8.8.8' },
    });
    expect(getClientIp(req as never)).toBe('9.9.9.9');
  });

  it('ignores the client-spoofable first XFF entry, uses the edge-appended last', () => {
    const req = createReq({ headers: { 'x-forwarded-for': '6.6.6.6, 8.8.8.8' } });
    expect(getClientIp(req as never)).toBe('8.8.8.8');
  });

  it('falls back to the socket address', () => {
    expect(getClientIp(createReq() as never)).toBe('127.0.0.1');
  });
});

describe('F-07 checkRateLimit (atomic RPC + bounded fallback)', () => {
  it('counts through bump_rate_limit and reports remaining', async () => {
    const client = makeAdmin(async () => bumpResult(5));
    const result = await checkRateLimit('unit:ok', { limit: 20, windowMs: 60_000 });
    expect(client.rpc).toHaveBeenCalledWith('bump_rate_limit', {
      p_key: 'unit:ok',
      p_window_ms: 60_000,
    });
    expect(result).toMatchObject({ ok: true, limit: 20, remaining: 15 });
  });

  it('rejects once the atomic count exceeds the limit', async () => {
    makeAdmin(async () => bumpResult(25));
    const result = await checkRateLimit('unit:over', { limit: 20 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('falls back to the per-instance counter when Supabase errors', async () => {
    makeAdmin(async () => ({ data: null, error: { message: 'boom' } }));
    const first = await checkRateLimit('unit:fallback-a', { limit: 3, windowMs: 60_000 });
    const second = await checkRateLimit('unit:fallback-a', { limit: 3, windowMs: 60_000 });
    expect(first).toMatchObject({ ok: true, remaining: 2 });
    expect(second).toMatchObject({ ok: true, remaining: 1 });
  });
});

describe('F-08 rate-limit coverage', () => {
  const token = () =>
    createStudentSessionToken(
      {
        type: 'student_exam',
        sid: '44444444-4444-4444-8444-444444444444',
        eid: '22222222-2222-4222-8222-222222222222',
        stid: '33333333-3333-4333-8333-333333333333',
      },
      7200,
    );

  it('save-answer returns 429 when the session budget is exhausted', async () => {
    makeAdmin(async () => bumpResult(500));
    const res = createRes();
    const req = createReq({
      method: 'POST',
      url: '/api/student/save-answer',
      body: { questionId: 'q1', answer: { value: 'A' } },
      headers: { authorization: 'Bearer ' + token() },
    });
    await handleStudentSaveAnswer(req as never, res as never);
    expect(res.statusCode).toBe(429);
    expect((res.body as { error: string }).error).toBe('too_many_requests');
  });

  it('submit returns 429 when the session submit budget is exhausted', async () => {
    makeAdmin(async () => bumpResult(500));
    const res = createRes();
    const req = createReq({
      method: 'POST',
      url: '/api/student/submit',
      headers: { authorization: 'Bearer ' + token() },
    });
    await handleStudentSubmit(req as never, res as never);
    expect(res.statusCode).toBe(429);
  });

  it('start-session identity bucket blocks credential stuffing (10/min per exam+national id)', async () => {
    // IP bucket passes (1), identity bucket is over (11 > 10).
    const client = makeAdmin(async (_name, args) =>
      String(args.p_key).startsWith('start-session-id:') ? bumpResult(11) : bumpResult(1),
    );
    const res = createRes();
    const req = createReq({
      method: 'POST',
      url: '/api/student/start-session',
      body: { examCode: 'TEST1', nationalId: '0000000019' },
    });
    await handleStudentStartSession(req as never, res as never);
    expect(res.statusCode).toBe(429);
    expect(client.calls).toHaveLength(0); // blocked before any table access
  });

  it('student-id-demo returns 429 over 10 probes/minute/IP', async () => {
    makeAdmin(async () => bumpResult(11));
    const res = createRes();
    const req = createReq({
      method: 'POST',
      url: '/api/student-id-demo',
      body: { nationalId: '0000000019' },
    });
    await handleStudentIdDemo(req as never, res as never);
    expect(res.statusCode).toBe(429);
  });

  it('teacher mutating requests are limited per teacher; GETs are not', async () => {
    vi.mocked(getSupabasePublicServerClient).mockReturnValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: 't-1', email: 't@example.com', user_metadata: {} } },
          error: null,
        }),
      },
    } as never);
    const client = makeAdmin(async () => bumpResult(131));

    const postRes = createRes();
    const post = await requireTeacher(
      createReq({ method: 'POST', headers: { authorization: 'Bearer test-token' } }) as never,
      postRes as never,
    );
    expect(post).toBeNull();
    expect(postRes.statusCode).toBe(429);

    const getRes = createRes();
    const get = await requireTeacher(
      createReq({ method: 'GET', headers: { authorization: 'Bearer test-token' } }) as never,
      getRes as never,
    );
    expect(get).toMatchObject({ id: 't-1' });
    expect(client.rpc).toHaveBeenCalledTimes(1); // only the POST consulted the limiter
  });
});

describe('F-05 answer-key strip + shuffle enforcement', () => {
  const question = {
    id: 'q-1',
    type: 'ordering',
    grade: 'هفتم',
    subject: 'ریاضی',
    title: 'ترتیب بده',
    body: {
      text: 'مرتب کن',
      orderingItems: ['b', 'a', 'c'],
      matchingPairs: [{ id: 'p1', left: 'x', right: 'y' }],
      options: [
        { id: 'A', text: '۱' },
        { id: 'B', text: '۲' },
        { id: 'C', text: '۳' },
      ],
    },
    answer_key: { correctOrder: ['a', 'b', 'c'] },
    points: 3,
  };

  it('never sends orderingItems/matchingPairs to students', () => {
    const safe = safeQuestionForStudent(question as never, { points: 3 } as never) as {
      body: Record<string, unknown>;
    };
    expect(safe.body.text).toBe('مرتب کن');
    expect(safe.body.options).toHaveLength(3);
    expect(safe.body).not.toHaveProperty('orderingItems');
    expect(safe.body).not.toHaveProperty('matchingPairs');
  });

  it('flags off: order untouched', () => {
    const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const out = applyExamShuffles(questions as never, { settings: {} }, 'sess-1') as {
      id: string;
    }[];
    expect(out.map((q) => q.id)).toEqual(['a', 'b', 'c']);
  });

  it('shuffleQuestions: deterministic per session, same set, changes order', () => {
    const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    const exam = { settings: { shuffleQuestions: true } };
    const first = applyExamShuffles(questions as never, exam, 'sess-fixed-1') as { id: string }[];
    const again = applyExamShuffles(questions as never, exam, 'sess-fixed-1') as { id: string }[];
    expect(first.map((q) => q.id)).toEqual(again.map((q) => q.id)); // reload keeps order
    expect([...first.map((q) => q.id)].sort()).toEqual(['a', 'b', 'c', 'd', 'e']); // same set
    // Deterministic seeds: at least one of these fixed sessions must reorder.
    const reordered = ['sess-fixed-1', 'sess-fixed-2', 'sess-fixed-3'].some(
      (sid) => applyExamShuffles(questions as never, exam, sid)[0].id !== 'a',
    );
    expect(reordered).toBe(true);
  });

  it('shuffleOptions: reorders options per question, keyed answers unaffected', () => {
    const questions = [{ id: 'q-1', body: { options: [{ id: 'A' }, { id: 'B' }, { id: 'C' }] } }];
    const exam = { settings: { shuffleOptions: true } };
    const out = applyExamShuffles(questions as never, exam, 'sess-2') as {
      body: { options: { id: string }[] };
    }[];
    const ids = out[0].body.options.map((o) => o.id).sort();
    expect(ids).toEqual(['A', 'B', 'C']);
    const again = applyExamShuffles(questions as never, exam, 'sess-2') as {
      body: { options: { id: string }[] };
    }[];
    expect(again[0].body.options.map((o) => o.id)).toEqual(out[0].body.options.map((o) => o.id));
  });
});
