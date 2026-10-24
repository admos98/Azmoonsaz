import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { auditLog } from '../../_lib/auditLog.js';
import {
  safeError,
  isUuid,
  randomExamCode,
  resolveClassGroupIds,
  hydrateExam,
  hydrateExams,
} from '../../_lib/utils.js';

export async function handleTeacherExams(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin
      .from('exams')
      .select(
        'id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at',
      )
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });
    if (error) return json(res, 500, safeError(error, 'exams_fetch_failed'));
    // BE-7 fix: hydrate in batch. The old loop awaited 2-3 serial round trips
    // PER exam (N+1); three total queries now cover the whole list.
    const exams = await hydrateExams(teacher, data || []);
    return json(res, 200, { ok: true, exams });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  const exam = body.exam || body;
  if (action === 'create') {
    // N-07: payload stores these raw — bound the raw values.
    if (String(exam.title || '').length > 200)
      return json(res, 400, { error: 'title_too_long' });
    if (String(exam.grade || '').length > 64)
      return json(res, 400, { error: 'grade_too_long' });
    if (String(exam.subject || '').length > 100)
      return json(res, 400, { error: 'subject_too_long' });
    try {
      const classIds = await resolveClassGroupIds(teacher, exam.classGroupIds, exam.grade);
      // L3: description rides in the settings JSONB — cap the free text.
      const settings = { ...(exam.settings || {}), description: String(exam.description || '').slice(0, 2000) };
      // F-11: exam codes are minted server-side only. A client-supplied
      // examCode is ignored so no unvalidated value can ever reach the DB.
      const questions = Array.isArray(exam.questions)
        ? exam.questions.filter((q) => isUuid(q.id))
        : [];
      // F-26 (A01, IDOR via FK): only THIS teacher's questions may be
      // attached — validate BEFORE the exam row exists so a rejection never
      // leaves an orphaned question-less exam behind (M3).
      if (questions.length > 0) {
        const { data: ownedQuestions, error: ownershipError } = await teacher.admin
          .from('questions')
          .select('id')
          .eq('teacher_id', teacher.id)
          .in('id', questions.map((q) => q.id));
        if (ownershipError) throw ownershipError;
        const ownedIds = new Set((ownedQuestions || []).map((row) => row.id));
        if (questions.some((q) => !ownedIds.has(q.id)))
          return json(res, 400, { error: 'question_not_owned' });
      }
      let data = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = randomExamCode();
        const payload = {
          teacher_id: teacher.id,
          exam_code: code,
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
        const result = await teacher.admin
          .from('exams')
          .insert(payload)
          .select(
            'id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at',
          )
          .single();
        if (!result.error) {
          data = result.data;
          break;
        }
        lastError = result.error;
        if (result.error.code !== '23505') throw result.error;
      }
      if (!data) throw lastError || new Error('exam_create_failed_after_retries');
      // M3: the two dependent inserts are checked, not fire-and-forget. A
      // silent failure here used to leave a partial exam (unrestricted, or
      // question-less) behind a 200 — now the exam row is compensated away
      // and the create fails loudly.
      const compensateExam = async () => {
        try {
          await teacher.admin.from('exams').delete().eq('id', data.id).eq('teacher_id', teacher.id);
        } catch (compensateError) {
          console.error('exam_create_compensate_failed', data.id, compensateError?.message || compensateError);
        }
      };
      if (classIds.length) {
        const { error: linkError } = await teacher.admin
          .from('exam_allowed_classes')
          .insert(classIds.map((id) => ({ exam_id: data.id, class_group_id: id })));
        if (linkError) {
          await compensateExam();
          return json(res, 500, safeError(linkError, 'exam_create_links_failed'));
        }
      }
      if (questions.length > 0) {
        const { error: linkError } = await teacher.admin
          .from('exam_questions')
          .insert(
            questions.map((q, index) => ({
              exam_id: data.id,
              question_id: q.id,
              section_title: exam.sections?.[0]?.title || 'سوالات آزمون',
              position: index + 1,
              points: q.points || null,
            })),
          );
        if (linkError) {
          await compensateExam();
          return json(res, 500, safeError(linkError, 'exam_create_questions_failed'));
        }
      }
      await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'exam_create', entityType: 'exam', entityId: data.id });
      return json(res, 200, { ok: true, exam: await hydrateExam(teacher, data) });
    } catch (error) {
      return json(res, 400, safeError(error, 'exam_create_failed'));
    }
  }
  if (action === 'update') {
    const id = String(body.id || exam.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_exam_id' });
    // BE-2 fix — build the update CONDITIONALLY. The previous code always
    // defined starts_at/ends_at/duration_minutes/settings (via `|| null` and
    // `|| 45` fallbacks), so a partial update — e.g. a status change from
    // Exams.tsx or publishExam, which sends only { id, status } — wiped the
    // schedule window, reset duration to 45 and replaced the whole settings
    // JSONB (shuffle flags, maxAttempts, description) with {description:''}.
    // Each column now moves only when the caller actually sent its input.
    const updates = {};
    if (exam.title !== undefined) updates.title = exam.title;
    if (exam.grade !== undefined) updates.grade = exam.grade;
    if (exam.subject !== undefined) updates.subject = exam.subject;
    if (exam.status !== undefined) updates.status = exam.status;
    if (exam.settings?.mode !== undefined) updates.mode = exam.settings.mode;
    if (exam.settings?.startTime !== undefined)
      updates.starts_at = exam.settings.startTime || null;
    if (exam.settings?.endTime !== undefined) updates.ends_at = exam.settings.endTime || null;
    if (exam.duration !== undefined || exam.settings?.durationMinutes !== undefined)
      updates.duration_minutes = Number(exam.duration || exam.settings?.durationMinutes || 45);
    if (exam.settings !== undefined || exam.description !== undefined) {
      // L3: description rides in the settings JSONB — cap the free text.
      // Preserve the existing description when the caller updates settings
      // without sending one (description-only edits send it explicitly).
      updates.settings = {
        ...(exam.settings || {}),
        description: String(exam.description ?? exam.settings?.description ?? '').slice(0, 2000),
      };
    }
    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
    if (Object.keys(updates).length === 0)
      return json(res, 400, { error: 'missing_exam_update_fields' });
    // N-07: same bounds as create (stored raw).
    if (updates.title !== undefined && String(updates.title).length > 200)
      return json(res, 400, { error: 'title_too_long' });
    if (updates.grade !== undefined && String(updates.grade).length > 64)
      return json(res, 400, { error: 'grade_too_long' });
    if (updates.subject !== undefined && String(updates.subject).length > 100)
      return json(res, 400, { error: 'subject_too_long' });
    const { data, error } = await teacher.admin
      .from('exams')
      .update(updates)
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .select(
        'id, teacher_id, exam_code, title, grade, subject, status, mode, starts_at, ends_at, duration_minutes, settings, created_at',
      )
      .maybeSingle();
    if (error || !data) return json(res, 400, safeError(error, 'exam_update_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'exam_update', entityType: 'exam', entityId: id });
    return json(res, 200, { ok: true, exam: await hydrateExam(teacher, data) });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_exam_id' });
    const { error } = await teacher.admin
      .from('exams')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'exam_delete_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'exam_delete', entityType: 'exam', entityId: id });
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}
