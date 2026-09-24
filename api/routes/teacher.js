import { json, requireMethod } from '../_lib/http.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { requireTeacher } from '../_lib/teacherAuth.js';
import { safeError, isUuid, normalizeStudentStatus, randomExamCode, mapStudent, deriveAnswerKey, questionToBody, mapQuestion, extractAnswerPayload, extractGrading, resolveClassGroupId, resolveClassGroupIds, hydrateExam, requireOwnedSession } from '../_lib/utils.js';

async function loadTeacherProfile(teacher) {
  const [{ data: profile, error }, { data: schools, error: schoolsError }, { data: schedule, error: scheduleError }] = await Promise.all([
    teacher.admin.from('teacher_profiles').select('id, full_name, school_name, subject, avatar_url, bio, is_onboarded').eq('id', teacher.id).maybeSingle(),
    teacher.admin.from('teacher_schools').select('id, name, is_primary').eq('teacher_id', teacher.id).order('is_primary', { ascending: false }),
    teacher.admin.from('teacher_schedule').select('id, day_of_week, starts_at, ends_at, school_id, school_name, class_name, subject').eq('teacher_id', teacher.id).order('day_of_week').order('starts_at'),
  ]);
  if (error || schoolsError || scheduleError) {
    // Deployment-safe fallback: authentication must continue to work if the API
    // reaches production a few seconds before the profile migration completes.
    const legacy = await teacher.admin.from('teacher_profiles').select('id, full_name, school_name, subject, is_onboarded').eq('id', teacher.id).maybeSingle();
    if (legacy.error) throw error || schoolsError || scheduleError || legacy.error;
    return {
      id: teacher.id, email: teacher.email, name: legacy.data?.full_name || teacher.email || 'Teacher',
      schoolName: legacy.data?.school_name || '', subject: legacy.data?.subject || '', avatarUrl: '', bio: '',
      isOnboarded: legacy.data?.is_onboarded ?? false, schools: legacy.data?.school_name ? [{ id: 'legacy', name: legacy.data.school_name, isPrimary: true }] : [], schedule: [],
    };
  }
  return {
    id: teacher.id, email: teacher.email, name: profile?.full_name || teacher.email || 'Teacher',
    schoolName: profile?.school_name || '', subject: profile?.subject || '', avatarUrl: profile?.avatar_url || '',
    bio: profile?.bio || '', isOnboarded: profile?.is_onboarded ?? false,
    schools: (schools || []).map((row) => ({ id: row.id, name: row.name, isPrimary: row.is_primary })),
    schedule: (schedule || []).map((row) => ({ id: row.id, day: row.day_of_week, startTime: String(row.starts_at).slice(0, 5), endTime: row.ends_at ? String(row.ends_at).slice(0, 5) : '', schoolId: row.school_id || undefined, schoolName: row.school_name, className: row.class_name, subject: row.subject })),
  };
}

async function handleTeacherMe(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  try { return json(res, 200, { ok: true, teacher: await loadTeacherProfile(teacher) }); }
  catch (error) { return json(res, 500, safeError(error, 'teacher_profile_failed')); }
}

async function handleTeacherProfile(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const subject = String(body.subject || '').trim().slice(0, 200);
  const bio = String(body.bio || '').trim().slice(0, 1000);
  const avatarUrl = String(body.avatarUrl || '').trim().slice(0, 2000);
  const schools = Array.isArray(body.schools) ? body.schools.map((item) => String(item.name || item).trim()).filter(Boolean).slice(0, 20) : [];
  const schedule = Array.isArray(body.schedule) ? body.schedule.slice(0, 100) : [];
  if (!name) return json(res, 400, { error: 'missing_teacher_name' });
  try {
    const { error: profileError } = await teacher.admin.from('teacher_profiles').update({ full_name: name, subject, bio, avatar_url: avatarUrl || null, school_name: schools[0] || '' }).eq('id', teacher.id);
    if (profileError) throw profileError;
    // Schedule references schools, so remove it before replacing school rows.
    const { error: scheduleDeleteError } = await teacher.admin.from('teacher_schedule').delete().eq('teacher_id', teacher.id);
    if (scheduleDeleteError) throw scheduleDeleteError;
    const { error: schoolDeleteError } = await teacher.admin.from('teacher_schools').delete().eq('teacher_id', teacher.id);
    if (schoolDeleteError) throw schoolDeleteError;
    let insertedSchools = [];
    if (schools.length) {
      const result = await teacher.admin.from('teacher_schools').insert(schools.map((schoolName, index) => ({ teacher_id: teacher.id, name: schoolName, is_primary: index === 0 }))).select('id, name, is_primary');
      if (result.error) throw result.error;
      insertedSchools = result.data || [];
    }
    if (schedule.length) {
      const schoolIdByName = new Map(insertedSchools.map((school) => [school.name, school.id]));
      const rows = schedule.map((item) => ({
        teacher_id: teacher.id, day_of_week: Math.max(0, Math.min(6, Number(item.day) || 0)),
        starts_at: item.startTime || '08:00', ends_at: item.endTime || null,
        school_id: schoolIdByName.get(String(item.schoolName || '')) || null,
        school_name: String(item.schoolName || '').slice(0, 160), class_name: String(item.className || '').slice(0, 160),
        subject: String(item.subject || subject).slice(0, 200),
      }));
      const { error: scheduleError } = await teacher.admin.from('teacher_schedule').insert(rows);
      if (scheduleError) throw scheduleError;
    }
    // Return through a shared data helper. Never clone/spread IncomingMessage.
    return json(res, 200, { ok: true, teacher: await loadTeacherProfile(teacher) });
  } catch (error) {
    return json(res, 400, safeError(error, 'teacher_profile_update_failed'));
  }
}

