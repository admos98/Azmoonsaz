/**
 * Wave 1 — F-01: a student can never forge grading state through save-answer
 * (only `{ value }` survives; `__grading` is stripped).
 * Wave 1 — F-02: the personal window is anchored to `started_at` — re-joining
 * never resets the clock, and expired windows are enforced + frozen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleStudentExamPayload,
  handleStudentSaveAnswer,
  handleStudentSubmit,
  handleStudentStartSession,
} from '../../api/routes/student.js';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { createStudentSessionToken } from '../../api/_lib/studentSession.js';
import {
  sanitizeStudentAnswer,
  extractSavedAnswerValue,
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

describe('extractSavedAnswerValue (refresh recovery: value-only, no grading)', () => {
  it('returns the raw value and never grading state', () => {
    expect(extractSavedAnswerValue({ value: 'B' })).toBe('B');
    expect(
      extractSavedAnswerValue({
        value: 'B',
        __grading: { scoreGained: 4, isCorrect: true, gradedBy: 'auto' },
      }),
    ).toBe('B');
    expect(extractSavedAnswerValue({ value: true })).toBe(true);
    expect(extractSavedAnswerValue({ value: 3 })).toBe(3);
    expect(extractSavedAnswerValue({ value: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('returns undefined when there is nothing to restore', () => {
    expect(extractSavedAnswerValue(null)).toBeUndefined();
    expect(extractSavedAnswerValue('B')).toBeUndefined();
    expect(extractSavedAnswerValue({})).toBeUndefined();
    expect(extractSavedAnswerValue({ __grading: { scoreGained: 4 } })).toBeUndefined();
    expect(extractSavedAnswerValue({ value: '' })).toBeUndefined();
    expect(extractSavedAnswerValue({ value: { nested: true } })).toBeUndefined();
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

  it('answer writes use a strict deadline — grace is submit-only', () => {
    const inGrace = { started_at: minutesAgo(62) }; // 2m past duration, inside 5m grace
    expect(getSessionTimeWindow(inGrace, examRow).ok).toBe(true); // submit path keeps grace
    expect(getSessionTimeWindow(inGrace, examRow, new Date(), { grace: false })).toEqual({
      ok: false,
      status: 410,
      error: 'exam_time_expired',
    });
  });

  it('grace applies only to clock-based end — teacher intent stays strict', () => {
    // Window closed 2 minutes ago (stored active): grace allows submit.
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

  it('rejects saves 2 minutes past the deadline even though submit grace is open', async () => {
    // 60m duration, started 62m ago: inside the 5m submit grace, but answer
    // writes must stop exactly at the deadline.
    const { upserts } = makeAdmin(minutesAgo(62));
    const res = createRes();
    await handleStudentSaveAnswer(saveReq({ value: 'B' }) as never, res as never);
    expect(res.statusCode).toBe(410);
    expect((res.body as { error: string }).error).toBe('exam_time_expired');
    expect(upserts).toHaveLength(0);
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

  it('still accepts the final submit 2 minutes past the deadline (submit-only grace)', async () => {
    const { updates } = makeAdmin(minutesAgo(62));
    const res = createRes();
    await handleStudentSubmit(bearerReq('/api/student/submit', {}) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(
      updates.some((u) => (u as { status?: string }).status === 'submitted'),
    ).toBe(true);
  });
});

describe('GET exam paper after refresh (exam-payload restores saved answers)', () => {
  const Q1 = '55555555-5555-4555-8555-555555555555';
  const Q2 = '66666666-6666-4666-8666-666666666666';

  function makePayloadAdmin() {
    const admin = createAdmin({
      student_exam_sessions: { single: sessionRow(minutesAgo(10)) },
      exams: { single: examRow },
      students: {
        single: { id: STUDENT_ID, full_name: 'دانش‌آموز نمونه', grade: 'هفتم' },
      },
      exam_questions: {
        rows: [
          { question_id: Q1, section_title: '', position: 0, points: 2 },
          { question_id: Q2, section_title: '', position: 1, points: 2 },
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
            body: { text: 'متن', options: [{ id: 'A', text: 'الف' }] },
            points: 2,
          },
          {
            id: Q2,
            type: 'single_choice',
            grade: 'هفتم',
            subject: 'ریاضی',
            title: 'سوال ۲',
            body: { text: 'متن', options: [{ id: 'A', text: 'الف' }] },
            points: 2,
          },
        ],
      },
      student_answers: {
        rows: [
          {
            question_id: Q1,
            answer: {
              value: 'A',
              __grading: { scoreGained: 2, isCorrect: true, gradedBy: 'auto' },
            },
          },
          { question_id: Q2, answer: {} }, // blank stays blank
        ],
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
  }

  it('returns value-only savedAnswers keyed by question id', async () => {
    makePayloadAdmin();
    const res = createRes();
    await handleStudentExamPayload(
      bearerReq('/api/student/exam-payload', {}) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      ok: boolean;
      questions: Array<{ id: string }>;
      student: { id: string; name: string; grade: string } | null;
      savedAnswers: Record<string, unknown>;
    };
    expect(body.ok).toBe(true);
    // Display name echo for refresh recovery (name only, no identity material).
    expect(body.student).toEqual({ id: STUDENT_ID, name: 'دانش‌آموز نمونه', grade: 'هفتم' });
    expect(body.questions.map((q) => q.id).sort()).toEqual([Q1, Q2].sort());
    // Q1 restores the raw value only — no grading keys leak through.
    expect(body.savedAnswers[Q1]).toBe('A');
    expect(JSON.stringify(body)).not.toContain('__grading');
    // Q2 was blank — no restore key at all.
    expect(Q2 in body.savedAnswers).toBe(false);
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
