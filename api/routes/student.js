import { json, requireMethod, getClientIp } from '../_lib/http.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { validateIranianNationalId, normalizeNationalId, nationalIdHash } from '../_lib/crypto.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { createStudentSessionToken, verifyStudentSessionToken } from '../_lib/studentSession.js';
import { getBearerToken } from '../_lib/auth.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import {
  safeExamForStudent,
  safeQuestionForStudent,
  getExamAvailability,
  getExamAvailabilityWithGrace,
  getSessionTimeWindow,
  sanitizeStudentAnswer,
  applyExamShuffles,
  gradeAnswerValue,
} from '../_lib/examSecurity.js';
import { tokenTtlForSession, isUuid } from '../_lib/utils.js';

// Wave B: proctor counters — whitelisted keys, integer-bounded, NO PII
// (F-21 lesson: counters only, never IP/UA/free text).
const PROCTOR_KEYS = [
  'tabHidden',
  'windowBlur',
  'copyAttempt',
  'contextMenu',
  'printAttempt',
  'shortcutBlocked',
  'fullscreenExit',
];

function normalizeProctorFlags(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of PROCTOR_KEYS) {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value > 0) out[key] = Math.min(Math.floor(value), 9999);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Client sends CUMULATIVE totals per page-session; max() keeps the merge
// idempotent across repeated reports and reloads (counters restart at 0).
function mergeProctorFlags(current, incoming) {
  const merged = { ...(current && typeof current === 'object' ? current : {}) };
  for (const [key, value] of Object.entries(incoming)) {
    if (!PROCTOR_KEYS.includes(key)) continue;
    merged[key] = Math.max(Number(merged[key]) || 0, value);
  }
  return merged;
}

/**
 * Wave B: server-side auto-grade pass at submit. Compares stored `{ value }`
 * answers against the stored answer key and writes `__grading` — the student
 * client never sees the key, and a teacher's manual grade always wins.
 * Best-effort: a grading failure never fails the submit itself (the paper
 * stays teacher-gradable).
 */
