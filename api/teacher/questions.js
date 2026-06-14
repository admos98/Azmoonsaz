import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';
import { stripTeacherOnlyFields } from '../_lib/examSecurity.js';

function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
}

function deriveAnswerKey(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const correctFromOptions = options.filter((o) => o.isCorrect).map((o) => o.id);
  const answerKey = {
    correctAnswer: question.correctAnswer ?? (question.type === 'multiple_choice' ? correctFromOptions : correctFromOptions[0]),
    correctFillBlanks: question.correctFillBlanks || [],
    rubrics: question.rubrics || [],
    sampleAnswer: question.sampleAnswer,
    explanation: question.explanation,
    gradingGuide: question.gradingGuide,
  };
  return answerKey;
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

  const options = Array.isArray(body.options)
    ? body.options.map((option) => ({
        ...option,
        isCorrect: Array.isArray(correctAnswer) ? correctAnswer.includes(option.id) : correctAnswer === option.id,
      }))
    : undefined;

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    text: body.text || '',
    points: Number(row.points || 0),
    category: row.subject,
    grade: row.grade,
    options,
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

async function listQuestions(teacher, res) {
  const { data, error } = await teacher.admin
    .from('questions')
    .select('id, type, grade, subject, title, body, answer_key, points, created_at')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false });

  if (error) return json(res, 500, safeError(error, 'questions_fetch_failed'));
  json(res, 200, { ok: true, questions: (data || []).map(mapQuestion) });
}

async function createQuestion(teacher, res, question) {
  const payload = {
    teacher_id: teacher.id,
    type: question.type,
    grade: String(question.grade || '').trim(),
    subject: String(question.category || question.subject || '').trim(),
    title: String(question.title || question.text || 'Untitled question').slice(0, 160),
    body: questionToBody(question),
    answer_key: deriveAnswerKey(question),
    points: Number(question.points || 1),
  };

  const { data, error } = await teacher.admin
    .from('questions')
    .insert(payload)
    .select('id, type, grade, subject, title, body, answer_key, points, created_at')
    .single();

  if (error) return json(res, 400, safeError(error, 'question_create_failed'));
  json(res, 200, { ok: true, question: mapQuestion(data) });
}

async function updateQuestion(teacher, res, question) {
  const id = String(question.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_question_id' });

  const updates = {
    type: question.type,
    grade: String(question.grade || '').trim(),
    subject: String(question.category || question.subject || '').trim(),
    title: String(question.title || question.text || 'Untitled question').slice(0, 160),
    body: questionToBody(question),
    answer_key: deriveAnswerKey(question),
    points: Number(question.points || 1),
  };

  const { data, error } = await teacher.admin
    .from('questions')
    .update(updates)
    .eq('id', id)
    .eq('teacher_id', teacher.id)
    .select('id, type, grade, subject, title, body, answer_key, points, created_at')
    .maybeSingle();

  if (error || !data) return json(res, 400, safeError(error, 'question_update_failed'));
  json(res, 200, { ok: true, question: mapQuestion(data) });
}

async function deleteQuestion(teacher, res, body) {
  const id = String(body.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_question_id' });

  const { error } = await teacher.admin
    .from('questions')
    .delete()
    .eq('id', id)
    .eq('teacher_id', teacher.id);

  if (error) return json(res, 400, safeError(error, 'question_delete_failed'));
  json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  if (req.method === 'GET') return listQuestions(teacher, res);

  const body = req.body || {};
  const action = body.action || 'create';
  if (action === 'create') return createQuestion(teacher, res, body.question || body);
  if (action === 'update') return updateQuestion(teacher, res, body.question || body);
  if (action === 'delete') return deleteQuestion(teacher, res, body);
  json(res, 400, { error: 'unknown_action' });
}
