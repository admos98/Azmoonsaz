import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { auditLog } from '../../_lib/auditLog.js';
import {
  safeError,
  extractAnswerPayload,
  extractGrading,
  requireOwnedSession,
} from '../../_lib/utils.js';

export async function handleTeacherSubmissions(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'POST') {
    // Wave B — invalidation policy (user decision): first strike = warning
    // + clean retake (answers wiped, fresh window, warning on record);
    // second strike = permanent block on that exam (status 'invalidated').
    const body = req.body || {};
    const sessionId = String(body.submissionId || body.sessionId || '').trim();
    if (!sessionId) return json(res, 400, { error: 'missing_submission_id' });
    const owned = await requireOwnedSession(teacher, sessionId);
    if (owned.error) return json(res, 403, safeError(owned.error, 'submission_not_owned'));
    const { data: state, error: stateError } = await teacher.admin
      .from('student_exam_sessions')
      .select('id, status, warning_count, attempt_count')
      .eq('id', sessionId)
      .maybeSingle();
    if (stateError || !state)
      return json(res, 500, safeError(stateError, 'invalidate_lookup_failed'));
    if (state.status === 'invalidated') return json(res, 409, { error: 'already_invalidated' });
    const strikes = Number(state.warning_count || 0);
    if (strikes < 1) {
      const { error: wipeError } = await teacher.admin
        .from('student_answers')
        .delete()
        .eq('session_id', sessionId);
      if (wipeError) return json(res, 500, safeError(wipeError, 'invalidate_wipe_failed'));
      const { error: resetError } = await teacher.admin
        .from('student_exam_sessions')
        .update({
          status: 'ongoing',
          started_at: new Date().toISOString(),
          submitted_at: null,
          warning_count: 1,
          attempt_count: Number(state.attempt_count || 1) + 1,
        })
        .eq('id', sessionId);
      if (resetError) return json(res, 500, safeError(resetError, 'invalidate_reset_failed'));
      await auditLog(teacher.admin, {
        actorType: 'teacher',
        actorId: teacher.id,
        action: 'session_warned',
        entityType: 'session',
        entityId: sessionId,
        metadata: { examId: owned.session.exam_id },
      });
      return json(res, 200, { ok: true, action: 'warned', warningCount: 1 });
    }
    const { error: blockError } = await teacher.admin
      .from('student_exam_sessions')
      .update({ status: 'invalidated' })
      .eq('id', sessionId);
    if (blockError) return json(res, 500, safeError(blockError, 'invalidate_block_failed'));
    await auditLog(teacher.admin, {
      actorType: 'teacher',
      actorId: teacher.id,
      action: 'session_invalidated',
      entityType: 'session',
      entityId: sessionId,
      metadata: { examId: owned.session.exam_id, warningCount: strikes },
    });
    return json(res, 200, { ok: true, action: 'blocked', warningCount: strikes });
  }
  const examId = String(req.query.examId || '').trim();
  const { data: exams, error: examsError } = await teacher.admin
    .from('exams')
    .select('id, exam_code')
    .eq('teacher_id', teacher.id);
  if (examsError) return json(res, 500, safeError(examsError, 'teacher_exams_fetch_failed'));
  const allowedExamIds = (exams || []).map((exam) => exam.id);
  if (examId && !allowedExamIds.includes(examId))
    return json(res, 403, { error: 'exam_not_owned' });
  const targetExamIds = examId ? [examId] : allowedExamIds;
  if (targetExamIds.length === 0) return json(res, 200, { ok: true, submissions: [] });
  const examCodeById = new Map((exams || []).map((exam) => [exam.id, exam.exam_code]));
  const { data: sessions, error: sessionsError } = await teacher.admin
    .from('student_exam_sessions')
    .select(
      'id, exam_id, student_id, status, started_at, submitted_at, proctor_flags, warning_count, attempt_count',
    )
    .in('exam_id', targetExamIds)
    .order('started_at', { ascending: false });
  if (sessionsError) return json(res, 500, safeError(sessionsError, 'submissions_fetch_failed'));
  if (!sessions || sessions.length === 0) return json(res, 200, { ok: true, submissions: [] });
  const studentIds = [...new Set(sessions.map((session) => session.student_id))];
  const sessionIds = sessions.map((session) => session.id);
  // ML3: scope the roster read to this teacher. Session ids arrive from
  // teacher-owned exams, but the lookup itself must not be a cross-tenant
  // read — a forged session row must never resolve a foreign student's name.
  const { data: students } = await teacher.admin
    .from('students')
    .select('id, full_name, national_id_last4')
    .eq('teacher_id', teacher.id)
    .in('id', studentIds);
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
    answersBySession
      .get(row.session_id)
      .push({ questionId: row.question_id, answer: extractAnswerPayload(row.answer), ...grading });
  }
  const { data: examQuestions } = await teacher.admin
    .from('exam_questions')
    .select('exam_id, points')
    .in('exam_id', targetExamIds);
  const maxScoreByExam = new Map();
  for (const row of examQuestions || [])
    maxScoreByExam.set(
      row.exam_id,
      Number(maxScoreByExam.get(row.exam_id) || 0) + Number(row.points || 0),
    );
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
      // Wave C: counters only — never IP/UA (F-21).
      proctorFlags: session.proctor_flags || {},
      warningCount: Number(session.warning_count || 0),
      attemptCount: Number(session.attempt_count || 1),
    };
  });
  json(res, 200, { ok: true, submissions });
}

