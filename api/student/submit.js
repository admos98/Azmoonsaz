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

  try {
    const supabase = getSupabaseAdmin();
    const submittedAt = new Date().toISOString();

    const { data: session, error: sessionError } = await supabase
      .from('student_exam_sessions')
      .update({ status: 'submitted', submitted_at: submittedAt })
      .eq('id', payload.sid)
      .eq('exam_id', payload.eid)
      .eq('student_id', payload.stid)
      .eq('status', 'ongoing')
      .select('id, status, started_at, submitted_at')
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      json(res, 409, { error: 'session_not_active_or_already_submitted' });
      return;
    }

    json(res, 200, { ok: true, session });
  } catch (err) {
    json(res, 500, { error: 'submit_failed' });
  }
}
