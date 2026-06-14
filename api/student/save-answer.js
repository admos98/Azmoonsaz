import { json, requireMethod } from '../_lib/http.js';
import { getBearerToken } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { verifyStudentSessionToken } from '../_lib/studentSession.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;

  const body = req.body || {};
  const token = getBearerToken(req, body);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam') {
    json(res, 401, { error: 'invalid_session' });
    return;
  }

  const questionId = String(body.questionId || '').trim();
  if (!questionId) {
    json(res, 400, { error: 'missing_question_id' });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: session, error: sessionError } = await supabase
      .from('student_exam_sessions')
      .select('id, exam_id, student_id, status')
      .eq('id', payload.sid)
      .eq('exam_id', payload.eid)
      .eq('student_id', payload.stid)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session || session.status !== 'ongoing') {
      json(res, 403, { error: 'session_not_active' });
      return;
    }

    const { data: examQuestion, error: eqError } = await supabase
      .from('exam_questions')
      .select('question_id')
      .eq('exam_id', payload.eid)
      .eq('question_id', questionId)
      .maybeSingle();

    if (eqError) throw eqError;
    if (!examQuestion) {
      json(res, 403, { error: 'question_not_in_exam' });
      return;
    }

    const { error: upsertError } = await supabase
      .from('student_answers')
      .upsert({
        session_id: payload.sid,
        question_id: questionId,
        answer: body.answer ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id,question_id' });

    if (upsertError) throw upsertError;

    json(res, 200, { ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    json(res, 500, { error: 'save_answer_failed' });
  }
}
