import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const sessionId = String((req.body || {}).submissionId || (req.body || {}).sessionId || '').trim();
  if (!sessionId) return json(res, 400, { error: 'missing_submission_id' });

  const { data: session, error: sessionError } = await teacher.admin
    .from('student_exam_sessions')
    .select('id, exam_id, student_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError || !session) return json(res, 404, safeError(sessionError, 'submission_not_found'));

  const { data: exam, error: examError } = await teacher.admin
    .from('exams')
    .select('id')
    .eq('id', session.exam_id)
    .eq('teacher_id', teacher.id)
    .maybeSingle();
  if (examError || !exam) return json(res, 403, safeError(examError, 'submission_not_owned'));

  const { data, error } = await teacher.admin
    .from('student_exam_sessions')
    .update({ status: 'graded' })
    .eq('id', sessionId)
    .select('id, exam_id, student_id, status, started_at, submitted_at')
    .single();

  if (error) return json(res, 500, safeError(error, 'finalize_failed'));
  json(res, 200, { ok: true, session: data });
}
