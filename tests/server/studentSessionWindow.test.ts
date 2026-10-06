/**
 * Wave 1 — F-01: a student can never forge grading state through save-answer
 * (only `{ value }` survives; `__grading` is stripped).
 * Wave 1 — F-02: the personal window is anchored to `started_at` — re-joining
 * never resets the clock, and expired windows are enforced + frozen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleStudentSaveAnswer,
  handleStudentSubmit,
  handleStudentStartSession,
} from '../../api/routes/student.js';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { createStudentSessionToken } from '../../api/_lib/studentSession.js';
import {
  sanitizeStudentAnswer,
  getSessionTimeWindow,
  getExamAvailabilityWithGrace,
} from '../../api/_lib/examSecurity.js';
import { tokenTtlForSession } from '../../api/_lib/utils.js';
import { createAdmin, createReq, createRes } from './helpers.js';

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));

const EXAM_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const minutesAhead = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const examRow = {
  id: EXAM_ID,
  exam_code: 'TEST1',
  teacher_id: '11111111-1111-4111-8111-111111111111',
  status: 'active',
  mode: 'official',
  starts_at: minutesAgo(60),
  ends_at: minutesAhead(60),
  duration_minutes: 60,
};

const sessionRow = (startedAt: string, status = 'ongoing') => ({
  id: SESSION_ID,
  exam_id: EXAM_ID,
  student_id: STUDENT_ID,
  status,
  started_at: startedAt,
  submitted_at: null,
  exam: examRow,
});

function makeToken() {
  return createStudentSessionToken(
    { type: 'student_exam', sid: SESSION_ID, eid: EXAM_ID, stid: STUDENT_ID },
    7200,
  );
}

const bearerReq = (url: string, body: Record<string, unknown>) =>
  createReq({ method: 'POST', url, body, headers: { authorization: 'Bearer ' + makeToken() } });

beforeEach(() => {
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({
    ok: true,
    limit: 15,
    remaining: 14,
    resetAt: Date.now() + 60_000,
  } as never);
  vi.mocked(getSupabaseAdmin).mockReset();
});

describe('sanitizeStudentAnswer (F-01)', () => {
  it('keeps only the student-writable value — __grading is stripped', () => {
    expect(sanitizeStudentAnswer({ value: 'B', __grading: { scoreGained: 999 } })).toEqual({
      value: 'B',
    });
  });

  it('drops answers that carry grading state but no value', () => {
    expect(sanitizeStudentAnswer({ __grading: { scoreGained: 999, isCorrect: true } })).toEqual({});
  });

  it('drops non-object / object-valued answers', () => {
    expect(sanitizeStudentAnswer(null)).toEqual({});
    expect(sanitizeStudentAnswer('B')).toEqual({});
    expect(sanitizeStudentAnswer({ value: { nested: true } })).toEqual({});
  });

  it('keeps bounded arrays (ordering/matching style values)', () => {
    expect(sanitizeStudentAnswer({ value: ['a', 2, 'b'] })).toEqual({ value: ['a', 2, 'b'] });
    expect(sanitizeStudentAnswer({ value: Array(500).fill('x') })).toEqual({
      value: Array(200).fill('x'),
    });
  });
});

describe('window helpers (F-02)', () => {
  it('session deadline = started_at + duration + grace', () => {
    const session = { started_at: minutesAgo(50) };
    const ttl = tokenTtlForSession(examRow, session);
    // deadline = started 50m ago + 60m duration + 5m grace => ~15m left.
    expect(ttl).toBeGreaterThan(840);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('rejects sessions past their window with 410', () => {
    expect(getSessionTimeWindow({ started_at: minutesAgo(120) }, examRow)).toEqual({
      ok: false,
      status: 410,
      error: 'exam_time_expired',
    });
    expect(getSessionTimeWindow({ started_at: minutesAgo(10) }, examRow).ok).toBe(true);
    expect(getSessionTimeWindow({}, examRow).status).toBe(422);
  });

  it('grace applies only to clock-based end — teacher intent stays strict', () => {
    // Window closed 2 minutes ago (stored active): grace allows save/flush.
    expect(getExamAvailabilityWithGrace({ ...examRow, ends_at: minutesAgo(2) }).ok).toBe(true);
    // Window closed 10 minutes ago: past grace.
    expect(getExamAvailabilityWithGrace({ ...examRow, ends_at: minutesAgo(10) }).error).toBe(
      'exam_closed',
    );
    // Teacher explicitly closed it: no grace regardless of clock.
    expect(
      getExamAvailabilityWithGrace({ ...examRow, status: 'completed', ends_at: minutesAhead(60) })
        .error,
    ).toBe('exam_closed');
    // Not open yet: no grace.
    expect(
      getExamAvailabilityWithGrace({
        ...examRow,
        starts_at: minutesAhead(30),
        ends_at: minutesAhead(90),
      }).error,
    ).toBe('exam_not_open');
  });
});

describe('POST /api/student/save-answer', () => {
  const saveReq = (answer: unknown) =>
    bearerReq('/api/student/save-answer', { questionId: 'q1', answer });

  function makeAdmin(startedAt: string) {
    const upserts: Record<string, unknown>[] = [];
    const admin = createAdmin({
      student_exam_sessions: { single: sessionRow(startedAt) },
      exam_questions: { single: { question_id: 'q1' } },
      student_answers: {
        onResult: (ctx) => {
          if (ctx.op === 'upsert') upserts.push(ctx.payload!);
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    return { admin, upserts };
  }

  it('stores only { value } — a forged score never reaches the row', async () => {
    const { upserts } = makeAdmin(minutesAgo(10));
    const res = createRes();
    await handleStudentSaveAnswer(
      saveReq({ value: 'B', __grading: { scoreGained: 999, isCorrect: true } }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].answer).toEqual({ value: 'B' });
  });

  it('stores {} when the payload has no student value', async () => {
    const { upserts } = makeAdmin(minutesAgo(10));
    const res = createRes();
    await handleStudentSaveAnswer(
      saveReq({ __grading: { scoreGained: 999 } }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(upserts[0].answer).toEqual({});
  });

  it('rejects saves past the personal window (started_at + duration + grace)', async () => {
    const { admin, upserts } = makeAdmin(minutesAgo(120));
    const res = createRes();
    await handleStudentSaveAnswer(saveReq({ value: 'B' }) as never, res as never);
    expect(res.statusCode).toBe(410);
    expect((res.body as { error: string }).error).toBe('exam_time_expired');
    expect(upserts).toHaveLength(0);
    expect(admin.calls).not.toContain('student_answers');
  });
});

describe('POST /api/student/submit', () => {
  function makeAdmin(startedAt: string) {
    const updates: Record<string, unknown>[] = [];
    const admin = createAdmin({
      student_exam_sessions: {
        single: sessionRow(startedAt),
        onResult: (ctx) => {
          if (ctx.op === 'update') updates.push(ctx.payload!);
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    return { admin, updates };
  }

  it('submits within the window', async () => {
    const { updates } = makeAdmin(minutesAgo(10));
    const res = createRes();
    await handleStudentSubmit(bearerReq('/api/student/submit', {}) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(updates[0].status).toBe('submitted');
  });

  it('rejects submission past the window', async () => {
    const { admin, updates } = makeAdmin(minutesAgo(120));
    const res = createRes();
    await handleStudentSubmit(bearerReq('/api/student/submit', {}) as never, res as never);
    expect(res.statusCode).toBe(410);
    expect((res.body as { error: string }).error).toBe('exam_time_expired');
    expect(updates).toHaveLength(0);
    expect(admin.calls.filter((t) => t === 'student_exam_sessions')).toHaveLength(1);
  });
});

describe('POST /api/student/start-session (F-02: clock never resets)', () => {
  function makeAdmin(existing: ReturnType<typeof sessionRow>) {
    const updates: Record<string, unknown>[] = [];
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        single: {
          id: STUDENT_ID,
          full_name: 'دانش‌آموز',
          grade: 'هفتم',
          class_group_id: null,
          status: 'active',
        },
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: {
        single: existing,
        onResult: (ctx) => {
          if (ctx.op === 'update') updates.push(ctx.payload!);
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    return { admin, updates };
  }

  const startReq = () =>
    createReq({
      method: 'POST',
      url: '/api/student/start-session',
      body: { examCode: 'TEST1', nationalId: '0000000019' },
    });

  it('issues a token anchored to the original started_at (no fresh TTL)', async () => {
    makeAdmin(sessionRow(minutesAgo(50)));
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(200);
    const { token } = res.body as { token: string };
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    // started 50m ago, 60m duration, 5m grace => ~15m left, never a full 65m TTL.
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000) + 840);
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 900);
  });

  it('freezes an out-of-window session and refuses to mint a token', async () => {
    const { updates } = makeAdmin(sessionRow(minutesAgo(120)));
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(410);
    expect((res.body as { error: string }).error).toBe('exam_time_expired');
    expect((res.body as { token?: string }).token).toBeUndefined();
    expect(updates).toEqual([{ status: 'expired' }]);
  });

  it('reports already-frozen sessions as time-expired', async () => {
    makeAdmin(sessionRow(minutesAgo(120), 'expired'));
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(409);
    expect((res.body as { error: string }).error).toBe('exam_time_expired');
  });
});

describe('POST /api/student/start-session (F-12/F-14: uniform failures, teacher scoping)', () => {
  const startReq = () =>
    createReq({
      method: 'POST',
      url: '/api/student/start-session',
      body: { examCode: 'TEST1', nationalId: '0000000019' },
    });

  it('an unknown exam code answers exactly like wrong credentials', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(createAdmin({ exams: { single: null } }) as never);
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toBe('invalid_credentials');
  });

  it('student lookup is scoped by the exam teacher (F-14)', async () => {
    const studentFilters: Record<string, unknown>[] = [];
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        onResult: (ctx) => {
          studentFilters.push({ ...ctx.filters });
          return {
            data: {
              id: STUDENT_ID,
              full_name: 'دانش‌آموز',
              grade: 'هفتم',
              class_group_id: null,
              status: 'active',
            },
            error: null,
          };
        },
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: { single: sessionRow(minutesAgo(5)) },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(studentFilters).toHaveLength(1);
    expect(studentFilters[0].teacher_id).toBe(examRow.teacher_id);
    expect(typeof studentFilters[0].national_id_hash).toBe('string');
  });

  it('not-on-the-class-list fails identically to every other credential failure', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createAdmin({
        exams: { single: examRow },
        students: {
          single: {
            id: STUDENT_ID,
            full_name: 'دانش‌آموز',
            grade: 'هفتم',
            class_group_id: 'group-A',
            status: 'active',
          },
        },
        exam_allowed_classes: { rows: [{ class_group_id: 'group-B' }] },
        student_exam_sessions: { single: null },
      }) as never,
    );
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toBe('invalid_credentials');
  });

  it('rejects non-minted code shapes before any lookup (F-11)', async () => {
    const admin = createAdmin({ exams: { single: examRow } });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(
      createReq({
        method: 'POST',
        url: '/api/student/start-session',
        body: { examCode: 'A_B-C-1234567890', nationalId: '0000000019' },
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid_exam_code');
    expect(admin.calls).toHaveLength(0); // rejected before any table access
  });
});
