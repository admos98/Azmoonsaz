/**
 * Shared API utilities extracted from api/index.js
 */

import { stripTeacherOnlyFields } from './examSecurity.js';

export function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export function normalizeStudentStatus(status) {
  return status === 'suspended' ? 'suspended' : 'active';
}

export function randomExamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function maskFromLast4(last4) {
  return '***' + String(last4 || '').padStart(4, '*');
}

export function mapStudent(row) {
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

export function deriveAnswerKey(question) {
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

export function questionToBody(question) {
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

export function mapQuestion(row) {
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

export function extractAnswerPayload(answerJson) {
  if (!answerJson || typeof answerJson !== 'object') return answerJson;
  if (Object.prototype.hasOwnProperty.call(answerJson, 'value')) return answerJson.value;
  return answerJson;
}

export function extractGrading(answerJson) {
  const grading = answerJson && typeof answerJson === 'object' ? answerJson.__grading || {} : {};
  return {
    scoreGained: typeof grading.scoreGained === 'number' ? grading.scoreGained : undefined,
    teacherComment: grading.teacherComment || undefined,
    isCorrect: typeof grading.isCorrect === 'boolean' ? grading.isCorrect : undefined,
  };
}

// --- Teacher-only shared helpers ---

export async function resolveClassGroupId(teacher, rawClassGroupId, grade) {
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

export async function resolveClassGroupIds(teacher, rawIds, grade) {
  const ids = Array.isArray(rawIds) ? rawIds : [];
  const uuidIds = ids.filter(isUuid);
  if (uuidIds.length > 0) return uuidIds;
  return [await resolveClassGroupId(teacher, ids[0], grade)];
}

export function mapExam(row, questions = [], sections = []) {
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

export async function hydrateExam(teacher, exam) {
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

export function tokenTtlForExam(exam) {
  const durationSeconds = Math.max(60, Number(exam.duration_minutes || 60) * 60 + 300);
  if (!exam.ends_at) return durationSeconds;
  const secondsUntilEnd = Math.floor((new Date(exam.ends_at).getTime() - Date.now()) / 1000);
  return Math.max(60, Math.min(durationSeconds, secondsUntilEnd + 300));
}

export async function requireOwnedSession(teacher, sessionId) {
  const { data: session, error: sessionError } = await teacher.admin.from('student_exam_sessions').select('id, exam_id, student_id, status').eq('id', sessionId).maybeSingle();
  if (sessionError || !session) return { error: sessionError || new Error('missing session') };
  const { data: exam, error: examError } = await teacher.admin.from('exams').select('id').eq('id', session.exam_id).eq('teacher_id', teacher.id).maybeSingle();
  if (examError || !exam) return { error: examError || new Error('exam not owned') };
  return { session };
}
