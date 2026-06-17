import { json, requireMethod, getClientIp } from './_lib/http.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { validateIranianNationalId, normalizeNationalId, nationalIdHash, maskNationalId } from './_lib/crypto.js';
import { getSupabaseAdmin, getSupabaseConfigStatus } from './_lib/supabaseAdmin.js';
import { createStudentSessionToken, verifyStudentSessionToken } from './_lib/studentSession.js';
import { getBearerToken } from './_lib/auth.js';
import { safeExamForStudent, safeQuestionForStudent, getExamAvailability, stripTeacherOnlyFields } from './_lib/examSecurity.js';
import { requireTeacher } from './_lib/teacherAuth.js';

function routePath(req) {
  // Vercel usually provides req.query.path for api/[...path].js,
  // but depending on dev/prod routing it can be missing. Fall back to req.url.
  const value = req.query?.path;
  if (Array.isArray(value) && value.length > 0) return value.join('/').replace(/^\/+|\/+$/g, '');
  if (typeof value === 'string' && value.length > 0) return value.replace(/^\/+|\/+$/g, '');

  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname || '');
    pathname = pathname.replace(/^\/api\/?/, '');
    pathname = pathname.replace(/^\/+|\/+$/g, '');
    return pathname;
  } catch {
    return '';
  }
}

function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeStudentStatus(status) {
  return status === 'suspended' ? 'suspended' : 'active';
}

function randomExamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function maskFromLast4(last4) {
  return '***' + String(last4 || '').padStart(4, '*');
}

function mapStudent(row) {
  return {
    id: row.id,
    name: row.full_name,
    nationalId: '',
    maskedNationalId: maskFromLast4(row.national_id_last4),
    grade: row.grade,
    classGroupId: row.class_group_id || '',
    email: row.email || undefined,
    phoneNumber: row.phone_number || undefined,
    status: row.status || 'active',
  };
}

function deriveAnswerKey(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const correctFromOptions = options.filter((o) => o.isCorrect).map((o) => o.id);
  return {
    correctAnswer: question.correctAnswer ?? (question.type === 'multiple_choice' ? correctFromOptions : correctFromOptions[0]),
    correctFillBlanks: question.correctFillBlanks || [],
    rubrics: question.rubrics || [],
    sampleAnswer: question.sampleAnswer,
    explanation: question.explanation,
    gradingGuide: question.gradingGuide,
  };
}

function questionToBody(question) {
  const cleanOptions = Array.isArray(question.options)
    ? question.options.map(({ isCorrect, ...option }) => option)
    : undefined;
  const cleanParts = Array.isArray(question.parts)
    ? question.parts.map((part) => {
        const { correctAnswer, ...rest } = part;
        return {
          ...rest,
          options: Array.isArray(part.options) ? part.options.map(({ isCorrect, ...option }) => option) : part.options,
        };
      })
    : undefined;
  return stripTeacherOnlyFields({
    text: question.text || '',
    imageUrl: question.imageUrl,
    options: cleanOptions,
    parts: cleanParts,
    matchingPairs: question.matchingPairs,
    orderingItems: question.orderingItems,
  });
}

function mapQuestion(row) {
  const body = row.body || {};
  const key = row.answer_key || {};
  const correctAnswer = key.correctAnswer;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    text: body.text || '',
    points: Number(row.points || 0),
    category: row.subject,
    grade: row.grade,
    options: Array.isArray(body.options) ? body.options.map((option) => ({
      ...option,
      isCorrect: Array.isArray(correctAnswer) ? correctAnswer.includes(option.id) : correctAnswer === option.id,
    })) : undefined,
    matchingPairs: body.matchingPairs,
    orderingItems: body.orderingItems,
    correctFillBlanks: key.correctFillBlanks || [],
    correctAnswer: key.correctAnswer,
    imageUrl: body.imageUrl,
    parts: body.parts,
    rubrics: key.rubrics || [],
    sampleAnswer: key.sampleAnswer,
    explanation: key.explanation,
    gradingGuide: key.gradingGuide,
    createdAt: row.created_at,
  };
}

function extractAnswerPayload(answerJson) {
  if (!answerJson || typeof answerJson !== 'object') return answerJson;
  if (Object.prototype.hasOwnProperty.call(answerJson, 'value')) return answerJson.value;
  return answerJson;
}

