import { json, requireMethod, getClientIp } from '../_lib/http.js';
import { getBearerToken } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { validateIranianNationalId, normalizeNationalId, nationalIdHash } from '../_lib/crypto.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { createStudentSessionToken } from '../_lib/studentSession.js';
import { safeExamForStudent, getExamAvailability } from '../_lib/examSecurity.js';

function tokenTtlForExam(exam) {
  const durationSeconds = Math.max(60, Number(exam.duration_minutes || 60) * 60 + 300);
  if (!exam.ends_at) return durationSeconds;
  const secondsUntilEnd = Math.floor((new Date(exam.ends_at).getTime() - Date.now()) / 1000);
  return Math.max(60, Math.min(durationSeconds, secondsUntilEnd + 300));
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;

  const ip = getClientIp(req);
  const rate = checkRateLimit('start-session:' + ip, { limit: 15, windowMs: 60_000 });
  if (!rate.ok) {
    json(res, 429, { error: 'too_many_requests' });
    return;
  }

  const body = req.body || {};
  const cleanExamCode = String(body.examCode || '').trim().toUpperCase();
  const cleanNationalId = normalizeNationalId(body.nationalId);

  if (!/^[A-Z0-9_-]{4,32}$/.test(cleanExamCode)) {
    json(res, 400, { error: 'invalid_exam_code' });
    return;
  }

  if (!validateIranianNationalId(cleanNationalId)) {
    json(res, 400, { error: 'invalid_credentials' });
    return;
  }

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
    if (!availability.ok) {
      json(res, availability.status, { error: availability.error });
      return;
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, grade, class_group_id, status')
      .eq('national_id_hash', hash)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student || student.status !== 'active') {
      json(res, 403, { error: 'invalid_credentials' });
      return;
    }

    const { data: allowedClasses, error: allowedError } = await supabase
      .from('exam_allowed_classes')
      .select('class_group_id')
      .eq('exam_id', exam.id);

    if (allowedError) throw allowedError;
    if (allowedClasses.length > 0 && !allowedClasses.some((row) => row.class_group_id === student.class_group_id)) {
      json(res, 403, { error: 'not_allowed_for_exam' });
      return;
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
      json(res, 409, { error: 'exam_already_finalized' });
      return;
    }

    if (!session) {
      const { data: inserted, error: insertError } = await supabase
        .from('student_exam_sessions')
        .insert({
          exam_id: exam.id,
          student_id: student.id,
          status: 'ongoing',
          client_info: {
            ip,
            userAgent: req.headers['user-agent'] || 'unknown',
          },
        })
        .select('id, status, started_at, submitted_at')
        .single();

      if (insertError) throw insertError;
      session = inserted;
    }

    const token = createStudentSessionToken({
      type: 'student_exam',
      sid: session.id,
      eid: exam.id,
      stid: student.id,
    }, tokenTtlForExam(exam));

    json(res, 200, {
      ok: true,
      token,
      session,
      exam: safeExamForStudent(exam),
      student: {
        id: student.id,
        name: student.full_name,
        grade: student.grade,
      },
    });
  } catch (err) {
    json(res, 500, { error: 'start_session_failed' });
  }
}
