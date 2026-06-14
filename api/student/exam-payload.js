import { json, requireMethod } from '../_lib/http.js';
import { getBearerToken } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { verifyStudentSessionToken } from '../_lib/studentSession.js';
import { safeExamForStudent, safeQuestionForStudent, getExamAvailability } from '../_lib/examSecurity.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;

  const body = req.body || {};
  const token = getBearerToken(req, body);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam') {
    json(res, 401, { error: 'invalid_session' });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: session, error: sessionError } = await supabase
      .from('student_exam_sessions')
      .select('id, exam_id, student_id, status, started_at')
      .eq('id', payload.sid)
      .eq('exam_id', payload.eid)
      .eq('student_id', payload.stid)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session || session.status !== 'ongoing') {
      json(res, 403, { error: 'session_not_active' });
      return;
    }

    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes')
      .eq('id', payload.eid)
      .single();

    if (examError) throw examError;
    const availability = getExamAvailability(exam);
    if (!availability.ok) {
      json(res, availability.status, { error: availability.error });
      return;
    }

    const { data: examQuestions, error: eqError } = await supabase
      .from('exam_questions')
      .select('question_id, section_title, position, points')
      .eq('exam_id', payload.eid)
      .order('position', { ascending: true });

    if (eqError) throw eqError;
    const questionIds = examQuestions.map((row) => row.question_id);

    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, type, grade, subject, title, body, points')
      .in('id', questionIds.length ? questionIds : ['00000000-0000-0000-0000-000000000000']);

    if (qError) throw qError;
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const safeQuestions = examQuestions
      .map((eq) => questionById.has(eq.question_id) ? safeQuestionForStudent(questionById.get(eq.question_id), eq) : null)
      .filter(Boolean);

    json(res, 200, {
      ok: true,
      exam: safeExamForStudent(exam),
      session: {
        id: session.id,
        startedAt: session.started_at,
      },
      questions: safeQuestions,
    });
  } catch (err) {
    json(res, 500, { error: 'exam_payload_failed' });
  }
}