function extractGrading(answerJson) {
  const grading = answerJson && typeof answerJson === 'object' ? answerJson.__grading || {} : {};
  return {
    scoreGained: typeof grading.scoreGained === 'number' ? grading.scoreGained : undefined,
    teacherComment: grading.teacherComment || undefined,
    isCorrect: typeof grading.isCorrect === 'boolean' ? grading.isCorrect : undefined,
  };
}

async function resolveClassGroupId(teacher, rawClassGroupId, grade) {
  const cleanGrade = String(grade || '').trim() || 'نامشخص';
  if (rawClassGroupId && isUuid(rawClassGroupId)) {
    const { data, error } = await teacher.admin
      .from('class_groups')
      .select('id')
      .eq('id', rawClassGroupId)
      .eq('teacher_id', teacher.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }
  const { data: existing, error: existingError } = await teacher.admin
    .from('class_groups')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('grade', cleanGrade)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id;
  const { data: created, error: createError } = await teacher.admin
    .from('class_groups')
    .insert({ teacher_id: teacher.id, name: 'Default Class ' + cleanGrade, grade: cleanGrade })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

async function resolveClassGroupIds(teacher, rawIds, grade) {
  const ids = Array.isArray(rawIds) ? rawIds : [];
  const uuidIds = ids.filter(isUuid);
  if (uuidIds.length > 0) return uuidIds;
  return [await resolveClassGroupId(teacher, ids[0], grade)];
}

function mapExam(row, questions = [], sections = []) {
  const settings = row.settings || {};
  return {
    id: row.id,
    examCode: row.exam_code,
    title: row.title,
    description: settings.description || '',
    grade: row.grade,
    subject: row.subject,
    duration: row.duration_minutes,
    settings: {
      mode: row.mode,
      durationMinutes: row.duration_minutes,
      startTime: row.starts_at,
      endTime: row.ends_at,
      shuffleQuestions: Boolean(settings.shuffleQuestions),
      shuffleOptions: Boolean(settings.shuffleOptions),
      allowBacktrack: settings.allowBacktrack !== false,
      showImmediateResults: Boolean(settings.showImmediateResults),
      maxAttempts: Number(settings.maxAttempts || 1),
      ...settings,
    },
    sections,
    questions,
    classGroupIds: row.classGroupIds || [],
    status: row.status,
    teacherId: row.teacher_id,
    createdAt: row.created_at,
  };
}

async function hydrateExam(teacher, exam) {
  const { data: allowed } = await teacher.admin
    .from('exam_allowed_classes')
    .select('class_group_id')
    .eq('exam_id', exam.id);
  exam.classGroupIds = (allowed || []).map((row) => row.class_group_id);

  const { data: examQuestions } = await teacher.admin
    .from('exam_questions')
    .select('question_id, section_title, position, points')
    .eq('exam_id', exam.id)
    .order('position', { ascending: true });
  const questionIds = (examQuestions || []).map((row) => row.question_id);
  let questions = [];
  if (questionIds.length > 0) {
    const { data } = await teacher.admin
      .from('questions')
      .select('id, type, grade, subject, title, body, answer_key, points, created_at')
      .in('id', questionIds);
    const byId = new Map((data || []).map((q) => [q.id, mapQuestion(q)]));
    questions = questionIds.map((id) => byId.get(id)).filter(Boolean);
  }
  const sectionsByTitle = new Map();
  for (const row of examQuestions || []) {
    const title = row.section_title || 'سوالات آزمون';
    if (!sectionsByTitle.has(title)) sectionsByTitle.set(title, { id: title, title, questionIds: [] });
    sectionsByTitle.get(title).questionIds.push(row.question_id);
  }
  return mapExam(exam, questions, [...sectionsByTitle.values()]);
}

async function handleHealth(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  json(res, 200, { ok: true, service: 'azmoonsaz-api', timestamp: new Date().toISOString() });
}

async function handleSecurityCheck(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const supabase = getSupabaseConfigStatus();
  json(res, 200, {
    ok: true,
    checks: {
      hasSupabaseUrl: supabase.hasUrl,
      hasSupabaseAnonKey: supabase.hasAnonKey,
      hasServiceRoleKey: supabase.hasServiceRoleKey,
      hasStudentIdPepper: Boolean(process.env.STUDENT_ID_PEPPER && process.env.STUDENT_ID_PEPPER.length >= 32),
    },
    warning: 'This endpoint reports only boolean configuration status. It never returns secret values.',
  });
}

async function handleStudentIdDemo(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const { nationalId } = req.body || {};
  const normalized = normalizeNationalId(nationalId);
  if (!validateIranianNationalId(normalized)) return json(res, 400, { error: 'invalid_national_id' });
  try {
    json(res, 200, { ok: true, masked: maskNationalId(normalized), hashPreview: nationalIdHash(normalized).slice(0, 12) + '...' });
  } catch {
    json(res, 500, { error: 'server_secret_not_configured' });
  }
}

function tokenTtlForExam(exam) {
  const durationSeconds = Math.max(60, Number(exam.duration_minutes || 60) * 60 + 300);
  if (!exam.ends_at) return durationSeconds;
  const secondsUntilEnd = Math.floor((new Date(exam.ends_at).getTime() - Date.now()) / 1000);
  return Math.max(60, Math.min(durationSeconds, secondsUntilEnd + 300));
}

async function handleStudentStartSession(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const ip = getClientIp(req);
  const rate = checkRateLimit('start-session:' + ip, { limit: 15, windowMs: 60_000 });
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
  const token = getBearerToken(req, req.body || {});
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
  const token = getBearerToken(req, body);
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
  const token = getBearerToken(req, req.body || {});
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

async function handleTeacherMe(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const { data: profile, error } = await teacher.admin.from('teacher_profiles').select('id, full_name, school_name').eq('id', teacher.id).maybeSingle();
  if (error) return json(res, 500, { error: 'teacher_profile_failed' });
  json(res, 200, { ok: true, teacher: { id: teacher.id, email: teacher.email, name: profile?.full_name || teacher.email || 'Teacher', schoolName: profile?.school_name || '' } });
}

async function handleTeacherClasses(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const { data, error } = await teacher.admin.from('class_groups').select('id, name, grade').eq('teacher_id', teacher.id).order('created_at', { ascending: false });
  if (error) return json(res, 500, { error: 'classes_fetch_failed' });
  json(res, 200, { ok: true, classes: (data || []).map((row) => ({ id: row.id, name: row.name, grade: row.grade, studentCount: 0 })) });
}

async function handleTeacherStudents(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin.from('students').select('id, full_name, grade, class_group_id, national_id_last4, status, created_at').eq('teacher_id', teacher.id).order('created_at', { ascending: false });
    if (error) return json(res, 500, safeError(error, 'students_fetch_failed'));
    return json(res, 200, { ok: true, students: (data || []).map(mapStudent) });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  const studentBody = body.student || body;
  if (action === 'create') {
    const name = String(studentBody.name || '').trim();
    const grade = String(studentBody.grade || '').trim();
    const cleanNationalId = normalizeNationalId(studentBody.nationalId);
    if (!name) return json(res, 400, { error: 'missing_student_name' });
    if (!grade) return json(res, 400, { error: 'missing_student_grade' });
    if (!validateIranianNationalId(cleanNationalId)) return json(res, 400, { error: 'invalid_national_id' });
    try {
      const classGroupId = await resolveClassGroupId(teacher, studentBody.classGroupId, grade);
      const { data, error } = await teacher.admin.from('students').insert({ teacher_id: teacher.id, class_group_id: classGroupId, full_name: name, grade, national_id_hash: nationalIdHash(cleanNationalId), national_id_last4: cleanNationalId.slice(-4), status: normalizeStudentStatus(studentBody.status) }).select('id, full_name, grade, class_group_id, national_id_last4, status, created_at').single();
      if (error) return json(res, 400, safeError(error, error.code === '23505' ? 'duplicate_student' : 'student_create_failed'));
      return json(res, 200, { ok: true, student: mapStudent(data) });
    } catch (error) {
      return json(res, 400, safeError(error, 'student_create_failed'));
    }
  }
  if (action === 'update') {
    const id = String(studentBody.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_student_id' });
    try {
      const updates = {};
      if (studentBody.name !== undefined) updates.full_name = String(studentBody.name || '').trim();
      if (studentBody.grade !== undefined) updates.grade = String(studentBody.grade || '').trim();
      if (studentBody.status !== undefined) updates.status = normalizeStudentStatus(studentBody.status);
      if (studentBody.classGroupId !== undefined) updates.class_group_id = await resolveClassGroupId(teacher, studentBody.classGroupId, studentBody.grade || 'نامشخص');
      if (studentBody.nationalId) {
        const cleanNationalId = normalizeNationalId(studentBody.nationalId);
        if (!validateIranianNationalId(cleanNationalId)) return json(res, 400, { error: 'invalid_national_id' });
        updates.national_id_hash = nationalIdHash(cleanNationalId);
        updates.national_id_last4 = cleanNationalId.slice(-4);
      }
      const { data, error } = await teacher.admin.from('students').update(updates).eq('id', id).eq('teacher_id', teacher.id).select('id, full_name, grade, class_group_id, national_id_last4, status, created_at').maybeSingle();
      if (error || !data) return json(res, 400, safeError(error, 'student_update_failed'));
      return json(res, 200, { ok: true, student: mapStudent(data) });
    } catch (error) {
      return json(res, 400, safeError(error, 'student_update_failed'));
    }
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_student_id' });
    const { error } = await teacher.admin.from('students').delete().eq('id', id).eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'student_delete_failed'));
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}

async function handleTeacherSummary(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  async function count(table) {
    const { count } = await teacher.admin.from(table).select('*', { count: 'exact', head: true }).eq('teacher_id', teacher.id);
    return count || 0;
  }
  const [students, exams, questions] = await Promise.all([count('students'), count('exams'), count('questions')]);
  json(res, 200, { ok: true, summary: { students, exams, questions } });
}

async function handleTeacherQuestions(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin.from('questions').select('id, type, grade, subject, title, body, answer_key, points, created_at').eq('teacher_id', teacher.id).order('created_at', { ascending: false });
    if (error) return json(res, 500, safeError(error, 'questions_fetch_failed'));
    return json(res, 200, { ok: true, questions: (data || []).map(mapQuestion) });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  const question = body.question || body;
  if (action === 'create') {
    const payload = { teacher_id: teacher.id, type: question.type, grade: String(question.grade || '').trim(), subject: String(question.category || question.subject || '').trim(), title: String(question.title || question.text || 'Untitled question').slice(0, 160), body: questionToBody(question), answer_key: deriveAnswerKey(question), points: Number(question.points || 1) };
    const { data, error } = await teacher.admin.from('questions').insert(payload).select('id, type, grade, subject, title, body, answer_key, points, created_at').single();
    if (error) return json(res, 400, safeError(error, 'question_create_failed'));
    return json(res, 200, { ok: true, question: mapQuestion(data) });
  }
  if (action === 'update') {
    const id = String(question.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_question_id' });
    const updates = { type: question.type, grade: String(question.grade || '').trim(), subject: String(question.category || question.subject || '').trim(), title: String(question.title || question.text || 'Untitled question').slice(0, 160), body: questionToBody(question), answer_key: deriveAnswerKey(question), points: Number(question.points || 1) };
    const { data, error } = await teacher.admin.from('questions').update(updates).eq('id', id).eq('teacher_id', teacher.id).select('id, type, grade, subject, title, body, answer_key, points, created_at').maybeSingle();
    if (error || !data) return json(res, 400, safeError(error, 'question_update_failed'));
    return json(res, 200, { ok: true, question: mapQuestion(data) });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_question_id' });
    const { error } = await teacher.admin.from('questions').delete().eq('id', id).eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'question_delete_failed'));
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}

async function handleTeacherExams(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin.from('exams').select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at').eq('teacher_id', teacher.id).order('created_at', { ascending: false });
    if (error) return json(res, 500, safeError(error, 'exams_fetch_failed'));
    const exams = [];
    for (const exam of data || []) exams.push(await hydrateExam(teacher, exam));
    return json(res, 200, { ok: true, exams });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  const exam = body.exam || body;
  if (action === 'create') {
    try {
      const classIds = await resolveClassGroupIds(teacher, exam.classGroupIds, exam.grade);
      const settings = { ...(exam.settings || {}), description: exam.description || '' };
      const payload = { teacher_id: teacher.id, exam_code: exam.examCode || randomExamCode(), title: exam.title, grade: String(exam.grade || ''), subject: String(exam.subject || ''), status: exam.status || 'draft', mode: exam.settings?.mode || 'official', starts_at: exam.settings?.startTime || null, ends_at: exam.settings?.endTime || null, duration_minutes: Number(exam.duration || exam.settings?.durationMinutes || 45), settings };
      const { data, error } = await teacher.admin.from('exams').insert(payload).select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at').single();
      if (error) throw error;
      if (classIds.length) await teacher.admin.from('exam_allowed_classes').insert(classIds.map((id) => ({ exam_id: data.id, class_group_id: id })));
      const questions = Array.isArray(exam.questions) ? exam.questions.filter((q) => isUuid(q.id)) : [];
      if (questions.length > 0) await teacher.admin.from('exam_questions').insert(questions.map((q, index) => ({ exam_id: data.id, question_id: q.id, section_title: exam.sections?.[0]?.title || 'سوالات آزمون', position: index + 1, points: q.points || null })));
      return json(res, 200, { ok: true, exam: await hydrateExam(teacher, data) });
    } catch (error) {
      return json(res, 400, safeError(error, 'exam_create_failed'));
    }
  }
  if (action === 'update') {
    const id = String(body.id || exam.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_exam_id' });
    const settings = { ...(exam.settings || {}), description: exam.description || '' };
    const updates = { title: exam.title, grade: exam.grade, subject: exam.subject, status: exam.status, mode: exam.settings?.mode, starts_at: exam.settings?.startTime || null, ends_at: exam.settings?.endTime || null, duration_minutes: Number(exam.duration || exam.settings?.durationMinutes || 45), settings };
    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
    const { data, error } = await teacher.admin.from('exams').update(updates).eq('id', id).eq('teacher_id', teacher.id).select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at').maybeSingle();
    if (error || !data) return json(res, 400, safeError(error, 'exam_update_failed'));
    return json(res, 200, { ok: true, exam: await hydrateExam(teacher, data) });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_exam_id' });
    const { error } = await teacher.admin.from('exams').delete().eq('id', id).eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'exam_delete_failed'));
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}

async function handleTeacherSubmissions(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const examId = String(req.query.examId || '').trim();
  const { data: exams, error: examsError } = await teacher.admin.from('exams').select('id, exam_code').eq('teacher_id', teacher.id);
  if (examsError) return json(res, 500, safeError(examsError, 'teacher_exams_fetch_failed'));
  const allowedExamIds = (exams || []).map((exam) => exam.id);
  if (examId && !allowedExamIds.includes(examId)) return json(res, 403, { error: 'exam_not_owned' });
  const targetExamIds = examId ? [examId] : allowedExamIds;
  if (targetExamIds.length === 0) return json(res, 200, { ok: true, submissions: [] });
  const examCodeById = new Map((exams || []).map((exam) => [exam.id, exam.exam_code]));
  const { data: sessions, error: sessionsError } = await teacher.admin.from('student_exam_sessions').select('id, exam_id, student_id, status, started_at, submitted_at').in('exam_id', targetExamIds).order('started_at', { ascending: false });
  if (sessionsError) return json(res, 500, safeError(sessionsError, 'submissions_fetch_failed'));
  if (!sessions || sessions.length === 0) return json(res, 200, { ok: true, submissions: [] });
  const studentIds = [...new Set(sessions.map((session) => session.student_id))];
  const sessionIds = sessions.map((session) => session.id);
  const { data: students } = await teacher.admin.from('students').select('id, full_name, national_id_last4').in('id', studentIds);
  const studentById = new Map((students || []).map((student) => [student.id, student]));
  const { data: answers, error: answersError } = await teacher.admin.from('student_answers').select('session_id, question_id, answer, updated_at').in('session_id', sessionIds);
  if (answersError) return json(res, 500, safeError(answersError, 'answers_fetch_failed'));
  const answersBySession = new Map();
  for (const row of answers || []) {
    if (!answersBySession.has(row.session_id)) answersBySession.set(row.session_id, []);
    const grading = extractGrading(row.answer);
    answersBySession.get(row.session_id).push({ questionId: row.question_id, answer: extractAnswerPayload(row.answer), ...grading });
  }
  const { data: examQuestions } = await teacher.admin.from('exam_questions').select('exam_id, points').in('exam_id', targetExamIds);
  const maxScoreByExam = new Map();
  for (const row of examQuestions || []) maxScoreByExam.set(row.exam_id, Number(maxScoreByExam.get(row.exam_id) || 0) + Number(row.points || 0));
  const submissions = sessions.map((session) => {
    const student = studentById.get(session.student_id);
    const mappedAnswers = answersBySession.get(session.id) || [];
    const score = mappedAnswers.reduce((sum, answer) => sum + Number(answer.scoreGained || 0), 0);
    return { id: session.id, examId: session.exam_id, examCode: examCodeById.get(session.exam_id) || '', studentId: session.student_id, studentName: student?.full_name || 'Student', nationalId: '', maskedNationalId: student?.national_id_last4 ? '***' + student.national_id_last4 : '***', answers: mappedAnswers, startedAt: session.started_at, submittedAt: session.submitted_at, status: session.status, score, maxScore: Number(maxScoreByExam.get(session.exam_id) || 0) };
  });
  json(res, 200, { ok: true, submissions });
}

async function requireOwnedSession(teacher, sessionId) {
  const { data: session, error: sessionError } = await teacher.admin.from('student_exam_sessions').select('id, exam_id, student_id, status').eq('id', sessionId).maybeSingle();
  if (sessionError || !session) return { error: sessionError || new Error('missing session') };
  const { data: exam, error: examError } = await teacher.admin.from('exams').select('id').eq('id', session.exam_id).eq('teacher_id', teacher.id).maybeSingle();
  if (examError || !exam) return { error: examError || new Error('exam not owned') };
  return { session };
}

async function handleTeacherGradeAnswer(req, res) {
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
  const { data: existing } = await teacher.admin.from('student_answers').select('answer').eq('session_id', sessionId).eq('question_id', questionId).maybeSingle();
  const answer = existing?.answer && typeof existing.answer === 'object' ? existing.answer : {};
  const nextAnswer = { ...answer, __grading: { scoreGained, teacherComment, isCorrect: scoreGained > 0, gradedAt: new Date().toISOString(), gradedBy: teacher.id } };
  const { error: upsertError } = await teacher.admin.from('student_answers').upsert({ session_id: sessionId, question_id: questionId, answer: nextAnswer, updated_at: new Date().toISOString() }, { onConflict: 'session_id,question_id' });
  if (upsertError) return json(res, 500, safeError(upsertError, 'grade_save_failed'));
  json(res, 200, { ok: true });
}

async function handleTeacherFinalizeSubmission(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const sessionId = String((req.body || {}).submissionId || (req.body || {}).sessionId || '').trim();
  if (!sessionId) return json(res, 400, { error: 'missing_submission_id' });
  const owned = await requireOwnedSession(teacher, sessionId);
  if (owned.error) return json(res, 403, safeError(owned.error, 'submission_not_owned'));
  const { data, error } = await teacher.admin.from('student_exam_sessions').update({ status: 'graded' }).eq('id', sessionId).select('id, exam_id, student_id, status, started_at, submitted_at').single();
  if (error) return json(res, 500, safeError(error, 'finalize_failed'));
  json(res, 200, { ok: true, session: data });
}

const routes = {
  'health': handleHealth,
  'security-check': handleSecurityCheck,
  'student-id-demo': handleStudentIdDemo,
  'student/start-session': handleStudentStartSession,
  'student/exam-payload': handleStudentExamPayload,
  'student/save-answer': handleStudentSaveAnswer,
  'student/submit': handleStudentSubmit,
  'teacher/me': handleTeacherMe,
  'teacher/classes': handleTeacherClasses,
  'teacher/students': handleTeacherStudents,
  'teacher/summary': handleTeacherSummary,
  'teacher/questions': handleTeacherQuestions,
  'teacher/exams': handleTeacherExams,
  'teacher/submissions': handleTeacherSubmissions,
  'teacher/grade-answer': handleTeacherGradeAnswer,
  'teacher/finalize-submission': handleTeacherFinalizeSubmission,
};

export default async function handler(req, res) {
  const path = routePath(req);
  if (!path) {
    return json(res, 200, {
      ok: true,
      service: 'azmoonsaz-api',
      message: 'API root. Try /api/health or /api/security-check.',
      routes: Object.keys(routes).sort(),
    });
  }
  const route = routes[path];
  if (!route) return json(res, 404, { error: 'api_route_not_found', path });
  return route(req, res);
}
