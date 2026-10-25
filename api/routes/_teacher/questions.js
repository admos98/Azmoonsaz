import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { selectImageStore, collectImageKeys } from '../../_lib/imageStore.js';
import { auditLog } from '../../_lib/auditLog.js';
import {
  safeError,
  deriveAnswerKey,
  questionToBody,
  mapQuestion,
} from '../../_lib/utils.js';

export async function handleTeacherQuestions(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin
      .from('questions')
      .select('id, type, grade, subject, title, body, answer_key, points, created_at')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });
    if (error) return json(res, 500, safeError(error, 'questions_fetch_failed'));
    return json(res, 200, { ok: true, questions: (data || []).map(mapQuestion) });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  const question = body.question || body;
  if (action === 'create') {
    const qGrade = String(question.grade || '').trim();
    const qSubject = String(question.category || question.subject || '').trim();
    // N-07: grade/subject are stored trim-only — cap them (title is sliced).
    if (qGrade.length > 64) return json(res, 400, { error: 'grade_too_long' });
    if (qSubject.length > 100) return json(res, 400, { error: 'subject_too_long' });
    let createBody;
    try {
      createBody = questionToBody(question, null, teacher.id);
    } catch (validationError) {
      if (Number(validationError?.status) === 400)
        return json(res, 400, { error: 'image_must_be_uploaded' });
      if (Number(validationError?.status) === 403)
        return json(res, 403, { error: 'image_not_owned' });
      throw validationError;
    }
    const payload = {
      teacher_id: teacher.id,
      type: question.type,
      grade: qGrade,
      subject: qSubject,
      title: String(question.title || question.text || 'Untitled question').slice(0, 160),
      body: createBody,
      answer_key: deriveAnswerKey(question),
      points: Number(question.points || 1),
    };
    const { data, error } = await teacher.admin
      .from('questions')
      .insert(payload)
      .select('id, type, grade, subject, title, body, answer_key, points, created_at')
      .single();
    if (error) return json(res, 400, safeError(error, 'question_create_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'question_create', entityType: 'question', entityId: data.id });
    return json(res, 200, { ok: true, question: mapQuestion(data) });
  }
  if (action === 'update') {
    const id = String(question.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_question_id' });
    const uGrade = String(question.grade || '').trim();
    const uSubject = String(question.category || question.subject || '').trim();
    if (uGrade.length > 64) return json(res, 400, { error: 'grade_too_long' });
    if (uSubject.length > 100) return json(res, 400, { error: 'subject_too_long' });
    // Grandfathering needs the stored body: unchanged legacy image URLs pass
    // through, changed ones must be storage keys (questionToBody enforces).
    const { data: existingRow, error: existingError } = await teacher.admin
      .from('questions')
      .select('id, body')
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .maybeSingle();
    if (existingError || !existingRow)
      return json(res, 400, safeError(existingError, 'question_update_failed'));
    let body;
    try {
      body = questionToBody(question, existingRow.body, teacher.id);
    } catch (validationError) {
      if (Number(validationError?.status) === 400)
        return json(res, 400, { error: 'image_must_be_uploaded' });
      if (Number(validationError?.status) === 403)
        return json(res, 403, { error: 'image_not_owned' });
      throw validationError;
    }
    const updates = {
      type: question.type,
      grade: uGrade,
      subject: uSubject,
      title: String(question.title || question.text || 'Untitled question').slice(0, 160),
      body,
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
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'question_update', entityType: 'question', entityId: id });
    return json(res, 200, { ok: true, question: mapQuestion(data) });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_question_id' });
    // Read the body first: question-owned image objects die with the
    // question unless another question of this teacher still references them.
    const { data: doomed } = await teacher.admin
      .from('questions')
      .select('id, body')
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .maybeSingle();
    const { error } = await teacher.admin
      .from('questions')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'question_delete_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'question_delete', entityType: 'question', entityId: id });
    const doomedKeys = collectImageKeys(doomed?.body);
    if (doomedKeys.length > 0) {
      try {
        const { data: siblings } = await teacher.admin
          .from('questions')
          .select('id, body')
          .eq('teacher_id', teacher.id)
          .neq('id', id)
          .limit(2000);
        const stillUsed = new Set();
        for (const row of siblings || [])
          for (const key of collectImageKeys(row?.body)) stillUsed.add(key);
        const orphaned = doomedKeys.filter((key) => !stillUsed.has(key));
        if (orphaned.length > 0) {
          const { store } = await selectImageStore();
          for (const key of orphaned) {
            try {
              await store.deleteObject({ key, teacherId: teacher.id });
            } catch (cleanupError) {
              // Object deletion never fails the question delete — a later
              // cleanup pass reaps strays.
              console.error('image_cleanup_failed', key, cleanupError?.message || cleanupError);
            }
          }
        }
      } catch (scanError) {
        console.error('image_cleanup_scan_failed', scanError?.message || scanError);
      }
    }
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}
