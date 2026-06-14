import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
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

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const examId = String(req.query.examId || '').trim();

  const { data: exams, error: examsError } = await teacher.admin
    .from('exams')
    .select('id, exam_code')
    .eq('teacher_id', teacher.id);

  if (examsError) return json(res, 500, safeError(examsError, 'teacher_exams_fetch_failed'));

  const allowedExamIds = (exams || []).map((exam) => exam.id);
  if (examId && !allowedExamIds.includes(examId)) return json(res, 403, { error: 'exam_not_owned' });

  const targetExamIds = examId ? [examId] : allowedExamIds;
  if (targetExamIds.length === 0) return json(res, 200, { ok: true, submissions: [] });

  const examCodeById = new Map((exams || []).map((exam) => [exam.id, exam.exam_code]));

  const { data: sessions, error: sessionsError } = await teacher.admin
    .from('student_exam_sessions')
    .select('id, exam_id, student_id, status, started_at, submitted_at')
    .in('exam_id', targetExamIds)
    .order('started_at', { ascending: false });

  if (sessionsError) return json(res, 500, safeError(sessionsError, 'submissions_fetch_failed'));
  if (!sessions || sessions.length === 0) return json(res, 200, { ok: true, submissions: [] });

  const studentIds = [...new Set(sessions.map((session) => session.student_id))];
  const sessionIds = sessions.map((session) => session.id);

  const { data: students, error: studentsError } = await teacher.admin
    .from('students')
    .select('id, full_name, national_id_last4')
    .in('id', studentIds);

  if (studentsError) return json(res, 500, safeError(studentsError, 'submission_students_fetch_failed'));
  const studentById = new Map((students || []).map((student) => [student.id, student]));

  const { data: answers, error: answersError } = await teacher.admin
    .from('student_answers')
    .select('session_id, question_id, answer, updated_at')
    .in('session_id', sessionIds);

  if (answersError) return json(res, 500, safeError(answersError, 'answers_fetch_failed'));

  const answersBySession = new Map();
  for (const row of answers || []) {
    if (!answersBySession.has(row.session_id)) answersBySession.set(row.session_id, []);
    const grading = extractGrading(row.answer);
    answersBySession.get(row.session_id).push({
      questionId: row.question_id,
      answer: extractAnswerPayload(row.answer),
      ...grading,
    });
  }

  const { data: examQuestions } = await teacher.admin
    .from('exam_questions')
    .select('exam_id, points')
    .in('exam_id', targetExamIds);

  const maxScoreByExam = new Map();
  for (const row of examQuestions || []) {
    maxScoreByExam.set(row.exam_id, Number(maxScoreByExam.get(row.exam_id) || 0) + Number(row.points || 0));
  }

  const submissions = sessions.map((session) => {
    const student = studentById.get(session.student_id);
    const mappedAnswers = answersBySession.get(session.id) || [];
    const score = mappedAnswers.reduce((sum, answer) => sum + Number(answer.scoreGained || 0), 0);
    return {
      id: session.id,
      examId: session.exam_id,
      examCode: examCodeById.get(session.exam_id) || '',
      studentId: session.student_id,
      studentName: student?.full_name || 'Student',
      nationalId: '',
      maskedNationalId: student?.national_id_last4 ? '***' + student.national_id_last4 : '***',
      answers: mappedAnswers,
      startedAt: session.started_at,
      submittedAt: session.submitted_at,
      status: session.status,
      score,
      maxScore: Number(maxScoreByExam.get(session.exam_id) || 0),
    };
  });

  json(res, 200, { ok: true, submissions });
}