async function handleTeacherClasses(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin.from('class_groups').select('id, name, grade').eq('teacher_id', teacher.id).order('created_at', { ascending: false });
    if (error) return json(res, 500, { error: 'classes_fetch_failed' });
    return json(res, 200, { ok: true, classes: (data || []).map((row) => ({ id: row.id, name: row.name, grade: row.grade, studentCount: 0 })) });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  if (action === 'create') {
    const name = String(body.name || '').trim();
    const grade = String(body.grade || '').trim();
    if (!name) return json(res, 400, { error: 'missing_class_name' });
    if (!grade) return json(res, 400, { error: 'missing_class_grade' });
    const { data, error } = await teacher.admin.from('class_groups').insert({ teacher_id: teacher.id, name, grade }).select('id, name, grade').single();
    if (error) return json(res, 400, safeError(error, 'class_create_failed'));
    return json(res, 200, { ok: true, classGroup: { id: data.id, name: data.name, grade: data.grade, studentCount: 0 } });
  }
  if (action === 'update') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_class_id' });
    const updates = {};
    if (body.name !== undefined) updates.name = String(body.name || '').trim();
    if (body.grade !== undefined) updates.grade = String(body.grade || '').trim();
    const { data, error } = await teacher.admin.from('class_groups').update(updates).eq('id', id).eq('teacher_id', teacher.id).select('id, name, grade').maybeSingle();
    if (error || !data) return json(res, 400, safeError(error, 'class_update_failed'));
    return json(res, 200, { ok: true, classGroup: { id: data.id, name: data.name, grade: data.grade, studentCount: 0 } });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_class_id' });
    const { error } = await teacher.admin.from('class_groups').delete().eq('id', id).eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'class_delete_failed'));
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
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
    const { normalizeNationalId, nationalIdHash, validateIranianNationalId } = await import('../_lib/crypto.js');
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
      const { normalizeNationalId, nationalIdHash, validateIranianNationalId } = await import('../_lib/crypto.js');
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
      const requestedCode = exam.examCode || randomExamCode();
      let data = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = attempt === 0 ? requestedCode : randomExamCode();
        const payload = { teacher_id: teacher.id, exam_code: code, title: exam.title, grade: String(exam.grade || ''), subject: String(exam.subject || ''), status: exam.status || 'draft', mode: exam.settings?.mode || 'official', starts_at: exam.settings?.startTime || null, ends_at: exam.settings?.endTime || null, duration_minutes: Number(exam.duration || exam.settings?.durationMinutes || 45), settings };
        const result = await teacher.admin.from('exams').insert(payload).select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at').single();
        if (!result.error) { data = result.data; break; }
        lastError = result.error;
        if (result.error.code !== '23505') throw result.error;
      }
      if (!data) throw lastError || new Error('exam_create_failed_after_retries');
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

export {
  handleTeacherMe, handleTeacherProfile, handleTeacherClasses, handleTeacherStudents, handleTeacherSummary,
  handleTeacherQuestions, handleTeacherExams, handleTeacherSubmissions,
  handleTeacherGradeAnswer, handleTeacherFinalizeSubmission,
};
