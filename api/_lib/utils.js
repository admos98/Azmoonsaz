/**
 * Shared API utilities extracted from api/index.js
 */

import { randomInt } from 'node:crypto';
import { stripTeacherOnlyFields, deriveExamStatus, sessionDeadlineMs } from './examSecurity.js';
import { isImageStoreKey } from './imageStore.js';

export function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

export function normalizeStudentStatus(status) {
  return status === 'suspended' ? 'suspended' : 'active';
}

/**
 * BE-5 fix: bound an optional client-supplied text field at the edge (N-07
 * policy). Returns trimmed text capped to `maxChars`, or null when the value
 * is empty/absent — the shape the `students.email` / `students.phone_number`
 * columns expect.
 */
export function boundedOptionalText(value, maxChars) {
  const clean = String(value ?? '').trim().slice(0, maxChars);
  return clean.length > 0 ? clean : null;
}

export function randomExamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  // F-11: join codes are guessable secrets — mint with a CSPRNG, never
  // Math.random (whose state is recoverable from observed outputs).
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
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
    // T7: PIN-set indicator only — the hash never leaves the server, and no
    // select includes it, so pin_set_at (+ the must-change flag) decides alone.
    pinSet: row.pin_set_at != null && row.pin_must_change !== true,
  };
}

export function deriveAnswerKey(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const correctFromOptions = options.filter((o) => o.isCorrect).map((o) => o.id);
  return {
    correctAnswer:
      question.correctAnswer ??
      (question.type === 'multiple_choice' ? correctFromOptions : correctFromOptions[0]),
    correctFillBlanks: question.correctFillBlanks || [],
    rubrics: question.rubrics || [],
    sampleAnswer: question.sampleAnswer,
    explanation: question.explanation,
    gradingGuide: question.gradingGuide,
  };
}

/**
 * Image fields accept exactly three shapes: empty (no image), a
 * provider-agnostic storage key (`<teacherUuid>/<uuid>.webp`), or — only when
 * byte-identical to the stored value — a grandfathered legacy URL (base64 /
 * external https from the old form). Anything else is a 400: the new upload
 * pipeline is the only way fresh pixels enter the database.
 *
 * Cross-tenant guard: a storage key's first segment MUST be the writing
 * teacher's own UUID. A key that merely looks valid but belongs to another
 * tenant is rejected — otherwise a teacher who learns a foreign opaque key
 * (signed URLs expose the path) could attach it and get reads minted for
 * their own students.
 */
function cleanImageField(incoming, existing, teacherId) {
  const next = incoming === undefined || incoming === null ? '' : String(incoming);
  if (next === '') return undefined;
  if (existing !== undefined && next === String(existing)) return String(existing) || undefined;
  if (!isImageStoreKey(next)) {
    const error = new Error('image_must_be_uploaded');
    error.status = 400;
    throw error;
  }
  if (teacherId && !next.startsWith(`${teacherId}/`)) {
    const error = new Error('image_not_owned');
    error.status = 403;
    throw error;
  }
  return next;
}

function cleanOptionImages(options, prevOptions, teacherId) {
  if (!Array.isArray(options)) return undefined;
  const prevById = new Map(
    (Array.isArray(prevOptions) ? prevOptions : [])
      .filter((o) => o && typeof o === 'object')
      .map((o) => [o.id, o.imageUrl]),
  );
  return options.map(({ isCorrect: _isCorrect, ...option }) => ({
    ...option,
    imageUrl: cleanImageField(option.imageUrl, prevById.get(option.id), teacherId),
  }));
}

function cleanPartImages(parts, prevParts, teacherId) {
  if (!Array.isArray(parts)) return undefined;
  const prevById = new Map(
    (Array.isArray(prevParts) ? prevParts : [])
      .filter((p) => p && typeof p === 'object')
      .map((p) => [p.id, p]),
  );
  return parts.map((part) => {
    const { correctAnswer: _correctAnswer, ...rest } = part;
    const prev = prevById.get(part.id) || {};
    return {
      ...rest,
      imageUrl: cleanImageField(rest.imageUrl, prev.imageUrl, teacherId),
      options: cleanOptionImages(part.options, prev.options, teacherId),
    };
  });
}

/**
 * @param {object} question
 * @param {object|null} [existingBody]
 * @param {string|null} [teacherId]
 * @returns {Record<string, any>}
 */
