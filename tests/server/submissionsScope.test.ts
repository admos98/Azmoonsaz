/**
 * BE-5 — submissions scoping.
 *
 * Acceptance: ExamResults for exam A never receives rows from another
 * teacher's exams, whether the client passes `examId` or omits it (the
 * no-param path must stay teacher-scoped, not global).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireTeacher } from '../../api/_lib/teacherAuth.js';
import { handleTeacherSubmissions } from '../../api/routes/teacher.js';
import { createAdmin, createReq, createRes, filterRows } from './helpers.js';

vi.mock('../../api/_lib/teacherAuth.js', () => ({
  requireTeacher: vi.fn(),
}));

type Teacher = Awaited<ReturnType<typeof requireTeacher>>;

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';

function setTeacher(admin: ReturnType<typeof createAdmin>) {
  vi.mocked(requireTeacher).mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@example.com',
    admin,
  } as unknown as Teacher);
}

/** Sessions for two exams of this teacher plus one of somebody else's. */
const sessionRows = [
  { id: 'sess-a1', exam_id: 'exam-a', student_id: 'stu-1', status: 'submitted', started_at: '2026-06-15T09:00:00Z', submitted_at: '2026-06-15T09:40:00Z' },
  { id: 'sess-b1', exam_id: 'exam-b', student_id: 'stu-2', status: 'submitted', started_at: '2026-06-16T09:00:00Z', submitted_at: '2026-06-16T09:40:00Z' },
  // Belongs to a different teacher — must never surface.
  { id: 'sess-foreign', exam_id: 'exam-foreign', student_id: 'stu-9', status: 'submitted', started_at: '2026-06-17T09:00:00Z', submitted_at: '2026-06-17T09:40:00Z' },
];

const teacherExamRows = [
  { id: 'exam-a', exam_code: 'AAAAAA', teacher_id: TEACHER_ID },
  { id: 'exam-b', exam_code: 'BBBBBB', teacher_id: TEACHER_ID },
];

function makeAdmin() {
  return createAdmin({
    exams: filterRows(teacherExamRows),
    student_exam_sessions: filterRows(sessionRows),
    students: filterRows([
      { id: 'stu-1', full_name: 'سارا', national_id_last4: '0019' },
      { id: 'stu-2', full_name: 'علی', national_id_last4: '1234' },
    ]),
    student_answers: filterRows([]),
    exam_questions: filterRows([]),
  });
}

async function call(query: Record<string, unknown>) {
  const res = createRes();
  await handleTeacherSubmissions(createReq({ method: 'GET', query }) as never, res as never);
  return { res, body: res.body as { ok: boolean; submissions: { id: string; examId: string }[] } };
}

beforeEach(() => vi.mocked(requireTeacher).mockReset());

describe('GET /api/teacher/submissions', () => {
  it('403s an examId the teacher does not own', async () => {
    setTeacher(makeAdmin());
    const { res, body } = await call({ examId: 'exam-foreign' });
    expect(res.statusCode).toBe(403);
    expect(body).toEqual({ error: 'exam_not_owned' });
  });

  it('filters to the requested exam only', async () => {
    setTeacher(makeAdmin());
    const { res, body } = await call({ examId: 'exam-a' });
    expect(res.statusCode).toBe(200);
    expect(body.submissions.map((s) => s.examId)).toEqual(['exam-a']);
    expect(body.submissions.some((s) => s.id === 'sess-foreign')).toBe(false);
  });

  it('stays teacher-scoped when the client omits examId', async () => {
    setTeacher(makeAdmin());
    const { res, body } = await call({});
    expect(res.statusCode).toBe(200);
    const examIds = [...new Set(body.submissions.map((s) => s.examId))].sort();
    // Everything this teacher owns, and nothing that is not theirs.
    expect(examIds).toEqual(['exam-a', 'exam-b']);
    expect(body.submissions.some((s) => s.id === 'sess-foreign')).toBe(false);
  });

  it('rejects non-GET with 405', async () => {
    setTeacher(makeAdmin());
    const res = createRes();
    await handleTeacherSubmissions(createReq({ method: 'POST' }) as never, res as never);
    expect(res.statusCode).toBe(405);
  });
});
