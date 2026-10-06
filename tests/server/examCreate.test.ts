/**
 * BE-2 — the join code has ONE source of truth: the server mints it at create
 * and hydration round-trips it, so the frontend can only ever render the code
 * that actually exists in the database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { handleTeacherExams } from '../../api/routes/teacher.js';
import { createAdmin, createReq, createRes, type TableConfig } from './helpers.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({
  requireTeacher: vi.fn(),
}));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = 'a1b2c3d4-1111-4222-9a44-445555666666';

function makeAdmin() {
  const examInserts: Record<string, unknown>[] = [];
  const exams: TableConfig = {
    onResult: (ctx) => {
      if (ctx.op === 'insert') {
        const payload = ctx.payload as Record<string, unknown>;
        examInserts.push(payload);
        return {
          data: { ...payload, id: 'exam-1', created_at: '2026-06-15T00:00:00.000Z' },
          error: null,
        };
      }
      return undefined;
    },
  };

  const admin = createAdmin({
    exams,
    class_groups: { single: { id: CLASS_ID } },
    exam_allowed_classes: { rows: [{ class_group_id: CLASS_ID }] },
    exam_questions: { rows: [] },
  });
  return { admin, examInserts };
}

function setTeacher(admin: ReturnType<typeof createAdmin>) {
  vi.mocked(requireTeacher).mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@example.com',
    admin,
  } as unknown as Teacher);
}

const examBody = {
  action: 'create',
  exam: {
    title: 'آزمون ریاضی',
    grade: 'هفتم',
    subject: 'ریاضی',
    duration: 45,
    classGroupIds: [],
    settings: {
      mode: 'official',
      durationMinutes: 45,
      // What ExamSettings now sends: a real instant, never a naive string.
      startTime: '2026-06-15T08:30:00.000Z',
      endTime: '2026-06-15T10:00:00.000Z',
      startDate: '2026-06-15',
      startHour: '12:00',
    },
  },
};

beforeEach(() => vi.mocked(requireTeacher).mockReset());

describe('POST /api/teacher/exams (create)', () => {
  it('mints the join code server-side and returns it through hydration', async () => {
    const { admin, examInserts } = makeAdmin();
    setTeacher(admin);
    const res = createRes();
    await handleTeacherExams(createReq({ method: 'POST', body: examBody }) as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      ok: boolean;
      exam: { examCode: string; settings: Record<string, string> };
    };
    expect(body.ok).toBe(true);

    // The stored code and the returned code are the same value — no client
    // side minting can disagree with the database.
    expect(examInserts[0].exam_code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(body.exam.examCode).toBe(examInserts[0].exam_code);

    // The scheduling instant survives the round trip unchanged (timestamptz).
    expect(body.exam.settings.startTime).toBe('2026-06-15T08:30:00.000Z');
    expect(examInserts[0].starts_at).toBe('2026-06-15T08:30:00.000Z');
    // Wall-clock editor fields ride along in settings.
    expect(body.exam.settings.startDate).toBe('2026-06-15');
  });

  it('refuses to invent a status: the stored intent is what was sent', async () => {
    const { admin, examInserts } = makeAdmin();
    setTeacher(admin);
    // A genuinely future window, so "scheduled" is the honest derived answer.
    const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const res = createRes();
    await handleTeacherExams(
      createReq({
        method: 'POST',
        body: {
          ...examBody,
          exam: {
            ...examBody.exam,
            status: 'scheduled',
            settings: { ...examBody.exam.settings, startTime: futureStart, endTime: futureEnd },
          },
        },
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(examInserts[0].status).toBe('scheduled');
    // Hydration derives the effective status from the window instead of
    // echoing whatever is stored.
    const body = res.body as { exam: { status: string } };
    expect(body.exam.status).toBe('scheduled');
  });

  it('ignores a client-supplied examCode — the server mints every code (F-11)', async () => {
    const { admin, examInserts } = makeAdmin();
    setTeacher(admin);
    const res = createRes();
    await handleTeacherExams(
      createReq({
        method: 'POST',
        body: { ...examBody, exam: { ...examBody.exam, examCode: 'HACKED1' } },
      }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(examInserts[0].exam_code).not.toBe('HACKED1');
    expect(examInserts[0].exam_code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('rejects an unsupported method with 405', async () => {
    setTeacher(makeAdmin().admin);
    const res = createRes();
    // The route allows GET (list) and POST (create) — PUT is neither.
    await handleTeacherExams(createReq({ method: 'PUT' }) as never, res as never);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, POST');
  });
});
