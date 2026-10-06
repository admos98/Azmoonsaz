/**
 * Wave 4 — F-13, F-18, F-19, F-20, F-21, F-22, F-25, N-01.
 *
 * F-21 (client_info) has no API surface to test from here — it is covered by
 * the read-back after migration push (column keeps its '{}' default).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { auditLog } from '../../api/_lib/auditLog.js';
import {
  createStudentSessionToken,
  verifyStudentSessionToken,
} from '../../api/_lib/studentSession.js';
import {
  handleTeacherGradeAnswer,
  handleTeacherStudentsBulk,
} from '../../api/routes/teacher.js';
import { handleOnboarding } from '../../api/routes/auth.js';
import { handleSecurityCheck } from '../../api/routes/public.js';
import { createAdmin, createReq, createRes, type TableConfig } from './helpers.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({ requireTeacher: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const EXAM_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID = 'q_1';

const mockedRequireTeacher = vi.mocked(requireTeacher);

function gradeTables(examQuestion: unknown): Record<string, TableConfig> {
  return {
    student_exam_sessions: {
      single: { id: SESSION_ID, exam_id: EXAM_ID, student_id: 's', status: 'ongoing' },
    },
    exams: { single: { id: EXAM_ID } },
    exam_questions: { single: examQuestion },
    student_answers: { single: null },
  };
}

async function grade(body: Record<string, unknown>, examQuestion: unknown) {
  const admin = createAdmin(gradeTables(examQuestion));
  mockedRequireTeacher.mockResolvedValue({ id: TEACHER_ID, admin } as Teacher);
  const res = createRes();
  await handleTeacherGradeAnswer(createReq({ method: 'POST', body }) as never, res as never);
  return { res, body: res.body as Record<string, unknown>, admin };
}

describe('F-18/F-19 — grade-answer bounds', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  });

  it('rejects Infinity (F-18: Number.isNaN alone would pass)', async () => {
    const { res, admin } = await grade(
      { submissionId: SESSION_ID, questionId: QUESTION_ID, scoreGained: Infinity },
      { question_id: QUESTION_ID, points: 10 },
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as Record<string, string>).error).toBe('invalid_score');
    expect(admin.calls).toHaveLength(0);
  });

  it('rejects NaN', async () => {
    const { res } = await grade(
      { submissionId: SESSION_ID, questionId: QUESTION_ID, scoreGained: 'abc' },
      { question_id: QUESTION_ID, points: 10 },
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as Record<string, string>).error).toBe('invalid_score');
  });

  it('rejects a question that is not in the exam (F-19)', async () => {
    const { res, admin } = await grade(
      { submissionId: SESSION_ID, questionId: QUESTION_ID, scoreGained: 5 },
      null, // exam_questions lookup found nothing
    );
    expect(res.statusCode).toBe(403);
    expect((res.body as Record<string, string>).error).toBe('question_not_in_exam');
    expect(admin.calls).toContain('exam_questions');
    expect(admin.calls).not.toContain('student_answers');
    expect(admin.calls).not.toContain('audit_logs');
  });

  it('rejects a score above the question point value (F-18/F-19 cap)', async () => {
    const { res } = await grade(
      { submissionId: SESSION_ID, questionId: QUESTION_ID, scoreGained: 50 },
      { question_id: QUESTION_ID, points: 10 },
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as Record<string, string>).error).toBe('score_exceeds_points');
  });

  it('accepts a score up to the point value, grades and audits (F-13)', async () => {
    const { res, admin } = await grade(
      { submissionId: SESSION_ID, questionId: QUESTION_ID, scoreGained: 10 },
      { question_id: QUESTION_ID, points: 10 },
    );
    expect(res.statusCode).toBe(200);
    expect(admin.calls).toContain('student_answers');
    expect(admin.calls).toContain('audit_logs');
  });

  it('accepts a positive score below the cap and audits it', async () => {
    const { res, admin } = await grade(
      { submissionId: SESSION_ID, questionId: QUESTION_ID, scoreGained: 7 },
      { question_id: QUESTION_ID, points: 10 },
    );
    expect(res.statusCode).toBe(200);
    expect(admin.calls).toContain('audit_logs');
  });
});

describe('N-01 — bulk import field bounds', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  });

  async function bulk(students: Record<string, unknown>[]) {
    const admin = createAdmin({});
    mockedRequireTeacher.mockResolvedValue({ id: TEACHER_ID, admin } as Teacher);
    const res = createRes();
    await handleTeacherStudentsBulk(
      createReq({ method: 'POST', body: { students } }) as never,
      res as never,
    );
    return { res, body: res.body as Record<string, never>, admin };
  }

  it('rejects an oversized name', async () => {
    const { res, body } = await bulk([{ name: 'ن'.repeat(300), grade: 'اول', nationalId: '0000000019' }]);
    expect(res.statusCode).toBe(200);
    expect(body.importedCount).toBe(0);
    expect((body.failed as unknown[])[0]).toMatchObject({ reason: 'name_too_long' });
  });

  it('rejects an oversized grade WITHOUT creating a junk class group (pass 1)', async () => {
    const { res, body, admin } = await bulk([
      { name: 'دانش‌آموز', grade: 'g'.repeat(100), nationalId: '0000000019' },
    ]);
    expect(res.statusCode).toBe(200);
    expect(body.importedCount).toBe(0);
    expect((body.failed as unknown[])[0]).toMatchObject({ reason: 'grade_too_long' });
    expect(admin.calls).not.toContain('class_groups');
    expect(admin.calls).not.toContain('students');
  });
});

describe('F-20 — onboarding input bounds', () => {
  async function onboard(body: Record<string, unknown>) {
    const admin = createAdmin({});
    mockedRequireTeacher.mockResolvedValue({ id: TEACHER_ID, admin } as Teacher);
    const res = createRes();
    await handleOnboarding(createReq({ method: 'POST', body }) as never, res as never);
    return { res, admin };
  }

  it('rejects a school name over 200 chars before touching the DB', async () => {
    const { res, admin } = await onboard({ schoolName: 'س'.repeat(201), subject: 'ریاضی' });
    expect(res.statusCode).toBe(400);
    expect((res.body as Record<string, string>).error).toBe('school_name_too_long');
    expect(admin.calls).toHaveLength(0);
  });

  it('rejects a subject over 100 chars before touching the DB', async () => {
    const { res, admin } = await onboard({ schoolName: 'دبیرستان', subject: 'م'.repeat(101) });
    expect(res.statusCode).toBe(400);
    expect((res.body as Record<string, string>).error).toBe('subject_too_long');
    expect(admin.calls).toHaveLength(0);
  });

  it('accepts a bounded onboarding and writes an audit event (F-13)', async () => {
    const { res, admin } = await onboard({ schoolName: 'دبیرستان', subject: 'ریاضی' });
    expect(res.statusCode).toBe(200);
    expect(admin.calls).toContain('teacher_profiles');
    expect(admin.calls).toContain('audit_logs');
  });
});

describe('F-22 — security-check reports aggregate status only', () => {
  const SAVED: Record<string, string | undefined> = {};
  const KEYS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STUDENT_ID_PEPPER',
  ];
  const PEPPER = 'test-pepper-'.padEnd(64, '0');

  beforeEach(() => {
    for (const key of KEYS) SAVED[key] = process.env[key];
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.STUDENT_ID_PEPPER = PEPPER;
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (SAVED[key] === undefined) delete process.env[key];
      else process.env[key] = SAVED[key];
    }
  });

  it('returns configured:true with no per-component boolean map', async () => {
    const res = createRes();
    await handleSecurityCheck(createReq({ method: 'GET' }) as never, res as never);
    const body = res.body as Record<string, unknown>;
    expect(res.statusCode).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.checks).toBeUndefined();
  });

  it('returns configured:false when config is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = createRes();
    await handleSecurityCheck(createReq({ method: 'GET' }) as never, res as never);
    expect((res.body as Record<string, unknown>).configured).toBe(false);
  });
});

describe('F-13 — auditLog never fails the caller', () => {
  it('swallows insert errors but logs them', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const admin = {
      from: () => ({ insert: async () => ({ error: { message: 'boom' } }) }),
    };
    await expect(
      auditLog(admin as never, { actorType: 'teacher', action: 'test' }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('writes the normalized row shape on success', async () => {
    let payload: Record<string, unknown> | undefined;
    const admin = {
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          expect(table).toBe('audit_logs');
          payload = row;
          return { error: null };
        },
      }),
    };
    await auditLog(admin as never, {
      actorType: 'teacher',
      actorId: 't1',
      action: 'grade_answer',
      entityType: 'session',
      entityId: 's1',
      metadata: { scoreGained: 5 },
    });
    expect(payload).toMatchObject({
      actor_type: 'teacher',
      actor_id: 't1',
      action: 'grade_answer',
      entity_type: 'session',
      entity_id: 's1',
      metadata: { scoreGained: 5 },
    });
  });
});

describe('F-25 — session tokens use a dedicated/derived key, not the raw pepper', () => {
  const PEPPER = 'test-pepper-'.padEnd(64, '0');
  let savedSecret: string | undefined;
  let savedPepper: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.STUDENT_SESSION_SECRET;
    savedPepper = process.env.STUDENT_ID_PEPPER;
    delete process.env.STUDENT_SESSION_SECRET;
    process.env.STUDENT_ID_PEPPER = PEPPER;
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.STUDENT_SESSION_SECRET;
    else process.env.STUDENT_SESSION_SECRET = savedSecret;
    if (savedPepper === undefined) delete process.env.STUDENT_ID_PEPPER;
    else process.env.STUDENT_ID_PEPPER = savedPepper;
  });

  it('round-trips when only STUDENT_ID_PEPPER is set (HKDF fallback)', () => {
    const token = createStudentSessionToken({ studentId: 'st1', examId: 'ex1' }, 600);
    const claims = verifyStudentSessionToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.studentId).toBe('st1');
  });

  it('rejects tokens after the pepper rotates (derived key changes)', () => {
    const token = createStudentSessionToken({ studentId: 'st1' }, 600);
    process.env.STUDENT_ID_PEPPER = 'rotated-pepper-'.padEnd(64, '1');
    expect(verifyStudentSessionToken(token)).toBeNull();
  });

  it('prefers a dedicated STUDENT_SESSION_SECRET when configured', () => {
    process.env.STUDENT_SESSION_SECRET = 'dedicated-session-secret-'.padEnd(64, '9');
    const token = createStudentSessionToken({ studentId: 'st2' }, 600);
    const claims = verifyStudentSessionToken(token);
    expect(claims?.studentId).toBe('st2');
    // Dedicated secret set => pepper no longer influences verification.
    process.env.STUDENT_ID_PEPPER = 'irrelevant-pepper-'.padEnd(64, '2');
    expect(verifyStudentSessionToken(token)).not.toBeNull();
  });
});
