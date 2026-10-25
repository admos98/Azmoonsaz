import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { checkRateLimit } from '../../_lib/rateLimit.js';
import { auditLog } from '../../_lib/auditLog.js';
import {
  safeError,
  normalizeStudentStatus,
  mapStudent,
  resolveClassGroupId,
  boundedOptionalText,
} from '../../_lib/utils.js';

export async function handleTeacherStudents(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin
      .from('students')
      .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at, pin_set_at, pin_must_change, email, phone_number')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });
    if (error) return json(res, 500, safeError(error, 'students_fetch_failed'));
    return json(res, 200, { ok: true, students: (data || []).map(mapStudent) });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  const studentBody = body.student || body;
  if (action === 'create') {
    const name = String(studentBody.name || '').trim();
    const grade = String(studentBody.grade || '').trim();
    const { normalizeNationalId, nationalIdHash, validateIranianNationalId } =
      await import('../../_lib/crypto.js');
    const cleanNationalId = normalizeNationalId(studentBody.nationalId);
    if (!name) return json(res, 400, { error: 'missing_student_name' });
    if (!grade) return json(res, 400, { error: 'missing_student_grade' });
    // N-07: match the bulk-import caps (N-01).
    if (name.length > 128) return json(res, 400, { error: 'name_too_long' });
    if (grade.length > 64) return json(res, 400, { error: 'grade_too_long' });
    if (!validateIranianNationalId(cleanNationalId))
      return json(res, 400, { error: 'invalid_national_id' });
    try {
      const classGroupId = await resolveClassGroupId(teacher, studentBody.classGroupId, grade);
      const { data, error } = await teacher.admin
        .from('students')
        .insert({
          teacher_id: teacher.id,
          class_group_id: classGroupId,
          full_name: name,
          grade,
          national_id_hash: nationalIdHash(cleanNationalId),
          national_id_last4: cleanNationalId.slice(-4),
          status: normalizeStudentStatus(studentBody.status),
          // BE-5 fix: the UI collects email/phone and the API contract maps
          // them back — persist them (bounded) instead of silently dropping.
          email: boundedOptionalText(studentBody.email, 200),
          phone_number: boundedOptionalText(studentBody.phoneNumber || studentBody.phone_number, 32),
        })
        .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at, pin_set_at, pin_must_change, email, phone_number')
        .single();
      if (error)
        return json(
          res,
          400,
          safeError(error, error.code === '23505' ? 'duplicate_student' : 'student_create_failed'),
        );
      await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'student_create', entityType: 'student', entityId: data.id });
      return json(res, 200, { ok: true, student: mapStudent(data) });
    } catch (error) {
      return json(res, 400, safeError(error, 'student_create_failed'));
    }
  }
  if (action === 'update') {
    const id = String(studentBody.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_student_id' });
    try {
      const { normalizeNationalId, nationalIdHash, validateIranianNationalId } =
        await import('../../_lib/crypto.js');
      const updates = {};
      if (studentBody.name !== undefined) updates.full_name = String(studentBody.name || '').trim();
      if (studentBody.grade !== undefined) updates.grade = String(studentBody.grade || '').trim();
      if (updates.full_name && updates.full_name.length > 128)
        return json(res, 400, { error: 'name_too_long' });
      if (updates.grade && updates.grade.length > 64)
        return json(res, 400, { error: 'grade_too_long' });
      if (studentBody.status !== undefined)
        updates.status = normalizeStudentStatus(studentBody.status);
      // BE-5 fix: persist contact fields when the client sends them.
      if (studentBody.email !== undefined)
        updates.email = boundedOptionalText(studentBody.email, 200);
      if (studentBody.phoneNumber !== undefined || studentBody.phone_number !== undefined)
        updates.phone_number = boundedOptionalText(
          studentBody.phoneNumber ?? studentBody.phone_number,
          32,
        );
      if (studentBody.classGroupId !== undefined)
        updates.class_group_id = await resolveClassGroupId(
          teacher,
          studentBody.classGroupId,
          studentBody.grade || 'نامشخص',
        );
      if (studentBody.nationalId) {
        const cleanNationalId = normalizeNationalId(studentBody.nationalId);
        if (!validateIranianNationalId(cleanNationalId))
          return json(res, 400, { error: 'invalid_national_id' });
        updates.national_id_hash = nationalIdHash(cleanNationalId);
        updates.national_id_last4 = cleanNationalId.slice(-4);
      }
      const { data, error } = await teacher.admin
        .from('students')
        .update(updates)
        .eq('id', id)
        .eq('teacher_id', teacher.id)
        .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at, pin_set_at, pin_must_change, email, phone_number')
        .maybeSingle();
      if (error || !data) return json(res, 400, safeError(error, 'student_update_failed'));
      await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'student_update', entityType: 'student', entityId: id });
      return json(res, 200, { ok: true, student: mapStudent(data) });
    } catch (error) {
      return json(res, 400, safeError(error, 'student_update_failed'));
    }
  }
  if (action === 'reset-pin') {
    // T7 — teacher-only PIN reset. The teacher never sees or sets the PIN:
    // this clears the hash and flags pin_must_change, so the student's next
    // login shows the set-PIN screen. Audited (counts only, no PII).
    // Ongoing sessions die with the reset (reason pin_reset): a squatter's
    // bearer must not survive, and start-session re-admits exactly those
    // rows (fresh window, squatter answers wiped). Proctor-blocked rows are
    // untouched beyond the PIN fields — second-strike stays permanent.
    const id = String(studentBody.id || body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_student_id' });
    const { data, error } = await teacher.admin
      .from('students')
      .update({ pin_hash: null, pin_set_at: null, pin_must_change: true })
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at, pin_set_at, pin_must_change, email, phone_number')
      .maybeSingle();
    if (error || !data) return json(res, 400, safeError(error, 'student_pin_reset_failed'));
    const { error: revokeError } = await teacher.admin
      .from('student_exam_sessions')
      .update({ status: 'invalidated', invalidated_reason: 'pin_reset' })
      .eq('student_id', id)
      .eq('status', 'ongoing');
    if (revokeError) return json(res, 500, safeError(revokeError, 'student_pin_revoke_failed'));
    await auditLog(teacher.admin, {
      actorType: 'teacher',
      actorId: teacher.id,
      action: 'student_pin_reset',
      entityType: 'student',
      entityId: id,
    });
    return json(res, 200, { ok: true, student: { ...mapStudent(data), pinSet: false } });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_student_id' });
    const { error } = await teacher.admin
      .from('students')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'student_delete_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'student_delete', entityType: 'student', entityId: id });
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}

/**
 * POST /api/teacher/students/bulk
 * Body: { students: [{ row?, name, nationalId, grade, classGroupId, ... }] }
 *
 * One request for the whole import instead of N sequential POSTs. Every row is
 * accounted for: successes come back in `imported`, failures as
 * `{ row, reason }` in `failed` — never partial silence.
 *
 * Idempotent by construction: the `(teacher_id, national_id_hash)` unique
 * constraint turns a re-run row into `duplicate_student` rather than a
 * duplicate student.
 */
export async function handleTeacherStudentsBulk(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const body = req.body || {};
  const rows = Array.isArray(body.students) ? body.students : null;
  if (!rows || rows.length === 0) return json(res, 400, { error: 'missing_students' });
  if (rows.length > 500) return json(res, 400, { error: 'too_many_students' });

  // Bulk is the abuse-prone teacher surface: bound it per teacher.
  const rate = await checkRateLimit(`students-bulk:${teacher.id}`, { limit: 10, windowMs: 60_000 });
  if (!rate.ok) return json(res, 429, { error: 'rate_limited' });

  const { normalizeNationalId, nationalIdHash, validateIranianNationalId } =
    await import('../../_lib/crypto.js');
  const SELECT_COLUMNS =
    'id, full_name, grade, class_group_id, national_id_last4, status, created_at, pin_set_at, pin_must_change, email, phone_number';

  // Pass 1 — resolve every distinct class group once. A 100-row import must
  // not fire 100 class lookups, and two rows racing to create the same class
  // must not both create one.
  const classIdByKey = new Map();
  const classKeyOf = (row) =>
    `${String(row?.grade || '').trim()}|${String(row?.classGroupId || '').trim()}`;
  for (const row of rows) {
    const key = classKeyOf(row);
    if (classIdByKey.has(key)) continue;
    // N-01: an oversized grade must not create a junk class group in pass 1
    // — the row fails validation below, so never resolve it here either.
    if (String(row?.grade || '').trim().length > 64) {
      classIdByKey.set(key, null);
      continue;
    }
    try {
      classIdByKey.set(
        key,
        await resolveClassGroupId(teacher, row?.classGroupId, String(row?.grade || '').trim()),
      );
    } catch {
      classIdByKey.set(key, null); // surfaced per row as class_not_found
    }
  }

  // Pass 2 — validate and insert, bounded concurrency (100 rows well under 5s,
  // without hammering PostgREST with 500 simultaneous statements).
  const insertRow = async (row, index) => {
    const rowNumber = Number(row?.row) > 0 ? Number(row?.row) : index + 1;
    const name = String(row?.name || '').trim();
    const grade = String(row?.grade || '').trim();

    if (!name) return { row: rowNumber, reason: 'missing_student_name' };
    if (!grade) return { row: rowNumber, reason: 'missing_student_grade' };
    // N-01: text fields are unbounded in the DB — bound them at the edge.
    if (name.length > 128) return { row: rowNumber, reason: 'name_too_long' };
    if (grade.length > 64) return { row: rowNumber, reason: 'grade_too_long' };
    const cleanNationalId = normalizeNationalId(row?.nationalId);
    if (!validateIranianNationalId(cleanNationalId))
      return { row: rowNumber, reason: 'invalid_national_id' };
    const classGroupId = classIdByKey.get(classKeyOf(row));
    if (!classGroupId) return { row: rowNumber, reason: 'class_not_found' };

    try {
      const { data, error } = await teacher.admin
        .from('students')
        .insert({
          teacher_id: teacher.id,
          class_group_id: classGroupId,
          full_name: name,
          grade,
          national_id_hash: nationalIdHash(cleanNationalId),
          national_id_last4: cleanNationalId.slice(-4),
          status: normalizeStudentStatus(row?.status),
          // BE-5 fix: bulk import carries contact fields too — stop dropping them.
          email: boundedOptionalText(row?.email, 200),
          phone_number: boundedOptionalText(row?.phoneNumber || row?.phone_number, 32),
        })
        .select(SELECT_COLUMNS)
        .single();
      if (error) {
        return {
          row: rowNumber,
          reason: error.code === '23505' ? 'duplicate_student' : 'student_create_failed',
        };
      }
      return { row: rowNumber, student: mapStudent(data) };
    } catch {
      return { row: rowNumber, reason: 'student_create_failed' };
    }
  };

  const BATCH_SIZE = 10;
  const imported = [];
  const failed = [];
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + BATCH_SIZE);
    const outcomes = await Promise.all(chunk.map((row, i) => insertRow(row, offset + i)));
    for (const outcome of outcomes) {
      if (outcome.student) imported.push(outcome.student);
      else failed.push({ row: outcome.row, reason: outcome.reason });
    }
  }

  // F-13: mass student import is a high-value audit event (counts only, no PII).
  await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'students_bulk_import', entityType: 'student', entityId: null, metadata: { importedCount: imported.length, failedCount: failed.length } });
  return json(res, 200, {
    ok: true,
    imported,
    failed,
    importedCount: imported.length,
    failedCount: failed.length,
  });
}
