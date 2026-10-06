import crypto from 'node:crypto';

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
  // F-05: `orderingItems` / `matchingPairs` are the canonical correct
  // order/mapping — never sent to students. When a student UI needs them,
  // send a per-session scrambled copy and keep the canonical key server-side.
]);

const OPTION_WHITELIST = new Set(['id', 'text', 'imageUrl']);

const PART_WHITELIST = new Set(['id', 'text', 'type', 'options', 'imageUrl']);

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
  if (status === 'completed' || status === 'archived')
    return { ok: false, status: 410, error: 'exam_closed' };
  if (status === 'draft') return { ok: false, status: 403, error: 'exam_not_available' };
  if (status === 'scheduled') return { ok: false, status: 423, error: 'exam_not_open' };
  return { ok: true };
}

// --- Student session time window (F-02) ---

/** Grace after any hard deadline so flush/submit can still land (mirrors the token TTL grace). */
export const SESSION_GRACE_MS = 5 * 60 * 1000;

/**
 * Absolute end of an in-progress session: started_at + duration (+ grace).
 * The session's own clock — re-joining never resets it.
 */
export function sessionDeadlineMs(session, exam, { grace = true } = {}) {
  const startedMs = Date.parse(session?.started_at || '');
  if (!Number.isFinite(startedMs)) return Number.NaN;
  const durationMs = Math.max(1, Number(exam?.duration_minutes) || 60) * 60_000;
  return startedMs + durationMs + (grace ? SESSION_GRACE_MS : 0);
}

/**
 * Availability with end-of-window grace: students whose exam window just
 * closed keep SESSION_GRACE_MS to flush/submit. Teacher intent (stored
 * completed/archived/draft) and the not-yet-open window stay strict.
 */
export function getExamAvailabilityWithGrace(exam, now = new Date()) {
  const strict = getExamAvailability(exam, now);
  if (strict.ok || strict.error !== 'exam_closed') return strict;
  if (exam?.status === 'completed' || exam?.status === 'archived') return strict;
  const endsMs = Date.parse(exam?.ends_at || '');
  if (!Number.isFinite(endsMs) || now.getTime() > endsMs + SESSION_GRACE_MS) return strict;
  return { ok: true };
}

/** Personal window check for an in-progress session (grace included). */
export function getSessionTimeWindow(session, exam, now = new Date()) {
  const deadlineMs = sessionDeadlineMs(session, exam);
  if (!Number.isFinite(deadlineMs)) return { ok: false, status: 422, error: 'session_invalid' };
  if (now.getTime() > deadlineMs) return { ok: false, status: 410, error: 'exam_time_expired' };
  return { ok: true };
}

// --- Student answer sanitization (F-01) ---

const MAX_ANSWER_VALUE_CHARS = 4000;
const MAX_ANSWER_ITEMS = 200;

/**
 * Students may write `{ value }` and nothing else. Server-side grading state
 * (`__grading`, comments, correctness flags) is teacher-owned and is stripped
 * here so a client can never forge a score through save-answer.
 */
export function sanitizeStudentAnswer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const { value } = raw;
  if (typeof value === 'string') return { value: value.slice(0, MAX_ANSWER_VALUE_CHARS) };
  if (typeof value === 'number') return Number.isFinite(value) ? { value } : {};
  if (typeof value === 'boolean') return { value };
  if (Array.isArray(value)) {
    const items = value
      .filter(
        (item) => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)),
      )
      .slice(0, MAX_ANSWER_ITEMS)
      .map((item) => (typeof item === 'string' ? item.slice(0, MAX_ANSWER_VALUE_CHARS) : item));
    return { value: items };
  }
  return {};
}

// --- Session-seeded display shuffles (F-05) ---

/** Deterministic PRNG (mulberry32) seeded from sha256 of the given seed. */
function seededRandom(seed) {
  let a = crypto.createHash('sha256').update(String(seed)).digest().readUInt32BE(0);
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledArray(array, random) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Enforce the teacher's shuffle flags server-side on the student payload.
 * Seeded per (session, question): a reload yields the same order, different
 * students get different orders, and answers stay keyed by id so grading is
 * order-independent. Flags live in `exams.settings`.
 */
export function applyExamShuffles(questions, exam, sessionId) {
  const settings = exam && typeof exam === 'object' && exam.settings ? exam.settings : {};
  let result = Array.isArray(questions) ? questions.slice() : questions;
  if (settings.shuffleQuestions && Array.isArray(result) && result.length > 1) {
    result = shuffledArray(result, seededRandom(`${sessionId}|questions`));
  }
  if (settings.shuffleOptions && Array.isArray(result)) {
    result = result.map((question) => {
      const options = question?.body?.options;
      if (!Array.isArray(options) || options.length < 2) return question;
      return {
        ...question,
        body: {
          ...question.body,
          options: shuffledArray(options, seededRandom(`${sessionId}|options|${question.id}`)),
        },
      };
    });
  }
  return result;
}
