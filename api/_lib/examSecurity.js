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

export function safeExamForStudent(exam) {
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

export function safeQuestionForStudent(question, examQuestion = {}) {
  return {
    id: question.id,
    type: question.type,
    grade: question.grade,
    subject: question.subject,
    title: question.title,
    body: stripTeacherOnlyFields(question.body || {}),
    points: examQuestion.points ?? question.points,
    sectionTitle: examQuestion.section_title || '',
    position: examQuestion.position || 0,
  };
}

export function getExamAvailability(exam, now = new Date()) {
  if (!exam) return { ok: false, status: 404, error: 'exam_not_found' };
  if (['completed', 'archived'].includes(exam.status)) return { ok: false, status: 410, error: 'exam_closed' };
  if (exam.status === 'draft') return { ok: false, status: 403, error: 'exam_not_available' };

  const startsAt = exam.starts_at ? new Date(exam.starts_at) : null;
  const endsAt = exam.ends_at ? new Date(exam.ends_at) : null;

  if (startsAt && now < startsAt) return { ok: false, status: 423, error: 'exam_not_open' };
  if (endsAt && now > endsAt) return { ok: false, status: 410, error: 'exam_closed' };
  return { ok: true };
}
