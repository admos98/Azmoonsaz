/**
 * T7 — student 6-digit exam PIN:
 *  - crypto: Persian/Arabic digit normalization, 6-digit validation,
 *    HMAC hashing (domain-separated from the national-ID hash).
 *  - start-session: first login asks for setup (pinSetupRequired), setup
 *    claims via compare-and-set, later logins verify (constant-time),
 *    every failure answers invalid_credentials (F-12 no-oracle rule).
 *  - teacher reset-pin: clears the hash, flags must-change; the teacher
 *    never sees or sets the PIN.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStudentStartSession } from '../../api/routes/student.js';
import { handleTeacherStudents } from '../../api/routes/teacher.js';
import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import {
  normalizeStudentPin,
  validateStudentPin,
  studentPinHash,
  nationalIdHash,
} from '../../api/_lib/crypto.js';
import { createAdmin, createReq, createRes } from './helpers.js';

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../../api/_lib/teacherAuth.js', () => ({ requireTeacher: vi.fn() }));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const EXAM_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';
const TEST_PIN = '123456';

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

beforeEach(() => {
  process.env.STUDENT_ID_PEPPER = 'test-pepper-'.padEnd(64, '0');
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(getSupabaseAdmin).mockReset();
  vi.mocked(requireTeacher).mockReset();
});

describe('student PIN crypto', () => {
  it('normalizes Persian and Arabic digits to ASCII', () => {
    expect(normalizeStudentPin('۱۲۳۴۵۶')).toBe('123456');
    expect(normalizeStudentPin('١٢٣٤٥٦')).toBe('123456');
    expect(normalizeStudentPin(' 123-456 ')).toBe('123456');
  });

  it('accepts exactly 6 digits', () => {
    expect(validateStudentPin('123456')).toBe(true);
    expect(validateStudentPin('۱۲۳۴۵۶')).toBe(true);
    expect(validateStudentPin('12345')).toBe(false);
    expect(validateStudentPin('1234567')).toBe(false);
    expect(validateStudentPin('abcdef')).toBe(false);
    expect(validateStudentPin('')).toBe(false);
  });

  it('rejects trivial PINs (all-same-digit falls to the first guess)', () => {
    expect(validateStudentPin('000000')).toBe(false);
    expect(validateStudentPin('111111')).toBe(false);
    expect(validateStudentPin('۹۹۹۹۹۹')).toBe(false);
    expect(validateStudentPin('777777')).toBe(false);
  });

  it('hashes deterministically and separates PINs from national IDs and students', () => {
    const a = studentPinHash(STUDENT_ID, TEST_PIN);
    expect(a).toBe(studentPinHash(STUDENT_ID, TEST_PIN));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(studentPinHash(STUDENT_ID, '654321'));
    expect(a).not.toBe(studentPinHash('other-student', TEST_PIN));
    // Same pepper, different domain — a PIN hash never equals an ID hash.
    expect(a).not.toBe(nationalIdHash(TEST_PIN));
  });
});

describe('start-session PIN gate (T7)', () => {
  const studentRow = (overrides: Record<string, unknown> = {}) => ({
    id: STUDENT_ID,
    full_name: 'دانش‌آموز',
    grade: 'هفتم',
    class_group_id: null,
    status: 'active',
    pin_hash: null,
    pin_must_change: false,
    ...overrides,
  });

  const startReq = (body: Record<string, unknown> = {}) =>
    createReq({
      method: 'POST',
      url: '/api/student/start-session',
      body: { examCode: 'TEST1', nationalId: '0000000019', ...body },
    });

  it('first login without a PIN returns pinSetupRequired, creates no session', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: { single: studentRow() },
      exam_allowed_classes: { rows: [] },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq() as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      pinSetupRequired: true,
      student: { id: STUDENT_ID, name: 'دانش‌آموز', grade: 'هفتم' },
    });
    expect(admin.calls).not.toContain('student_exam_sessions');
  });

  it('mismatched PIN confirmation returns to setup, not a credential error', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: { single: studentRow() },
      exam_allowed_classes: { rows: [] },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(
      startReq({ pin: TEST_PIN, pinConfirm: '654321' }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ pinSetupRequired: true });
  });

  it('trivial PIN setup is refused — back to setup, nothing minted', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: { single: studentRow() },
      exam_allowed_classes: { rows: [] },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(
      startReq({ pin: '000000', pinConfirm: '000000' }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ pinSetupRequired: true });
    expect((res.body as Record<string, unknown>).token).toBeUndefined();
    expect(admin.calls).not.toContain('student_exam_sessions');
  });

  it('valid setup claims the PIN (hash only) and mints the session token', async () => {
    const studentUpdates: Record<string, unknown>[] = [];
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        onResult: (ctx) => {
          if (ctx.op === 'update') {
            studentUpdates.push(ctx.payload!);
            return { data: { id: STUDENT_ID }, error: null };
          }
          return {
            data: studentRow(),
            error: null,
          };
        },
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'insert') {
            return {
              data: { id: SESSION_ID, status: 'ongoing', started_at: new Date().toISOString() },
              error: null,
            };
          }
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(
      startReq({ pin: TEST_PIN, pinConfirm: TEST_PIN }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(typeof body.token).toBe('string');
    expect(body.pinSetupRequired).toBeUndefined();
    // The stored PIN is a hash — the plaintext never reaches the database.
    expect(studentUpdates).toHaveLength(1);
    const stored = studentUpdates[0].pin_hash as string;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).toBe(studentPinHash(STUDENT_ID, TEST_PIN));
    expect(JSON.stringify(studentUpdates[0])).not.toContain(TEST_PIN);
    expect(studentUpdates[0].pin_must_change).toBe(false);
  });

  it('loser of a concurrent first-login race is rejected, never overwrites', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        onResult: (ctx) => {
          if (ctx.op === 'update') return { data: null, error: null }; // lost the claim
          if (ctx.filters.id) {
            // Fresh re-read: someone else's hash won.
            return {
              data: studentRow({
                pin_hash: studentPinHash(STUDENT_ID, '999999'),
                pin_must_change: false,
              }),
              error: null,
            };
          }
          return { data: studentRow(), error: null };
        },
      },
      exam_allowed_classes: { rows: [] },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(
      startReq({ pin: TEST_PIN, pinConfirm: TEST_PIN }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
  });

  it('correct PIN on later logins mints a token; wrong PIN answers identically to unknown ID', async () => {
    const adminFor = () =>
      createAdmin({
        exams: { single: examRow },
        students: {
          single: studentRow({
            pin_hash: studentPinHash(STUDENT_ID, TEST_PIN),
            pin_must_change: false,
          }),
        },
        exam_allowed_classes: { rows: [] },
        student_exam_sessions: {
          single: {
            id: SESSION_ID,
            status: 'ongoing',
            started_at: minutesAgo(5),
            submitted_at: null,
          },
        },
      });

    vi.mocked(getSupabaseAdmin).mockReturnValue(adminFor() as never);
    const okRes = createRes();
    await handleStudentStartSession(startReq({ pin: TEST_PIN }) as never, okRes as never);
    expect(okRes.statusCode).toBe(200);
    expect(typeof (okRes.body as Record<string, unknown>).token).toBe('string');

    vi.mocked(getSupabaseAdmin).mockReturnValue(adminFor() as never);
    const badRes = createRes();
    // Non-trivial wrong PIN — exercises the constant-time hash compare path.
    await handleStudentStartSession(startReq({ pin: '654321' }) as never, badRes as never);
    expect(badRes.statusCode).toBe(403);
    expect(badRes.body).toEqual({ error: 'invalid_credentials' });

    vi.mocked(getSupabaseAdmin).mockReturnValue(adminFor() as never);
    const missingRes = createRes();
    await handleStudentStartSession(startReq() as never, missingRes as never);
    expect(missingRes.statusCode).toBe(403);
    expect(missingRes.body).toEqual({ error: 'invalid_credentials' });
  });

  it('teacher reset (pin_must_change) routes back to setup on next login', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        single: studentRow({
          pin_hash: studentPinHash(STUDENT_ID, '999999'),
          pin_must_change: true,
        }),
      },
      exam_allowed_classes: { rows: [] },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq({ pin: '999999' }) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ pinSetupRequired: true });
  });

  it('pin_reset-invalidated sessions are re-admitted: answers wiped, fresh window', async () => {
    const answersDeletes: Record<string, unknown>[] = [];
    const sessionUpdates: Record<string, unknown>[] = [];
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        single: studentRow({
          pin_hash: studentPinHash(STUDENT_ID, TEST_PIN),
          pin_must_change: false,
        }),
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'update') {
            sessionUpdates.push(ctx.payload!);
            return {
              data: {
                id: SESSION_ID,
                status: 'ongoing',
                started_at: new Date().toISOString(),
                submitted_at: null,
              },
              error: null,
            };
          }
          return {
            data: {
              id: SESSION_ID,
              status: 'invalidated',
              started_at: minutesAgo(30),
              submitted_at: null,
              invalidated_reason: 'pin_reset',
            },
            error: null,
          };
        },
      },
      student_answers: {
        onResult: (ctx) => {
          if (ctx.op === 'delete') {
            answersDeletes.push({ ...ctx.filters });
            return { data: null, error: null };
          }
          return undefined;
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq({ pin: TEST_PIN }) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(typeof (res.body as Record<string, unknown>).token).toBe('string');
    // Squatter answers died with the re-admit.
    expect(answersDeletes).toEqual([{ session_id: SESSION_ID }]);
    expect(sessionUpdates[0]).toMatchObject({
      status: 'ongoing',
      submitted_at: null,
      invalidated_reason: null,
    });
  });

  it('proctor-invalidated rows (no pin_reset reason) stay permanently blocked', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        single: studentRow({
          pin_hash: studentPinHash(STUDENT_ID, TEST_PIN),
          pin_must_change: false,
        }),
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: {
        single: {
          id: SESSION_ID,
          status: 'invalidated',
          started_at: minutesAgo(30),
          submitted_at: null,
          invalidated_reason: null,
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq({ pin: TEST_PIN }) as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'exam_invalidated' });
  });

  it('loser of a concurrent session insert rejoins the winner instead of 500ing', async () => {
    const admin = createAdmin({
      exams: { single: examRow },
      students: {
        single: studentRow({
          pin_hash: studentPinHash(STUDENT_ID, TEST_PIN),
          pin_must_change: false,
        }),
      },
      exam_allowed_classes: { rows: [] },
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'insert') return { data: null, error: { code: '23505' } };
          return {
            data: {
              id: SESSION_ID,
              status: 'ongoing',
              started_at: minutesAgo(5),
              submitted_at: null,
              invalidated_reason: null,
            },
            error: null,
          };
        },
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(admin as never);
    const res = createRes();
    await handleStudentStartSession(startReq({ pin: TEST_PIN }) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(typeof (res.body as Record<string, unknown>).token).toBe('string');
  });
});

describe('teacher reset-pin (T7)', () => {
  const teacherWith = (admin: ReturnType<typeof createAdmin>) => {
    vi.mocked(requireTeacher).mockResolvedValue({
      id: TEACHER_ID,
      email: 'teacher@test.dev',
      admin,
    } as unknown as Teacher);
  };

  it('clears the hash and flags must-change, scoped to the owning teacher', async () => {
    const studentUpdates: Record<string, unknown>[] = [];
    const updateFilters: Record<string, unknown>[] = [];
    const sessionUpdates: Record<string, unknown>[] = [];
    const sessionFilters: Record<string, unknown>[] = [];
    const admin = createAdmin({
      students: {
        onResult: (ctx) => {
          if (ctx.op === 'update') {
            studentUpdates.push(ctx.payload!);
            updateFilters.push({ ...ctx.filters });
            return {
              data: {
                id: STUDENT_ID,
                full_name: 'دانش‌آموز',
                grade: 'هفتم',
                class_group_id: null,
                national_id_last4: '1234',
                status: 'active',
                pin_set_at: null,
                pin_must_change: true,
              },
              error: null,
            };
          }
          return undefined;
        },
      },
      student_exam_sessions: {
        onResult: (ctx) => {
          if (ctx.op === 'update') {
            sessionUpdates.push(ctx.payload!);
            sessionFilters.push({ ...ctx.filters });
            return { data: [], error: null };
          }
          return undefined;
        },
      },
    });
    teacherWith(admin);
    const res = createRes();
    await handleTeacherStudents(
      createReq({
        method: 'POST',
        url: '/api/teacher/students',
        body: { action: 'reset-pin', id: STUDENT_ID },
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(studentUpdates).toEqual([
      { pin_hash: null, pin_set_at: null, pin_must_change: true },
    ]);
    expect(updateFilters[0]).toMatchObject({ id: STUDENT_ID, teacher_id: TEACHER_ID });
    // Ongoing sessions die with the reset — the squatter's bearer is revoked.
    expect(sessionUpdates).toEqual([
      { status: 'invalidated', invalidated_reason: 'pin_reset' },
    ]);
    expect(sessionFilters[0]).toMatchObject({ student_id: STUDENT_ID, status: 'ongoing' });
    const body = res.body as { student: Record<string, unknown> };
    expect(body.student.pinSet).toBe(false);
    expect(JSON.stringify(body)).not.toContain('pin_hash');
  });

  it('requires a student id', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherStudents(
      createReq({
        method: 'POST',
        url: '/api/teacher/students',
        body: { action: 'reset-pin' },
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'missing_student_id' });
  });
});