export async function handleTeacherGradeAnswer(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const body = req.body || {};
  const sessionId = String(body.submissionId || body.sessionId || '').trim();
  const questionId = String(body.questionId || '').trim();
  const scoreGained = Number(body.scoreGained || 0);
  const teacherComment = String(body.comment || body.teacherComment || '');
  if (!sessionId || !questionId) return json(res, 400, { error: 'missing_grade_target' });
  // L3: the comment rides inside the answer JSONB — bound like every other
  // free-text edge input (teacher UI sends short notes; 2k is headroom).
  if (teacherComment.length > 2000) return json(res, 400, { error: 'comment_too_long' });
  // F-18: NaN alone is not enough — Infinity passes Number.isNaN, and a score
  // is only meaningful against the question's point value.
  if (!Number.isFinite(scoreGained) || scoreGained < 0)
    return json(res, 400, { error: 'invalid_score' });
  const owned = await requireOwnedSession(teacher, sessionId);
  if (owned.error) return json(res, 403, safeError(owned.error, 'submission_not_owned'));
  // F-19: the question must belong to THIS session's exam — otherwise a
  // teacher could grade (and score-cap against) arbitrary question ids.
  const { data: examQuestion, error: eqError } = await teacher.admin
    .from('exam_questions')
    .select('question_id, points, questions(points)')
    .eq('exam_id', owned.session.exam_id)
    .eq('question_id', questionId)
    .maybeSingle();
  if (eqError) return json(res, 500, safeError(eqError, 'grade_lookup_failed'));
  if (!examQuestion) return json(res, 403, { error: 'question_not_in_exam' });
  const maxScore = Number(examQuestion.points ?? examQuestion.questions?.points ?? 0);
  const scoreCap = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 100;
  if (scoreGained > scoreCap) return json(res, 400, { error: 'score_exceeds_points' });
  const { data: existing } = await teacher.admin
    .from('student_answers')
    .select('answer')
    .eq('session_id', sessionId)
    .eq('question_id', questionId)
    .maybeSingle();
  const answer = existing?.answer && typeof existing.answer === 'object' ? existing.answer : {};
  const nextAnswer = {
    ...answer,
    __grading: {
      scoreGained,
      teacherComment,
      isCorrect: scoreGained > 0,
      gradedAt: new Date().toISOString(),
      gradedBy: teacher.id,
    },
  };
  const { error: upsertError } = await teacher.admin
    .from('student_answers')
    .upsert(
      {
        session_id: sessionId,
        question_id: questionId,
        answer: nextAnswer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,question_id' },
    );
  if (upsertError) return json(res, 500, safeError(upsertError, 'grade_save_failed'));
  await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'grade_answer', entityType: 'session', entityId: sessionId, metadata: { questionId, scoreGained } });
  json(res, 200, { ok: true });
}

export async function handleTeacherFinalizeSubmission(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const sessionId = String(
    (req.body || {}).submissionId || (req.body || {}).sessionId || '',
  ).trim();
  if (!sessionId) return json(res, 400, { error: 'missing_submission_id' });
  const owned = await requireOwnedSession(teacher, sessionId);
  if (owned.error) return json(res, 403, safeError(owned.error, 'submission_not_owned'));
  // M1: finalize is the submitted → graded transition only. An unconditional
  // write would stamp a live 'ongoing' paper as graded — cutting the exam off
  // (saves 403, submit 409s) with score ~0. The conditional update also wins
  // the race against a concurrent in-flight submit.
  const { data, error } = await teacher.admin
    .from('student_exam_sessions')
    .update({ status: 'graded' })
    .eq('id', sessionId)
    .eq('status', 'submitted')
    .select('id, exam_id, student_id, status, started_at, submitted_at')
    .maybeSingle();
  if (error) return json(res, 500, safeError(error, 'finalize_failed'));
  if (!data)
    return json(res, 409, { error: 'submission_not_submitted' });
  await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'finalize_submission', entityType: 'session', entityId: sessionId, metadata: { examId: owned.session.exam_id } });
  json(res, 200, { ok: true, session: data });
}
