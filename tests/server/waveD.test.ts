/**
 * Wave D — sweep-2 fixes:
 *  F-26 exam create rejects foreign question ids (IDOR via FK) + hydrate scoping
 *  F-27 resolveClassGroupIds array path keeps teacher ownership scope
 *  N-07 input length caps on single create/update paths
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleTeacherClasses,
  handleTeacherExams,
  handleTeacherQuestions,
  handleTeacherStudents,
} from '../../api/routes/teacher.js';
import { resolveClassGroupIds } from '../../api/_lib/utils.js';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { createAdmin, createReq, createRes } from './helpers.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({ requireTeacher: vi.fn() }));
vi.mock('../../api/_lib/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const EXAM_ID = '22222222-2222-4222-8222-222222222222';
const OWN_QUESTION = '55555555-5555-4555-8555-555555555555';
const FOREIGN_QUESTION = '66666666-6666-4666-8666-666666666666';
const OWN_CLASS = '77777777-7777-4777-8777-777777777777';
const FOREIGN_CLASS = '88888888-8888-4888-8888-888888888888';

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
  vi.mocked(requireTeacher).mockReset();
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
});

describe('F-26: exam create refuses foreign question ids', () => {
  const examBody = (questionId: string) => ({
    action: 'create',
    exam: {
      title: 'آزمون تست',
      grade: '10',
      subject: 'ریاضی',
      classGroupIds: [],
      questions: [{ id: questionId, points: 3 }],
    },
  });

  it('rejects a question the teacher does not own with 400 question_not_owned', async () => {
    const examInserts: Array<Record<string, unknown>> = [];
    const admin = createAdmin({
      class_groups: { rows: [{ id: OWN_CLASS, teacher_id: TEACHER_ID, grade: '10' }] },
      exams: {
        onResult: (ctx) =>
          ctx.op === 'insert'
            ? { data: { ...ctx.payload, id: EXAM_ID }, error: null }
            : { data: null, error: null },
      },
      questions: {
        onResult: (ctx) => {
          if (ctx.op !== 'select') return undefined;
          const ids = Array.isArray(ctx.filters.id) ? (ctx.filters.id as string[]) : [];
          return {
            data: [{ id: OWN_QUESTION, teacher_id: TEACHER_ID }].filter(
              (row) =>
                ids.includes(row.id) && row.teacher_id === ctx.filters.teacher_id,
            ),
            error: null,
          };
        },
      },
      exam_allowed_classes: {
        onResult: (ctx) => {
          if (ctx.op === 'insert') examInserts.push(ctx.payload);
          return { data: [], error: null };
        },
      },
      exam_questions: { rows: [] },
    });
    teacherWith(admin);

    const res = createRes();
    await handleTeacherExams(post('/api/teacher/exams', examBody(FOREIGN_QUESTION)), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'question_not_owned' });
  });

  it('accepts own questions and links them', async () => {
    const linked: Array<Record<string, unknown>> = [];
    const admin = createAdmin({
      class_groups: { rows: [{ id: OWN_CLASS, teacher_id: TEACHER_ID, grade: '10' }] },
      exams: {
        onResult: (ctx) =>
          ctx.op === 'insert'
            ? { data: { ...ctx.payload, id: EXAM_ID }, error: null }
            : { data: null, error: null },
      },
      questions: {
        onResult: (ctx) => {
          if (ctx.op !== 'select') return undefined;
          const ids = Array.isArray(ctx.filters.id) ? (ctx.filters.id as string[]) : [];
          return {
            data: [{ id: OWN_QUESTION, teacher_id: TEACHER_ID }].filter(
              (row) =>
                ids.includes(row.id) && row.teacher_id === ctx.filters.teacher_id,
            ),
            error: null,
          };
        },
      },
      exam_allowed_classes: { rows: [] },
      exam_questions: {
        onResult: (ctx) => {
          if (ctx.op === 'insert')
            linked.push(...(ctx.payload as unknown as Record<string, unknown>[]));
          return { data: [], error: null };
        },
      },
    });
    teacherWith(admin);

    const res = createRes();
    await handleTeacherExams(post('/api/teacher/exams', examBody(OWN_QUESTION)), res);
    expect(res.statusCode).toBe(200);
    expect(linked).toHaveLength(1);
    expect((linked[0] as { question_id: string }).question_id).toBe(OWN_QUESTION);
  });
});

describe('F-27: resolveClassGroupIds keeps ownership scope', () => {
  const OWN_ROWS = [
    { id: OWN_CLASS, teacher_id: TEACHER_ID, grade: '10' },
    { id: FOREIGN_CLASS, teacher_id: 'other-teacher', grade: '10' },
  ];
  const scopedAdmin = () =>
    createAdmin({
      class_groups: {
        onResult: (ctx) => {
          if (ctx.op !== 'select') return undefined;
          if (Array.isArray(ctx.filters.id)) {
            const ids = ctx.filters.id as string[];
            return {
              data: OWN_ROWS.filter(
                (row) =>
                  ids.includes(row.id) && row.teacher_id === ctx.filters.teacher_id,
              ),
              error: null,
            };
          }
          return {
            data:
              OWN_ROWS.find(
                (row) =>
                  row.grade === ctx.filters.grade &&
                  row.teacher_id === ctx.filters.teacher_id,
              ) || null,
            error: null,
          };
        },
      },
    });

  it('keeps owned ids and drops foreign ones from a mixed list', async () => {
    const result = await resolveClassGroupIds(
      { id: TEACHER_ID, admin: scopedAdmin() } as unknown as Teacher,
      [OWN_CLASS, FOREIGN_CLASS],
      '10',
    );
    expect(result).toEqual([OWN_CLASS]);
  });

  it('never returns a foreign id when nothing is owned', async () => {
    const result = await resolveClassGroupIds(
      { id: TEACHER_ID, admin: scopedAdmin() } as unknown as Teacher,
      [FOREIGN_CLASS],
      '10',
    );
    expect(result).not.toContain(FOREIGN_CLASS);
    expect(result).toContain(OWN_CLASS); // fell back to the teacher's own grade class
  });
});

describe('N-07: input caps on single write paths', () => {
  it('caps class name at 100 chars', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherClasses(
      post('/api/teacher/classes', { action: 'create', name: 'x'.repeat(101), grade: '10' }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'class_name_too_long' });
  });

  it('caps single-student name at 128 chars', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherStudents(
      post('/api/teacher/students', {
        action: 'create',
        name: 'x'.repeat(129),
        grade: '10',
        nationalId: '0000000019',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'name_too_long' });
  });

  it('caps exam title at 200 chars before any DB work', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherExams(
      post('/api/teacher/exams', {
        action: 'create',
        exam: { title: 'x'.repeat(201), grade: '10', subject: 'ریاضی' },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'title_too_long' });
  });

  it('caps question subject at 100 chars', async () => {
    teacherWith(createAdmin({}));
    const res = createRes();
    await handleTeacherQuestions(
      post('/api/teacher/questions', {
        action: 'create',
        question: {
          type: 'multiple_choice',
          grade: '10',
          subject: 'x'.repeat(101),
          title: 'سوال',
          options: [],
        },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'subject_too_long' });
  });
});
