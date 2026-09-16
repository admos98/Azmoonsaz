import { json, requireMethod, getClientIp } from '../_lib/http.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { validateIranianNationalId, normalizeNationalId, nationalIdHash } from '../_lib/crypto.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { createStudentSessionToken, verifyStudentSessionToken } from '../_lib/studentSession.js';
import { getBearerToken } from '../_lib/auth.js';
import { safeExamForStudent, safeQuestionForStudent, getExamAvailability } from '../_lib/examSecurity.js';
import { tokenTtlForExam, isUuid } from '../_lib/utils.js';

async function handleStudentStartSession(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const ip = getClientIp(req);
  const rate = await checkRateLimit('start-session:' + ip, { limit: 15, windowMs: 60_000 });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  const body = req.body || {};
  const cleanExamCode = String(body.examCode || '').trim().toUpperCase();
  const cleanNationalId = normalizeNationalId(body.nationalId);
  if (!/^[A-Z0-9_-]{4,32}$/.test(cleanExamCode)) return json(res, 400, { error: 'invalid_exam_code' });
  if (!validateIranianNationalId(cleanNationalId)) return json(res, 400, { error: 'invalid_credentials' });
  try {
    const supabase = getSupabaseAdmin();
    const hash = nationalIdHash(cleanNationalId);
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes')
      .eq('exam_code', cleanExamCode)
      .maybeSingle();
    if (examError) throw examError;
    const availability = getExamAvailability(exam);
    if (!availability.ok) return json(res, availability.status, { error: availability.error });
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, grade, class_group_id, status')
      .eq('national_id_hash', hash)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student || student.status !== 'active') return json(res, 403, { error: 'invalid_credentials' });
    const { data: allowedClasses, error: allowedError } = await supabase
      .from('exam_allowed_classes')
      .select('class_group_id')
      .eq('exam_id', exam.id);
    if (allowedError) throw allowedError;
    if (allowedClasses.length > 0 && !allowedClasses.some((row) => row.class_group_id === student.class_group_id)) {
      return json(res, 403, { error: 'not_allowed_for_exam' });
    }
    const { data: existing, error: existingError } = await supabase
      .from('student_exam_sessions')
      .select('id, status, started_at, submitted_at')
      .eq('exam_id', exam.id)
      .eq('student_id', student.id)
      .maybeSingle();
    if (existingError) throw existingError;
    let session = existing;
    if (session && ['submitted', 'graded', 'expired', 'invalidated'].includes(session.status)) {
      return json(res, 409, { error: 'exam_already_finalized' });
    }
    if (!session) {
      const { data: inserted, error: insertError } = await supabase
        .from('student_exam_sessions')
        .insert({ exam_id: exam.id, student_id: student.id, status: 'ongoing', client_info: { ip, userAgent: req.headers['user-agent'] || 'unknown' } })
        .select('id, status, started_at, submitted_at')
        .single();
      if (insertError) throw insertError;
      session = inserted;
    }
    const token = createStudentSessionToken({ type: 'student_exam', sid: session.id, eid: exam.id, stid: student.id }, tokenTtlForExam(exam));
    json(res, 200, { ok: true, token, session, exam: safeExamForStudent(exam), student: { id: student.id, name: student.full_name, grade: student.grade } });
  } catch (err) {
    json(res, 500, { error: 'start_session_failed' });
  }
}

async function handleStudentExamPayload(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const token = getBearerToken(req);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam') return json(res, 401, { error: 'invalid_session' });
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
    if (!session || session.status !== 'ongoing') return json(res, 403, { error: 'session_not_active' });
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes')
      .eq('id', payload.eid)
      .single();
    if (examError) throw examError;
    const availability = getExamAvailability(exam);
    if (!availability.ok) return json(res, availability.status, { error: availability.error });
    const { data: examQuestions, error: eqError } = await supabase
      .from('exam_questions')
      .select('question_id, section_title, position, points')
      .eq('exam_id', payload.eid)
      .order('position', { ascending: true });
    if (eqError) throw eqError;
    const questionIds = examQuestions.map((row) => row.question_id);
    let questions = [];
    if (questionIds.length > 0) {
      const { data, error: qError } = await supabase
        .from('questions')
        .select('id, type, grade, subject, title, body, points')
        .in('id', questionIds);
      if (qError) throw qError;
      questions = data || [];
    }
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const safeQuestions = examQuestions.map((eq) => questionById.has(eq.question_id) ? safeQuestionForStudent(questionById.get(eq.question_id), eq) : null).filter(Boolean);
    json(res, 200, { ok: true, exam: safeExamForStudent(exam), session: { id: session.id, startedAt: session.started_at }, questions: safeQuestions });
  } catch {
    json(res, 500, { error: 'exam_payload_failed' });
  }
}

async function handleStudentSaveAnswer(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const body = req.body || {};
  const token = getBearerToken(req);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam') return json(res, 401, { error: 'invalid_session' });
  const questionId = String(body.questionId || '').trim();
  if (!questionId) return json(res, 400, { error: 'missing_question_id' });
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
    if (!session || session.status !== 'ongoing') return json(res, 403, { error: 'session_not_active' });
    const { data: examQuestion, error: eqError } = await supabase
      .from('exam_questions')
      .select('question_id')
      .eq('exam_id', payload.eid)
      .eq('question_id', questionId)
      .maybeSingle();
    if (eqError) throw eqError;
    if (!examQuestion) return json(res, 403, { error: 'question_not_in_exam' });
    const { error: upsertError } = await supabase
      .from('student_answers')
      .upsert({ session_id: payload.sid, question_id: questionId, answer: body.answer ?? {}, updated_at: new Date().toISOString() }, { onConflict: 'session_id,question_id' });
    if (upsertError) throw upsertError;
    json(res, 200, { ok: true, savedAt: new Date().toISOString() });
  } catch {
    json(res, 500, { error: 'save_answer_failed' });
  }
}

async function handleStudentSubmit(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const token = getBearerToken(req);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam') return json(res, 401, { error: 'invalid_session' });
  try {
    const supabase = getSupabaseAdmin();
    const { data: session, error: sessionError } = await supabase
      .from('student_exam_sessions')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', payload.sid)
      .eq('exam_id', payload.eid)
      .eq('student_id', payload.stid)
      .eq('status', 'ongoing')
      .select('id, status, started_at, submitted_at')
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json(res, 409, { error: 'session_not_active_or_already_submitted' });
    json(res, 200, { ok: true, session });
  } catch {
    json(res, 500, { error: 'submit_failed' });
  }
}

export { handleStudentStartSession, handleStudentExamPayload, handleStudentSaveAnswer, handleStudentSubmit };
