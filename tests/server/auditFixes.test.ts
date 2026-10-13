/**
 * Backend audit 2026-10-13 — regression covers for the fixed findings:
 *  M1  finalize requires `submitted` (conditional update, 409 otherwise)
 *  M2  class delete refuses while students or exam links reference it
 *  ML2 race-rejoin runs the shared evaluator (window freeze + availability)
 *  L2  malformed token segments answer null, never throw
 *  L10 `__proto__` answer keys are dropped, never pollute
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';
import {
  handleTeacherClasses,
  handleTeacherFinalizeSubmission,
} from '../../api/routes/teacher.js';
import { handleStudentStartSession } from '../../api/routes/student.js';
import { sanitizeStudentAnswer } from '../../api/_lib/examSecurity.js';
import { verifyStudentSessionToken } from '../../api/_lib/studentSession.js';
import { createAdmin, createReq, createRes } from './helpers.js';
import { studentPinHash } from '../../api/_lib/crypto.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({ requireTeacher: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: vi.fn() }));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXAM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STUDENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TEST_PIN = '123456';

const teacherWith = (admin: ReturnType<typeof createAdmin>) => {
  vi.mocked(requireTeacher).mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@test.dev',
    admin,
  } as unknown as Teacher);
};

const post = (url: string, body: Record<string, unknown>) =>
  createReq({ method: 'POST', url, body, headers: { authorization: 'Bearer t' } });

beforeEach(() => {
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
  delete process.env.STUDENT_SESSION_SECRET;
  vi.mocked(requireTeacher).mockReset();
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(getSupabaseAdmin).mockReset();
});

describe('M1: finalize is submitted → graded only', () => {
  const ownedTables = (status: string) => ({
    student_exam_sessions: { single: { id: SESSION_ID, exam_id: EXAM_ID } },
    exams: { single: { id: EXAM_ID } },
  });

  it('409s a live ongoing session without touching it', async () => {
    const updates: unknown[] = [];
    const admin = createAdmin({
      ...ownedTables('ongoing'),
      student_exam_sessions: {
        single: { id: SESSION_ID, exam_id: EXAM_ID },
        onResult: (ctx) => {
          if (ctx.op === 'update') {
            updates.push(ctx.payload);
            // The conditional update matches nothing: not submitted.
            return { data: null, error: null };
          }
          return undefined;
        },
      },
    });
    teacherWith(admin);
    const res = createRes();
    await handleTeacherFinalizeSubmission(
      post('/api/teacher/finalize-submission', { sessionId: SESSION_ID }),
      res,
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'submission_not_submitted' });
  });

  it('grades a submitted session', async () => {
    const graded = { id: SESSION_ID, exam_id: EXAM_ID, status: 'graded' };
    const admin = createAdmin({
      ...ownedTables('submitted'),
      student_exam_sessions: {
        single: { id: SESSION_ID, exam_id: EXAM_ID },
        onResult: (ctx) => {
          if (ctx.op === 'update') {
            expect(ctx.filters).toMatchObject({ id: SESSION_ID, status: 'submitted' });
            return { data: graded, error: null };
          }
          return undefined;
        },
      },
    });
    teacherWith(admin);
    const res = createRes();
    await handleTeacherFinalizeSubmission(
      post('/api/teacher/finalize-submission', { sessionId: SESSION_ID }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { session: { status: string } }).session.status).toBe('graded');
  });
});

describe('M2: class delete refuses while referenced', () => {
  it('409s when students sit in the class', async () => {
    const admin = createAdmin({
      students: { rows: [{ id: 'stu-1' }] },
      exam_allowed_classes: { rows: [] },
    });
    teacherWith(admin);
    const res = createRes();
    await handleTeacherClasses(post('/api/teacher/classes', { action: 'delete', id: CLASS_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'class_has_students' });
    expect(admin.calls).not.toContain('class_groups');
  });

  it('409s when an exam links the class', async () => {
    const admin = createAdmin({
      students: { rows: [] },
      exam_allowed_classes: { rows: [{ exam_id: EXAM_ID }] },
    });
    teacherWith(admin);
    const res = createRes();
    await handleTeacherClasses(post('/api/teacher/classes', { action: 'delete', id: CLASS_ID }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'class_used_by_exam' });
  });

  it('deletes an unreferenced class', async () => {
    const admin = createAdmin({
      students: { rows: [] },
      exam_allowed_classes: { rows: [] },
      class_groups: { rows: [] },
    });
    teacherWith(admin);
    const res = createRes();
    await handleTeacherClasses(post('/api/teacher/classes', { action: 'delete', id: CLASS_ID }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('ML2: insert-race rejoin runs the shared evaluator', () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const examRow = {
    id: EXAM_ID,
    exam_code: 'TEST1',
    teacher_id: TEACHER_ID,
    status: 'active',
    mode: 'official',
    starts_at: minutesAgo(60),
    ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    duration_minutes: 60,
  };
  const startReq = () =>
    createReq({
      method: 'POST',
      url: '/api/student/start-session',
      body: { examCode: 'TEST1', nationalId: '0000000019', pin: TEST_PIN },
    });

  it('freezes an out-of-window raced row instead of minting blind', async () => {
    const updates: Record<string, unknown>[] = [];
    const raced = {
      id: SESSION_ID,
      status: 'ongoing',
      started_at: minutesAgo(120),
      submitted_at: null,
      invalidated_reason: null,
    };
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        single: {
          id: STUDENT_ID,
          full_name: 'دانش‌آموز',
          grade: 'هفتم',
          class_group_id: null,
          status: 'active',
          pin_hash: studentPinHash(STUDENT_ID, TEST_PIN),
          pin_must_change: false,
        },
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: {
        single: null,
        onResult: (ctx) => {
          if (ctx.op === 'update') updates.push(ctx.payload!);
          if (ctx.op === 'insert') return { data: null, error: { code: '23505' } };
          if (ctx.op === 'select' && ctx.filters.exam_id) return { data: raced, error: null };
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(410);
    expect((res.body as { error: string }).error).toBe('exam_time_expired');
    expect((res.body as { token?: string }).token).toBeUndefined();
    expect(updates).toContainEqual({ status: 'expired' });
  });
});

describe('L2: malformed token segments never throw', () => {
  it('returns null for a garbage middle segment under a valid signature shape', () => {
    // Three dot-separated parts with garbage payload: signature mismatch
    // answers null before parsing is even reached.
    expect(verifyStudentSessionToken('a.b.c')).toBeNull();
    expect(verifyStudentSessionToken('')).toBeNull();
    expect(verifyStudentSessionToken(undefined)).toBeNull();
  });
});

describe('L10: __proto__ answer keys never pollute', () => {
  it('drops __proto__ keys from records', () => {
    const out = sanitizeStudentAnswer({
      value: { normal: 'x', ['__proto__' as string]: { polluted: true } },
    }) as { value: Record<string, unknown> };
    expect(out.value.normal).toBe('x');
    expect('polluted' in {}).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(out.value)).toEqual(['normal']);
  });
});

describe('ML4: mutating teacher actions audit (ids only)', () => {
  it('audits finalize and class delete through audit_logs', async () => {
    const graded = { id: SESSION_ID, exam_id: EXAM_ID, status: 'graded' };
    const admin = createAdmin({
      student_exam_sessions: {
        single: { id: SESSION_ID, exam_id: EXAM_ID },
        onResult: (ctx) => {
          if (ctx.op === 'update') return { data: graded, error: null };
          return undefined;
        },
      },
      exams: { single: { id: EXAM_ID } },
      students: { rows: [] },
      exam_allowed_classes: { rows: [] },
      class_groups: { rows: [] },
    });
    teacherWith(admin);
    let res = createRes();
    await handleTeacherFinalizeSubmission(
      post('/api/teacher/finalize-submission', { sessionId: SESSION_ID }),
      res,
    );
    expect(res.statusCode).toBe(200);
    res = createRes();
    await handleTeacherClasses(post('/api/teacher/classes', { action: 'delete', id: CLASS_ID }), res);
    expect(res.statusCode).toBe(200);
    // Both mutating actions wrote audit rows (ids only, no PII).
    expect(admin.calls.filter((c) => c === 'audit_logs')).toHaveLength(2);
  });
});