async function autoGradeSession(supabase, sessionId, examId) {
  try {
    const { data: eqRows, error: eqError } = await supabase
      .from('exam_questions')
      .select('question_id, points')
      .eq('exam_id', examId);
    if (eqError) throw eqError;
    if (!eqRows || eqRows.length === 0) return;
    const questionIds = eqRows.map((row) => row.question_id);
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, points, answer_key')
      .in('id', questionIds);
    if (qError) throw qError;
    const { data: answers, error: aError } = await supabase
      .from('student_answers')
      .select('id, question_id, answer')
      .eq('session_id', sessionId);
    if (aError) throw aError;
    const questionById = new Map((questions || []).map((q) => [q.id, q]));
    const pointsById = new Map(eqRows.map((row) => [row.question_id, row.points]));
    for (const row of answers || []) {
      const question = questionById.get(row.question_id);
      if (!question) continue;
      const answer = row.answer && typeof row.answer === 'object' ? row.answer : {};
      const previous = answer.__grading;
      if (previous && previous.gradedBy !== 'auto') continue; // teacher grade wins
      const verdict = gradeAnswerValue(question.answer_key, answer.value);
      if (!verdict) continue; // not machine-gradable — teacher grades it
      const points = Number(pointsById.get(row.question_id) ?? question.points ?? 0);
      const score = verdict.correct && Number.isFinite(points) && points > 0 ? points : 0;
      const { error: updateError } = await supabase
        .from('student_answers')
        .update({
          answer: {
            ...answer,
            __grading: {
              scoreGained: score,
              isCorrect: verdict.correct,
              gradedAt: new Date().toISOString(),
              gradedBy: 'auto',
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error('auto_grade_failed', error?.message || error);
  }
}

async function handleStudentStartSession(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const ip = getClientIp(req);
  const rate = await checkRateLimit('start-session:' + ip, { limit: 15, windowMs: 60_000 });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  const body = req.body || {};
  const cleanExamCode = String(body.examCode || '')
    .trim()
    .toUpperCase();
  const cleanNationalId = normalizeNationalId(body.nationalId);
  // F-11: codes are 6-char server-minted [A-Z0-9]; bound what a join attempt
  // may even carry (no separators, no 32-char probes).
  if (!/^[A-Z0-9]{4,10}$/.test(cleanExamCode))
    return json(res, 400, { error: 'invalid_exam_code' });
  if (!validateIranianNationalId(cleanNationalId))
    return json(res, 400, { error: 'invalid_credentials' });
  try {
    const supabase = getSupabaseAdmin();
    const hash = nationalIdHash(cleanNationalId);
    // F-08: identity-scoped bucket — credential stuffing stays capped even
    // when the attacker rotates source IPs (IP bucket alone can't see it).
    const identityRate = await checkRateLimit(
      `start-session-id:${cleanExamCode}:${hash.slice(0, 16)}`,
      { limit: 10, windowMs: 60_000 },
    );
    if (!identityRate.ok) return json(res, 429, { error: 'too_many_requests' });
    // Wave B: Turnstile join check — no-op unless TURNSTILE_SECRET_KEY is set.
    // verifyTurnstile fail-closes when configured, so bots never inherit uptime.
    const turnstileOk = await verifyTurnstile(
      String(body.turnstileToken || ''),
      process.env.TURNSTILE_SECRET_KEY,
      ip,
    );
    if (!turnstileOk) return json(res, 403, { error: 'turnstile_invalid' });
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select(
        'id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, teacher_id',
      )
      .eq('exam_code', cleanExamCode)
      .maybeSingle();
    if (examError) throw examError;
    // F-12: an unknown code and wrong credentials answer identically — no
    // existence oracle for exam-code enumeration.
    if (!exam) return json(res, 403, { error: 'invalid_credentials' });
    const availability = getExamAvailability(exam);
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, grade, class_group_id, status')
      // F-14: scope by the exam's teacher — the HMAC hash alone is global, so
      // two teachers importing the same national ID used to collide (maybeSingle
      // 500). DB unique (teacher_id, national_id_hash) makes this 0..1 rows.
      .eq('teacher_id', exam.teacher_id)
      .eq('national_id_hash', hash)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student || student.status !== 'active')
      return json(res, 403, { error: 'invalid_credentials' });
    const { data: allowedClasses, error: allowedError } = await supabase
      .from('exam_allowed_classes')
      .select('class_group_id')
      .eq('exam_id', exam.id);
    if (allowedError) throw allowedError;
    if (
      allowedClasses.length > 0 &&
      !allowedClasses.some((row) => row.class_group_id === student.class_group_id)
    ) {
      // F-12: same answer as every other credential failure — "not on the
      // class list" must not confirm the code is real.
      return json(res, 403, { error: 'invalid_credentials' });
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
      // Distinct code only AFTER credentials validate (F-12 still holds —
      // this reveals nothing about exams the caller isn't a member of).
      const statusError =
        session.status === 'expired'
          ? 'exam_time_expired'
          : session.status === 'invalidated'
            ? 'exam_invalidated'
            : 'exam_already_finalized';
      return json(res, 409, { error: statusError });
    }
    if (session) {
      // Personal window (started_at + duration + grace). Once it passes, freeze
      // the session so re-joins can never mint a fresh token (F-02).
      const windowCheck = getSessionTimeWindow(session, exam);
      if (!windowCheck.ok) {
        await supabase
          .from('student_exam_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id)
          .eq('status', 'ongoing');
        return json(res, 410, { error: 'exam_time_expired' });
      }
      // Rejoin: the end-of-window grace applies, but teacher intent
      // (draft/completed/archived) and not-yet-open stay strict.
      const rejoin = getExamAvailabilityWithGrace(exam);
      if (!rejoin.ok) return json(res, rejoin.status, { error: rejoin.error });
    } else {
      if (!availability.ok) return json(res, availability.status, { error: availability.error });
      const { data: inserted, error: insertError } = await supabase
        .from('student_exam_sessions')
        .insert({
          exam_id: exam.id,
          student_id: student.id,
          status: 'ongoing',
          // F-21: client_info stays empty — nothing reads it, and raw
          // IP/User-Agent would be PII with no retention policy. The column
          // keeps its '{}' default.
        })
        .select('id, status, started_at, submitted_at')
        .single();
      if (insertError) throw insertError;
      session = inserted;
    }
    // TTL is anchored to the session clock — re-joining never resets the window.
    const token = createStudentSessionToken(
      { type: 'student_exam', sid: session.id, eid: exam.id, stid: student.id },
      tokenTtlForSession(exam, session),
    );
    json(res, 200, {
      ok: true,
      token,
      session,
      exam: safeExamForStudent(exam),
      student: { id: student.id, name: student.full_name, grade: student.grade },
    });
  } catch (err) {
    json(res, 500, { error: 'start_session_failed' });
  }
}

async function handleStudentExamPayload(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const token = getBearerToken(req);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam')
    return json(res, 401, { error: 'invalid_session' });
  // Wave B: a valid token could loop-fetch the full paper — bound it.
  // 20/min covers legitimate reloads with wide margin.
  const rate = await checkRateLimit('exam-payload:' + payload.sid, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
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
    if (!session || session.status !== 'ongoing')
      return json(res, 403, { error: 'session_not_active' });
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select(
        'id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings',
      )
      .eq('id', payload.eid)
      .single();
    if (examError) throw examError;
    const availability = getExamAvailabilityWithGrace(exam);
    if (!availability.ok) return json(res, availability.status, { error: availability.error });
    const windowCheck = getSessionTimeWindow(session, exam);
    if (!windowCheck.ok) return json(res, windowCheck.status, { error: windowCheck.error });
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
    const safeQuestions = examQuestions
      .map((eq) =>
        questionById.has(eq.question_id)
          ? safeQuestionForStudent(questionById.get(eq.question_id), eq)
          : null,
      )
      .filter(Boolean);
    // F-05: enforce the teacher's shuffle flags server-side, seeded per session
    // so a reload keeps the same order. Answers are keyed by id — grading is
    // order-independent.
    const orderedQuestions = applyExamShuffles(safeQuestions, exam, session.id);
    json(res, 200, {
      ok: true,
      exam: safeExamForStudent(exam),
      session: { id: session.id, startedAt: session.started_at },
      questions: orderedQuestions,
    });
  } catch {
    json(res, 500, { error: 'exam_payload_failed' });
  }
}

async function handleStudentSaveAnswer(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const body = req.body || {};
  const token = getBearerToken(req);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam')
    return json(res, 401, { error: 'invalid_session' });
  const questionId = String(body.questionId || '').trim();
  if (!questionId) return json(res, 400, { error: 'missing_question_id' });
  // F-08: per-session save budget (covers offline-queue flushes).
  const rate = await checkRateLimit('save-answer:' + payload.sid, { limit: 120, windowMs: 60_000 });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  try {
    const supabase = getSupabaseAdmin();
    const { data: session, error: sessionError } = await supabase
      .from('student_exam_sessions')
      .select(
        'id, exam_id, student_id, status, started_at, proctor_flags, exam:exams(id, status, mode, starts_at, ends_at, duration_minutes)',
      )
      .eq('id', payload.sid)
      .eq('exam_id', payload.eid)
      .eq('student_id', payload.stid)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || session.status !== 'ongoing')
      return json(res, 403, { error: 'session_not_active' });
    const availability = getExamAvailabilityWithGrace(session.exam);
    if (!availability.ok) return json(res, availability.status, { error: availability.error });
    const windowCheck = getSessionTimeWindow(session, session.exam);
    if (!windowCheck.ok) return json(res, windowCheck.status, { error: windowCheck.error });
    const { data: examQuestion, error: eqError } = await supabase
      .from('exam_questions')
      .select('question_id')
      .eq('exam_id', payload.eid)
      .eq('question_id', questionId)
      .maybeSingle();
    if (eqError) throw eqError;
    if (!examQuestion) return json(res, 403, { error: 'question_not_in_exam' });
    const { error: upsertError } = await supabase.from('student_answers').upsert(
      {
        session_id: payload.sid,
        question_id: questionId,
        answer: sanitizeStudentAnswer(body.answer),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,question_id' },
    );
    if (upsertError) throw upsertError;
    // Wave B: piggyback proctor counters on the save cadence (max-merge,
    // best-effort — a flag-save hiccup must never lose the student's answer).
    const proctor = normalizeProctorFlags(body.proctor);
    if (proctor) {
      try {
        await supabase
          .from('student_exam_sessions')
          .update({ proctor_flags: mergeProctorFlags(session.proctor_flags, proctor) })
          .eq('id', session.id);
      } catch (flagError) {
        console.error('proctor_flags_save_failed', flagError?.message || flagError);
      }
    }
    json(res, 200, { ok: true, savedAt: new Date().toISOString() });
  } catch {
    json(res, 500, { error: 'save_answer_failed' });
  }
}

async function handleStudentSubmit(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const token = getBearerToken(req);
  const payload = verifyStudentSessionToken(token);
  if (!payload || payload.type !== 'student_exam')
    return json(res, 401, { error: 'invalid_session' });
  const rate = await checkRateLimit('submit:' + payload.sid, { limit: 30, windowMs: 60_000 });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  try {
    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from('student_exam_sessions')
      .select(
        'id, exam_id, student_id, status, started_at, proctor_flags, exam:exams(id, status, mode, starts_at, ends_at, duration_minutes)',
      )
      .eq('id', payload.sid)
      .eq('exam_id', payload.eid)
      .eq('student_id', payload.stid)
      .maybeSingle();
    if (readError) throw readError;
    if (!current || current.status !== 'ongoing')
      return json(res, 409, { error: 'session_not_active_or_already_submitted' });
    const availability = getExamAvailabilityWithGrace(current.exam);
    if (!availability.ok) return json(res, availability.status, { error: availability.error });
    const windowCheck = getSessionTimeWindow(current, current.exam);
    if (!windowCheck.ok) return json(res, windowCheck.status, { error: windowCheck.error });
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
    // Wave B: grade the paper server-side the moment it is in (best-effort),
    // then take one last proctor reading from the submit payload.
    await autoGradeSession(supabase, payload.sid, payload.eid);
    const proctor = normalizeProctorFlags((req.body || {}).proctor);
    if (proctor) {
      try {
        await supabase
          .from('student_exam_sessions')
          .update({ proctor_flags: mergeProctorFlags(current.proctor_flags, proctor) })
          .eq('id', payload.sid);
      } catch (flagError) {
        console.error('proctor_flags_save_failed', flagError?.message || flagError);
      }
    }
    json(res, 200, { ok: true, session });
  } catch {
    json(res, 500, { error: 'submit_failed' });
  }
}

export {
  handleStudentStartSession,
  handleStudentExamPayload,
  handleStudentSaveAnswer,
  handleStudentSubmit,
};
