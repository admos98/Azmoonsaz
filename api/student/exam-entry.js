import { json, requireMethod, getClientIp } from '../_lib/http.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { validateIranianNationalId, normalizeNationalId, nationalIdHash } from '../_lib/crypto.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

function safeExamForEntry(exam) {
  return {
    id: exam.id,
    examCode: exam.exam_code,
    title: exam.title,
    grade: exam.grade,
    subject: exam.subject,
    status: exam.status,
    mode: exam.mode,
    startsAt: exam.starts_at,
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
  };
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;

  const ip = getClientIp(req);
  const rate = checkRateLimit('exam-entry:' + ip, { limit: 20, windowMs: 60_000 });
  if (!rate.ok) {
    json(res, 429, { error: 'too_many_requests' });
    return;
  }

  const { examCode, nationalId } = req.body || {};
  const cleanExamCode = String(examCode || '').trim().toUpperCase();
  const cleanNationalId = normalizeNationalId(nationalId);

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
    if (!exam) {
      json(res, 404, { error: 'exam_not_found' });
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

    json(res, 200, {
      ok: true,
      exam: safeExamForEntry(exam),
      student: {
        id: student.id,
        name: student.full_name,
        grade: student.grade,
      },
    });
  } catch (err) {
    json(res, 500, {
      error: 'backend_not_ready',
      detail: 'Check Supabase env variables and run the schema before using this endpoint.',
    });
  }
}
