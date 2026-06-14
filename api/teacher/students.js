import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';
import { validateIranianNationalId, normalizeNationalId, nationalIdHash } from '../_lib/crypto.js';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeStudentStatus(status) {
  return status === 'suspended' ? 'suspended' : 'active';
}

function safeError(error, fallback) {
  const response = { error: fallback };
  if (process.env.NODE_ENV !== 'production' && error?.message) {
    response.detail = error.message;
    response.code = error.code;
  }
  return response;
}

function maskFromLast4(last4) {
  return '***' + String(last4 || '').padStart(4, '*');
}

function mapStudent(row) {
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
  };
}

async function resolveClassGroupId(teacher, rawClassGroupId, grade) {
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
    .insert({
      teacher_id: teacher.id,
      name: 'Default Class ' + cleanGrade,
      grade: cleanGrade,
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

async function listStudents(teacher, res) {
  const { data, error } = await teacher.admin
    .from('students')
    .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false });

  if (error) {
    json(res, 500, safeError(error, 'students_fetch_failed'));
    return;
  }

  json(res, 200, { ok: true, students: (data || []).map(mapStudent) });
}

async function createStudent(teacher, res, body) {
  const name = String(body.name || '').trim();
  const grade = String(body.grade || '').trim();

  if (!name) {
    json(res, 400, { error: 'missing_student_name' });
    return;
  }

  if (!grade) {
    json(res, 400, { error: 'missing_student_grade' });
    return;
  }

  const cleanNationalId = normalizeNationalId(body.nationalId);
  if (!validateIranianNationalId(cleanNationalId)) {
    json(res, 400, { error: 'invalid_national_id' });
    return;
  }

  try {
    const classGroupId = await resolveClassGroupId(teacher, body.classGroupId, grade);

    const { data, error } = await teacher.admin
      .from('students')
      .insert({
        teacher_id: teacher.id,
        class_group_id: classGroupId,
        full_name: name,
        grade,
        national_id_hash: nationalIdHash(cleanNationalId),
        national_id_last4: cleanNationalId.slice(-4),
        status: normalizeStudentStatus(body.status),
      })
      .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at')
      .single();

    if (error) {
      json(res, 400, safeError(error, error.code === '23505' ? 'duplicate_student' : 'student_create_failed'));
      return;
    }

    json(res, 200, { ok: true, student: mapStudent(data) });
  } catch (error) {
    json(res, 400, safeError(error, 'student_create_failed'));
  }
}

async function updateStudent(teacher, res, body) {
  const id = String(body.id || '').trim();
  if (!id) {
    json(res, 400, { error: 'missing_student_id' });
    return;
  }

  try {
    const updates = {};
    if (body.name !== undefined) updates.full_name = String(body.name || '').trim();
    if (body.grade !== undefined) updates.grade = String(body.grade || '').trim();
    if (body.status !== undefined) updates.status = normalizeStudentStatus(body.status);

    if (body.classGroupId !== undefined) {
      updates.class_group_id = await resolveClassGroupId(teacher, body.classGroupId, body.grade || 'نامشخص');
    }

    if (body.nationalId) {
      const cleanNationalId = normalizeNationalId(body.nationalId);
      if (!validateIranianNationalId(cleanNationalId)) {
        json(res, 400, { error: 'invalid_national_id' });
        return;
      }
      updates.national_id_hash = nationalIdHash(cleanNationalId);
      updates.national_id_last4 = cleanNationalId.slice(-4);
    }

    const { data, error } = await teacher.admin
      .from('students')
      .update(updates)
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .select('id, full_name, grade, class_group_id, national_id_last4, status, created_at')
      .maybeSingle();

    if (error || !data) {
      json(res, 400, safeError(error, 'student_update_failed'));
      return;
    }

    json(res, 200, { ok: true, student: mapStudent(data) });
  } catch (error) {
    json(res, 400, safeError(error, 'student_update_failed'));
  }
}

async function deleteStudent(teacher, res, body) {
  const id = String(body.id || '').trim();
  if (!id) {
    json(res, 400, { error: 'missing_student_id' });
    return;
  }

  const { error } = await teacher.admin
    .from('students')
    .delete()
    .eq('id', id)
    .eq('teacher_id', teacher.id);

  if (error) {
    json(res, 400, safeError(error, 'student_delete_failed'));
    return;
  }

  json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  if (req.method === 'GET') {
    await listStudents(teacher, res);
    return;
  }

  const body = req.body || {};
  const action = body.action || 'create';
  if (action === 'create') return createStudent(teacher, res, body.student || body);
  if (action === 'update') return updateStudent(teacher, res, body.student || body);
  if (action === 'delete') return deleteStudent(teacher, res, body);

  json(res, 400, { error: 'unknown_action' });
}
