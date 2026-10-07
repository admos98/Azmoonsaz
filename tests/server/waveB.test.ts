/**
 * Wave B — exam hardening:
 *  - gradeAnswerValue: deterministic verdicts against the stored key
 *  - server auto-grade pass at submit (teacher grade always wins)
 *  - exam-payload rate limit (anti paper-scrape loop)
 *  - proctor counter ingestion (whitelisted, max-merged, PII-free)
 *  - invalidation policy: warning first, blocked on the second strike
 *  - Turnstile join check (opt-in via TURNSTILE_SECRET_KEY, fail-closed)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleStudentExamPayload,
  handleStudentSaveAnswer,
  handleStudentStartSession,
  handleStudentSubmit,
} from '../../api/routes/student.js';
import { handleTeacherSubmissions } from '../../api/routes/teacher.js';
import { gradeAnswerValue } from '../../api/_lib/examSecurity.js';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { createStudentSessionToken } from '../../api/_lib/studentSession.js';
import { createAdmin, createReq, createRes } from './helpers.js';

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../../api/_lib/teacherAuth.js', () => ({ requireTeacher: vi.fn() }));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const EXAM_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';
const Q1 = '55555555-5555-4555-8555-555555555555';
const Q2 = '66666666-6666-4666-8666-666666666666';

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();
const minutesAhead = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

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
  proctor_flags: {},
  exam: examRow,
};

function studentToken() {
  return createStudentSessionToken(
    { type: 'student_exam', sid: SESSION_ID, eid: EXAM_ID, stid: STUDENT_ID },
    7200,
  );
}

const bearerReq = (url: string, body: Record<string, unknown>) =>
  createReq({
    method: 'POST',
    url,
    body,
    headers: { authorization: 'Bearer ' + studentToken() },
  });

beforeEach(() => {
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(getSupabaseAdmin).mockReset();
  vi.mocked(requireTeacher).mockReset();
  delete process.env.TURNSTILE_SECRET_KEY;
});

afterEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY;
  vi.unstubAllGlobals();
});

describe('gradeAnswerValue (auto-grade verdicts)', () => {
  it('grades an MCQ against the correct-id list', () => {
    expect(gradeAnswerValue({ correctAnswer: ['A', 'B'] }, 'B')).toEqual({ correct: true });
    expect(gradeAnswerValue({ correctAnswer: ['A', 'B'] }, 'C')).toEqual({ correct: false });
    expect(gradeAnswerValue({ correctAnswer: ['A', 'B'] }, undefined)).toEqual({
      correct: false,
    });
  });

  it('grades a string key with trimmed equality', () => {
    expect(gradeAnswerValue({ correctAnswer: 'تهران' }, ' تهران ')).toEqual({
      correct: true,
    });
    expect(gradeAnswerValue({ correctAnswer: 'تهران' }, 'اصفهان')).toEqual({
      correct: false,
    });
  });

  it('refuses to guess on subjective questions (no usable key)', () => {
    expect(gradeAnswerValue({}, 'anything')).toBeNull();
    expect(gradeAnswerValue({ correctAnswer: [] }, 'x')).toBeNull();
    expect(gradeAnswerValue(null, 'x')).toBeNull();
    expect(gradeAnswerValue({ correctAnswer: 42 }, 'x')).toBeNull();
  });
});

describe('submit auto-grades server-side (Wave B)', () => {
  it('writes __grading for machine-gradable answers and spares teacher grades', async () => {
    const answerUpdates: Array<Record<string, unknown>> = [];
    const sessionUpdates: Array<Record<string, unknown>> = [];
    const admin = createAdmin({
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'select') return { data: sessionRow, error: null };
          if (ctx.op === 'update') {
            sessionUpdates.push(ctx.payload);
            return { data: ctx.payload, error: null };
          }
          return undefined;
        },
      },
      exam_questions: {
        rows: [
          { question_id: Q1, points: 4 },
          { question_id: Q2, points: 2 },
        ],
      },
      questions: {
        rows: [
          { id: Q1, points: 4, answer_key: { correctAnswer: ['A', 'B'] } },
          { id: Q2, points: 2, answer_key: {} }, // subjective — no key
        ],
      },
      student_answers: {
        onResult: (ctx) => {
          if (ctx.op === 'select') {
            return {
              data: [
                { id: 'a1', question_id: Q1, answer: { value: 'A' } },
                { id: 'a2', question_id: Q1, answer: { value: 'Z' } },
                { id: 'a3', question_id: Q2, answer: { value: 'essay text' } },
                {
                  id: 'a4',
                  question_id: Q1,
                  answer: {
                    value: 'B',
                    __grading: {
                      scoreGained: 3,
                      isCorrect: true,
                      gradedBy: TEACHER_ID,
                    },
                  },
                },
              ],
              error: null,
            };
          }
          if (ctx.op === 'update') {
            answerUpdates.push(ctx.payload);
            return { data: ctx.payload, error: null };
          }
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const res = createRes();
    await handleStudentSubmit(bearerReq('/api/student/submit', {}), res);

    expect(res.statusCode).toBe(200);
    // exactly two auto-grades: correct MCQ (full points) and wrong MCQ (0);
    // the subjective question and the teacher-graded row are untouched.
    expect(answerUpdates).toHaveLength(2);
    const gradingOf = (update: Record<string, unknown>) =>
      (update.answer as { __grading: Record<string, unknown> }).__grading;
    const first = gradingOf(answerUpdates[0]);
    const second = gradingOf(answerUpdates[1]);
    expect(first.scoreGained).toBe(4);
    expect(first.isCorrect).toBe(true);
    expect(first.gradedBy).toBe('auto');
    expect(second.scoreGained).toBe(0);
    expect(second.isCorrect).toBe(false);
    expect(second.gradedBy).toBe('auto');
    // status flip happened
    expect(
      sessionUpdates.some((update) => update.status === 'submitted'),
    ).toBe(true);
  });
});

describe('exam-payload rate limit (Wave B)', () => {
  it('returns 429 when the per-session budget is exhausted', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false } as never);
    const res = createRes();
    await handleStudentExamPayload(bearerReq('/api/student/exam-payload', {}), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'too_many_requests' });
  });
});

describe('proctor counter ingestion (Wave B)', () => {
  it('whitelists keys, bounds values and max-merges with existing flags', async () => {
    const sessionUpdates: Array<Record<string, unknown>> = [];
    const admin = createAdmin({
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'select')
            return {
              data: { ...sessionRow, proctor_flags: { tabHidden: 3 } },
              error: null,
            };
          if (ctx.op === 'update') {
            sessionUpdates.push(ctx.payload);
            return { data: ctx.payload, error: null };
          }
          return undefined;
        },
      },
      exam_questions: { single: { question_id: Q1 } },
      student_answers: { onResult: () => ({ data: { ok: true }, error: null }) },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);

    const res = createRes();
    await handleStudentSaveAnswer(
      bearerReq('/api/student/save-answer', {
        questionId: Q1,
        answer: { value: 'A' },
        proctor: {
          tabHidden: 5,
          copyAttempt: 2,
          windowBlur: -4, // dropped: not positive
          contextMenu: 1.7, // floored to 1
          bogus: 9, // dropped: not whitelisted
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(sessionUpdates).toHaveLength(1);
    expect(sessionUpdates[0].proctor_flags).toEqual({
      tabHidden: 5, // max(3 existing, 5 incoming)
      copyAttempt: 2,
      contextMenu: 1,
    });
  });
});

describe('invalidation: warning first, then blocked (Wave B)', () => {
  const teacherAdmin = (sessionState: Record<string, unknown>, owned = true) => {
    const sessionUpdates: Array<Record<string, unknown>> = [];
    const deletions: string[] = [];
    const admin = createAdmin({
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'select') return { data: sessionState, error: null };
          if (ctx.op === 'update') {
            sessionUpdates.push(ctx.payload);
            return { data: ctx.payload, error: null };
          }
          return undefined;
        },
      },
      exams: { onResult: () => ({ data: owned ? { id: EXAM_ID } : null, error: null }) },
      student_answers: {
        onResult: (ctx) => {
          if (ctx.op === 'delete') deletions.push(String(ctx.filters.session_id));
          return { data: [], error: null };
        },
      },
    });
    vi.mocked(requireTeacher).mockResolvedValue({
      id: TEACHER_ID,
      email: 'teacher@test.dev',
      admin,
    } as unknown as Teacher);
    return { admin, sessionUpdates, deletions };
  };

  const post = (sessionId: string) =>
    createReq({
      method: 'POST',
      url: '/api/teacher/submissions',
      body: { sessionId },
      headers: { authorization: 'Bearer t' },
    });

  it('first strike: wipes answers, restarts the session, records the warning', async () => {
    const { sessionUpdates, deletions } = teacherAdmin({
      id: SESSION_ID,
      exam_id: EXAM_ID,
      status: 'submitted',
      warning_count: 0,
      attempt_count: 1,
    });
    const res = createRes();
    await handleTeacherSubmissions(post(SESSION_ID), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, action: 'warned', warningCount: 1 });
    expect(deletions).toEqual([SESSION_ID]);
    expect(sessionUpdates).toHaveLength(1);
    expect(sessionUpdates[0]).toMatchObject({
      status: 'ongoing',
      warning_count: 1,
      attempt_count: 2,
      submitted_at: null,
    });
    expect(typeof sessionUpdates[0].started_at).toBe('string');
  });

  it('second strike: permanent block on that exam', async () => {
    const { sessionUpdates, deletions } = teacherAdmin({
      id: SESSION_ID,
      exam_id: EXAM_ID,
      status: 'ongoing',
      warning_count: 1,
      attempt_count: 2,
    });
    const res = createRes();
    await handleTeacherSubmissions(post(SESSION_ID), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, action: 'blocked', warningCount: 1 });
    expect(deletions).toEqual([]); // no reset on the blocking strike
    expect(sessionUpdates).toEqual([{ status: 'invalidated' }]);
  });

  it('refuses sessions the teacher does not own', async () => {
    teacherAdmin(
      { id: SESSION_ID, exam_id: EXAM_ID, status: 'submitted', warning_count: 0 },
      false,
    );
    const res = createRes();
    await handleTeacherSubmissions(post(SESSION_ID), res);
    expect(res.statusCode).toBe(403);
  });

  it('refuses to double-block an already invalidated session', async () => {
    teacherAdmin({
      id: SESSION_ID,
      exam_id: EXAM_ID,
      status: 'invalidated',
      warning_count: 1,
    });
    const res = createRes();
    await handleTeacherSubmissions(post(SESSION_ID), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'already_invalidated' });
  });
});

describe('start-session: blocked + Turnstile (Wave B)', () => {
  const joinReq = (body: Record<string, unknown> = {}) =>
    createReq({
      method: 'POST',
      url: '/api/student/start-session',
      body: { examCode: 'TEST1', nationalId: '0000000019', ...body },
    });

  const fullTables = (sessionState: Record<string, unknown>) => ({
    exams: { single: examRow },
    students: {
      single: {
        id: STUDENT_ID,
        full_name: 'دانش‌آموز تست',
        grade: '10',
        class_group_id: 'c1',
        status: 'active',
      },
    },
    exam_allowed_classes: { rows: [] },
    student_exam_sessions: { single: sessionState },
  });

  it('answers exam_invalidated after valid credentials (second-strike block)', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createAdmin(
        fullTables({
          id: SESSION_ID,
          status: 'invalidated',
          started_at: minutesAgo(30),
          submitted_at: null,
        }),
      ) as never,
    );
    const res = createRes();
    await handleStudentStartSession(joinReq(), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'exam_invalidated' });
  });

  it('fails closed with no token when TURNSTILE_SECRET_KEY is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.mocked(getSupabaseAdmin).mockReturnValue(createAdmin({}) as never);
    const res = createRes();
    await handleStudentStartSession(joinReq(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'turnstile_invalid' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a token Cloudflare refuses', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }),
    );
    vi.mocked(getSupabaseAdmin).mockReturnValue(createAdmin({}) as never);
    const res = createRes();
    await handleStudentStartSession(joinReq({ turnstileToken: 'bad' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'turnstile_invalid' });
  });

  it('passes a valid token through to the join flow', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }),
    );
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createAdmin(
        fullTables({
          id: SESSION_ID,
          status: 'invalidated',
          started_at: minutesAgo(30),
          submitted_at: null,
        }),
      ) as never,
    );
    const res = createRes();
    await handleStudentStartSession(joinReq({ turnstileToken: 'good' }), res);
    // turnstile passed → flow continued → blocked later by the invalidation
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'exam_invalidated' });
  });

  it('stays a no-op without TURNSTILE_SECRET_KEY (feature off)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      createAdmin(
        fullTables({
          id: SESSION_ID,
          status: 'invalidated',
          started_at: minutesAgo(30),
          submitted_at: null,
        }),
      ) as never,
    );
    const res = createRes();
    await handleStudentStartSession(joinReq(), res);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'exam_invalidated' });
  });
});

describe('GET submissions exposes proctor bookkeeping (Wave C)', () => {
  it('maps proctor_flags / warning_count / attempt_count per submission', async () => {
    const admin = createAdmin({
      exams: { rows: [examRow] },
      student_exam_sessions: {
        rows: [
          {
            id: SESSION_ID,
            exam_id: EXAM_ID,
            student_id: STUDENT_ID,
            status: 'submitted',
            started_at: minutesAgo(50),
            submitted_at: minutesAgo(5),
            proctor_flags: { tabHidden: 2, copyAttempt: 1 },
            warning_count: 1,
            attempt_count: 2,
          },
        ],
      },
      students: {
        rows: [
          { id: STUDENT_ID, full_name: 'دانش‌آموز تست', national_id_last4: '1234' },
        ],
      },
      student_answers: { rows: [] },
      exam_questions: { rows: [{ exam_id: EXAM_ID, points: 10 }] },
    });
    vi.mocked(requireTeacher).mockResolvedValue({
      id: TEACHER_ID,
      email: 'teacher@test.dev',
      admin,
    } as unknown as Teacher);

    const res = createRes();
    await handleTeacherSubmissions(
      createReq({ method: 'GET', url: '/api/teacher/submissions' }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { submissions: Array<Record<string, unknown>> };
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0]).toMatchObject({
      proctorFlags: { tabHidden: 2, copyAttempt: 1 },
      warningCount: 1,
      attemptCount: 2,
      maskedNationalId: '***1234',
    });
  });
});