export function questionToBody(question, existingBody = null, teacherId = null) {
  const prev = existingBody && typeof existingBody === 'object' ? existingBody : {};
  // blankCount is NON-SECRET display metadata: the student needs the field
  // count before any answer exists (correctFillBlanks stays server-side).
  // Derived from the author's blank list; capped so a hostile teacher row
  // cannot force a giant form.
  const blankList = Array.isArray(question.correctFillBlanks) ? question.correctFillBlanks : undefined;
  const blankCount =
    question.type === 'fill_blank' && blankList
      ? Math.max(1, Math.min(20, blankList.length))
      : undefined;
  // L3: display metadata rides in body JSONB but comes from free-text drawer
  // fields — trim and cap so one hostile row can't bloat every payload.
  // completenessStatus is a closed enum, not free text — anything else drops.
  const cleanTags = Array.isArray(question.tags)
    ? question.tags
        .map((tag) => String(tag || '').trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 20)
    : undefined;
  const cleanDifficulty =
    question.difficulty === undefined
      ? undefined
      : ['easy', 'medium', 'hard'].includes(question.difficulty)
        ? question.difficulty
        : String(question.difficulty || '').trim().slice(0, 20) || undefined;
  return stripTeacherOnlyFields({
    text: question.text || '',
    imageUrl: cleanImageField(question.imageUrl, prev.imageUrl, teacherId),
    options: cleanOptionImages(question.options, prev.options, teacherId),
    parts: cleanPartImages(question.parts, prev.parts, teacherId),
    matchingPairs: question.matchingPairs,
    orderingItems: question.orderingItems,
    blankCount,
    // Display metadata the teacher fills in the drawer — persisted in body
    // so it survives reload (it used to live only in the client cache,
    // refabricated by row index after every refresh).
    difficulty: cleanDifficulty,
    section: question.section === undefined ? undefined : String(question.section || '').trim().slice(0, 100) || undefined,
    tags: cleanTags,
    completenessStatus:
      question.completenessStatus === 'complete' || question.completenessStatus === 'incomplete'
        ? question.completenessStatus
        : undefined,
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
    options: Array.isArray(body.options)
      ? body.options.map((option) => ({
          ...option,
          isCorrect: Array.isArray(correctAnswer)
            ? correctAnswer.includes(option.id)
            : correctAnswer === option.id,
        }))
      : undefined,
    matchingPairs: body.matchingPairs,
    orderingItems: body.orderingItems,
    correctFillBlanks: key.correctFillBlanks || [],
    correctAnswer: key.correctAnswer,
    imageUrl: body.imageUrl,
    parts: body.parts,
    // Non-secret display count for fill-blank (key stays server-side).
    blankCount: body.blankCount,
    // display metadata (whitelisted in questionToBody, stored in body)
    difficulty: body.difficulty,
    section: body.section,
    tags: body.tags,
    completenessStatus: body.completenessStatus,
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
  if (uuidIds.length > 0) {
    // F-27: the array path must keep the SAME ownership scope as the single
    // path — foreign class ids are dropped, never attached to the exam.
    const { data, error } = await teacher.admin
      .from('class_groups')
      .select('id')
      .eq('teacher_id', teacher.id)
      .in('id', uuidIds);
    if (error) throw error;
    const owned = new Set((data || []).map((row) => row.id));
    const scoped = uuidIds.filter((id) => owned.has(id));
    if (scoped.length > 0) return scoped;
  }
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
      shuffleQuestions: Boolean(settings.shuffleQuestions),
      shuffleOptions: Boolean(settings.shuffleOptions),
      allowBacktrack: settings.allowBacktrack !== false,
      showImmediateResults: Boolean(settings.showImmediateResults),
      maxAttempts: Number(settings.maxAttempts || 1),
      ...settings,
      // The timestamptz columns are the persisted instants and always win
      // over whatever settings string was stored alongside them.
      startTime: row.starts_at,
      endTime: row.ends_at,
    },
    sections,
    questions,
    classGroupIds: row.classGroupIds || [],
    // Derived at read time — never trust the stored value for "is it open?".
    status: deriveExamStatus(row),
    teacherId: row.teacher_id,
    createdAt: row.created_at,
  };
}

export async function hydrateExam(teacher, exam) {
  return (await hydrateExams(teacher, [exam]))[0];
}

