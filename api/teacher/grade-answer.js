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

async function requireOwnedSession(teacher, sessionId) {
  const { data: session, error: sessionError } = await teacher.admin
    .from('student_exam_sessions')
    .select('id, exam_id, student_id, status')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError || !session) return { error: sessionError || new Error('missing session') };

  const { data: exam, error: examError } = await teacher.admin
    .from('exams')
    .select('id')
    .eq('id', session.exam_id)
    .eq('teacher_id', teacher.id)
    .maybeSingle();
  if (examError || !exam) return { error: examError || new Error('exam not owned') };
  return { session };
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const body = req.body || {};
  const sessionId = String(body.submissionId || body.sessionId || '').trim();
  const questionId = String(body.questionId || '').trim();
  const scoreGained = Number(body.scoreGained || 0);
  const teacherComment = String(body.comment || body.teacherComment || '');

  if (!sessionId || !questionId) return json(res, 400, { error: 'missing_grade_target' });
  if (Number.isNaN(scoreGained) || scoreGained < 0) return json(res, 400, { error: 'invalid_score' });

  const owned = await requireOwnedSession(teacher, sessionId);
  if (owned.error) return json(res, 403, safeError(owned.error, 'submission_not_owned'));

  const { data: existing, error: existingError } = await teacher.admin
    .from('student_answers')
    .select('answer')
    .eq('session_id', sessionId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (existingError) return json(res, 500, safeError(existingError, 'answer_fetch_failed'));

  const answer = existing?.answer && typeof existing.answer === 'object' ? existing.answer : {};
  const nextAnswer = {
    ...answer,
    __grading: {
      scoreGained,
      teacherComment,
      isCorrect: scoreGained > 0,
      gradedAt: new Date().toISOString(),
      gradedBy: teacher.id,
    },
  };

  const { error: upsertError } = await teacher.admin
    .from('student_answers')
    .upsert({
      session_id: sessionId,
      question_id: questionId,
      answer: nextAnswer,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,question_id' });

  if (upsertError) return json(res, 500, safeError(upsertError, 'grade_save_failed'));
  json(res, 200, { ok: true });
}
