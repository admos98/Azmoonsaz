const TEACHER_ONLY_KEYS = new Set([
  'answer_key',
  'answerKey',
  'correctAnswer',
  'correctAnswers',
  'correctFillBlanks',
  'isCorrect',
  'rubrics',
  'sampleAnswer',
  'explanation',
  'gradingGuide',
  'teacherComment',
]);

const QUESTION_BODY_WHITELIST = new Set([
  'text',
  'imageUrl',
  'options',
  'parts',
  'matchingPairs',
  'orderingItems',
]);

const OPTION_WHITELIST = new Set([
  'id',
  'text',
  'imageUrl',
]);

const PART_WHITELIST = new Set([
  'id',
  'text',
  'type',
  'options',
  'imageUrl',
]);

function whitelistObject(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const key of allowedKeys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const result = whitelistObject(body, QUESTION_BODY_WHITELIST);
  if (Array.isArray(result.options)) {
    result.options = result.options.map((o) => whitelistObject(o, OPTION_WHITELIST));
  }
  if (Array.isArray(result.parts)) {
    result.parts = result.parts.map((part) => {
      const clean = whitelistObject(part, PART_WHITELIST);
      if (Array.isArray(clean.options)) {
        clean.options = clean.options.map((o) => whitelistObject(o, OPTION_WHITELIST));
      }
      return clean;
    });
  }
  return result;
}

export function stripTeacherOnlyFields(value) {
  if (Array.isArray(value)) return value.map(stripTeacherOnlyFields);
  if (!value || typeof value !== 'object') return value;

  const cleaned = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (TEACHER_ONLY_KEYS.has(key)) continue;
    cleaned[key] = stripTeacherOnlyFields(childValue);
  }
  return cleaned;
}

export function safeExamForStudent(exam, now = new Date()) {
  return {
    id: exam.id,
    examCode: exam.exam_code,
    title: exam.title,
    grade: exam.grade,
    subject: exam.subject,
    status: deriveExamStatus(exam, now),
    mode: exam.mode,
    startsAt: exam.starts_at,
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
  };
}

export function safeQuestionForStudent(question, examQuestion = {}) {
  return {
    id: question.id,
    type: question.type,
    grade: question.grade,
    subject: question.subject,
    title: question.title,
    body: sanitizeBody(question.body || {}),
    points: examQuestion.points ?? question.points,
    sectionTitle: examQuestion.section_title || '',
    position: examQuestion.position || 0,
  };
}

/**
 * Derive the effective exam status at request time (single source of truth).
 *
 * Stored status only carries teacher intent (draft / scheduled / active /
 * completed / archived). The real state — "is it open right now?" — is a
 * function of the stored intent plus the start/end window, evaluated against
 * the clock on every read so no re-save is ever needed.
 *
 * Timestamps are absolute instants (timestamptz), so the comparison is
 * timezone-independent: Asia/Tehran only matters when the wall-clock input is
 * converted to an instant, which the frontend does via src/utils/tehranClock.
 */
export function deriveExamStatus(exam, now = new Date()) {
  const stored = exam?.status || 'active';
  if (stored === 'draft') return 'draft';
  if (stored === 'archived') return 'archived';
  // Teacher explicitly closed it — that decision wins over the clock.
  if (stored === 'completed') return 'completed';

  const startsAt = exam?.starts_at ? new Date(exam.starts_at) : null;
  const endsAt = exam?.ends_at ? new Date(exam.ends_at) : null;

  if (endsAt && !Number.isNaN(endsAt.getTime()) && now > endsAt) return 'completed';
  if (startsAt && !Number.isNaN(startsAt.getTime()) && now < startsAt) return 'scheduled';
  return 'active';
}

export function getExamAvailability(exam, now = new Date()) {
  if (!exam) return { ok: false, status: 404, error: 'exam_not_found' };

  const status = deriveExamStatus(exam, now);
  if (status === 'completed' || status === 'archived') return { ok: false, status: 410, error: 'exam_closed' };
  if (status === 'draft') return { ok: false, status: 403, error: 'exam_not_available' };
  if (status === 'scheduled') return { ok: false, status: 423, error: 'exam_not_open' };
  return { ok: true };
}