/**
 * BE-7 fix: batch hydration for exam lists. The per-exam loop used to fire
 * 2-3 serial queries per exam (N+1); this issues three queries total for the
 * whole list and stitches the results in memory. `hydrateExam` delegates here
 * for a single exam, so both paths share one implementation.
 */
export async function hydrateExams(teacher, exams) {
  const list = Array.isArray(exams) ? exams : [];
  if (list.length === 0) return [];
  const examIds = list.map((exam) => exam.id);

  const [{ data: allowedRows }, { data: examQuestionRows }] = await Promise.all([
    teacher.admin
      .from('exam_allowed_classes')
      .select('exam_id, class_group_id')
      .in('exam_id', examIds),
    teacher.admin
      .from('exam_questions')
      .select('exam_id, question_id, section_title, position, points')
      .in('exam_id', examIds)
      .order('position', { ascending: true }),
  ]);

  const classesByExam = new Map();
  for (const row of allowedRows || []) {
    if (!classesByExam.has(row.exam_id)) classesByExam.set(row.exam_id, []);
    classesByExam.get(row.exam_id).push(row.class_group_id);
  }

  const eqByExam = new Map();
  const questionIdSet = new Set();
  for (const row of examQuestionRows || []) {
    questionIdSet.add(row.question_id);
    if (!eqByExam.has(row.exam_id)) eqByExam.set(row.exam_id, []);
    eqByExam.get(row.exam_id).push(row);
  }

  // F-26: belt to the create-side ownership gate — never read keys for a
  // question that is not this teacher's, even if a row slipped through.
  const questionIds = [...questionIdSet];
  let questionRows = [];
  if (questionIds.length > 0) {
    const { data } = await teacher.admin
      .from('questions')
      .select('id, type, grade, subject, title, body, answer_key, points, created_at')
      .eq('teacher_id', teacher.id)
      .in('id', questionIds);
    questionRows = data || [];
  }
  const questionById = new Map(questionRows.map((q) => [q.id, mapQuestion(q)]));

  return list.map((exam) => {
    const classGroupIds = classesByExam.get(exam.id) || [];
    const eqRows = eqByExam.get(exam.id) || [];
    const questions = eqRows
      .map((row) => questionById.get(row.question_id))
      .filter(Boolean);
    const sectionsByTitle = new Map();
    for (const row of eqRows) {
      const title = row.section_title || 'سوالات آزمون';
      if (!sectionsByTitle.has(title))
        sectionsByTitle.set(title, { id: title, title, questionIds: [] });
      sectionsByTitle.get(title).questionIds.push(row.question_id);
    }
    return mapExam({ ...exam, classGroupIds }, questions, [...sectionsByTitle.values()]);
  });
}

export function tokenTtlForExam(exam) {
  const durationSeconds = Math.max(60, Number(exam.duration_minutes || 60) * 60 + 300);
  if (!exam.ends_at) return durationSeconds;
  const secondsUntilEnd = Math.floor((new Date(exam.ends_at).getTime() - Date.now()) / 1000);
  return Math.max(60, Math.min(durationSeconds, secondsUntilEnd + 300));
}

/**
 * TTL for a student session token, anchored to the session's own clock
 * (started_at + duration + grace). Re-joining can never mint a token that
 * outlives the personal window (F-02).
 */
export function tokenTtlForSession(exam, session, now = Date.now()) {
  const baseTtl = tokenTtlForExam(exam);
  const deadlineMs = sessionDeadlineMs(session, exam);
  if (!Number.isFinite(deadlineMs)) return baseTtl;
  const remainingSeconds = Math.floor((deadlineMs - now) / 1000);
  return Math.max(60, Math.min(baseTtl, remainingSeconds));
}

export async function requireOwnedSession(teacher, sessionId) {
  const { data: session, error: sessionError } = await teacher.admin
    .from('student_exam_sessions')
    .select('id, exam_id, student_id, status')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError || !session) return { error: sessionError || new Error('missing session') };
  const { data: exam, error: examError } = await teacher.admin
    .from('exams')
    .select('id')
    .eq('id', session.exam_id)
    .eq('teacher_id', teacher.id)
    .maybeSingle();
  if (examError || !exam) return { error: examError || new Error('exam not owned') };
  return { session };
}
