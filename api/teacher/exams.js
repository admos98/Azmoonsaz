import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function randomExamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
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
    createdAt: row.created_at,
  };
}

async function resolveClassGroupIds(teacher, rawIds, grade) {
  const ids = Array.isArray(rawIds) ? rawIds : [];
  const uuidIds = ids.filter(isUuid);
  if (uuidIds.length > 0) return uuidIds;

  const cleanGrade = String(grade || 'نامشخص');
  const { data: existing, error } = await teacher.admin
    .from('class_groups')
    .select('id')
    .eq('teacher_id', teacher.id)
    .eq('grade', cleanGrade)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing?.id) return [existing.id];

  const { data: created, error: createError } = await teacher.admin
    .from('class_groups')
    .insert({ teacher_id: teacher.id, name: 'Default Class ' + cleanGrade, grade: cleanGrade })
    .select('id')
    .single();
  if (createError) throw createError;
  return [created.id];
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

async function listExams(teacher, res) {
  const { data, error } = await teacher.admin
    .from('exams')
    .select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false });

  if (error) return json(res, 500, safeError(error, 'exams_fetch_failed'));
  const exams = [];
  for (const exam of data || []) exams.push(await hydrateExam(teacher, exam));
  json(res, 200, { ok: true, exams });
}

async function createExam(teacher, res, exam) {
  try {
    const classIds = await resolveClassGroupIds(teacher, exam.classGroupIds, exam.grade);
    const settings = { ...(exam.settings || {}), description: exam.description || '' };
    const payload = {
      teacher_id: teacher.id,
      exam_code: exam.examCode || randomExamCode(),
      title: exam.title,
      grade: String(exam.grade || ''),
      subject: String(exam.subject || ''),
      status: exam.status || 'draft',
      mode: exam.settings?.mode || 'official',
      starts_at: exam.settings?.startTime || null,
      ends_at: exam.settings?.endTime || null,
      duration_minutes: Number(exam.duration || exam.settings?.durationMinutes || 45),
      settings,
    };

    const { data, error } = await teacher.admin
      .from('exams')
      .insert(payload)
      .select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at')
      .single();
    if (error) throw error;

    if (classIds.length) {
      await teacher.admin.from('exam_allowed_classes').insert(classIds.map((id) => ({ exam_id: data.id, class_group_id: id })));
    }

    const questions = Array.isArray(exam.questions) ? exam.questions.filter((q) => isUuid(q.id)) : [];
    if (questions.length > 0) {
      await teacher.admin.from('exam_questions').insert(questions.map((q, index) => ({
        exam_id: data.id,
        question_id: q.id,
        section_title: exam.sections?.[0]?.title || 'سوالات آزمون',
        position: index + 1,
        points: q.points || null,
      })));
    }

    json(res, 200, { ok: true, exam: await hydrateExam(teacher, data) });
  } catch (error) {
    json(res, 400, safeError(error, 'exam_create_failed'));
  }
}

async function updateExam(teacher, res, body) {
  const id = String(body.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_exam_id' });
  const exam = body.exam || body;
  const settings = { ...(exam.settings || {}), description: exam.description || '' };
  const updates = {
    title: exam.title,
    grade: exam.grade,
    subject: exam.subject,
    status: exam.status,
    mode: exam.settings?.mode,
    starts_at: exam.settings?.startTime || null,
    ends_at: exam.settings?.endTime || null,
    duration_minutes: Number(exam.duration || exam.settings?.durationMinutes || 45),
    settings,
  };
  Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

  const { data, error } = await teacher.admin
    .from('exams')
    .update(updates)
    .eq('id', id)
    .eq('teacher_id', teacher.id)
    .select('id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at')
    .maybeSingle();
  if (error || !data) return json(res, 400, safeError(error, 'exam_update_failed'));
  json(res, 200, { ok: true, exam: await hydrateExam(teacher, data) });
}

async function deleteExam(teacher, res, body) {
  const id = String(body.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_exam_id' });
  const { error } = await teacher.admin.from('exams').delete().eq('id', id).eq('teacher_id', teacher.id);
  if (error) return json(res, 400, safeError(error, 'exam_delete_failed'));
  json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') return listExams(teacher, res);
  const body = req.body || {};
  const action = body.action || 'create';
  if (action === 'create') return createExam(teacher, res, body.exam || body);
  if (action === 'update') return updateExam(teacher, res, body);
  if (action === 'delete') return deleteExam(teacher, res, body);
  json(res, 400, { error: 'unknown_action' });
}
