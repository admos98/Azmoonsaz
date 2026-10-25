import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { auditLog } from '../../_lib/auditLog.js';
import { safeError } from '../../_lib/utils.js';

export async function handleTeacherClasses(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  if (req.method === 'GET') {
    const { data, error } = await teacher.admin
      .from('class_groups')
      .select('id, name, grade')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });
    if (error) return json(res, 500, { error: 'classes_fetch_failed' });
    // BE-6 fix: studentCount was hardwired to 0, so every class permanently
    // displayed "0 دانش‌آموز" in the UI. One extra scoped read replaces the
    // constant with the real per-class roster count.
    const { data: rosterRows, error: rosterError } = await teacher.admin
      .from('students')
      .select('class_group_id')
      .eq('teacher_id', teacher.id);
    if (rosterError) return json(res, 500, safeError(rosterError, 'classes_fetch_failed'));
    const countByClass = new Map();
    for (const row of rosterRows || []) {
      if (!row.class_group_id) continue;
      countByClass.set(row.class_group_id, (countByClass.get(row.class_group_id) || 0) + 1);
    }
    return json(res, 200, {
      ok: true,
      classes: (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        grade: row.grade,
        studentCount: countByClass.get(row.id) || 0,
      })),
    });
  }
  const body = req.body || {};
  const action = body.action || 'create';
  if (action === 'create') {
    const name = String(body.name || '').trim();
    const grade = String(body.grade || '').trim();
    if (!name) return json(res, 400, { error: 'missing_class_name' });
    if (!grade) return json(res, 400, { error: 'missing_class_grade' });
    // N-07: text columns are unbounded — cap at the edge like bulk (N-01).
    if (name.length > 100) return json(res, 400, { error: 'class_name_too_long' });
    if (grade.length > 64) return json(res, 400, { error: 'grade_too_long' });
    const { data, error } = await teacher.admin
      .from('class_groups')
      .insert({ teacher_id: teacher.id, name, grade })
      .select('id, name, grade')
      .single();
    if (error) return json(res, 400, safeError(error, 'class_create_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'class_create', entityType: 'class_group', entityId: data.id });
    return json(res, 200, {
      ok: true,
      classGroup: { id: data.id, name: data.name, grade: data.grade, studentCount: 0 }, // a brand-new class has no students yet
    });
  }
  if (action === 'update') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_class_id' });
    const updates = {};
    if (body.name !== undefined) updates.name = String(body.name || '').trim();
    if (body.grade !== undefined) updates.grade = String(body.grade || '').trim();
    if (updates.name && updates.name.length > 100)
      return json(res, 400, { error: 'class_name_too_long' });
    if (updates.grade && updates.grade.length > 64)
      return json(res, 400, { error: 'grade_too_long' });
    const { data, error } = await teacher.admin
      .from('class_groups')
      .update(updates)
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .select('id, name, grade')
      .maybeSingle();
    if (error || !data) return json(res, 400, safeError(error, 'class_update_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'class_update', entityType: 'class_group', entityId: id });
    // BE-6 fix: report the real roster count instead of a hardwired 0.
    const { count: updatedCount, error: updatedCountError } = await teacher.admin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id)
      .eq('class_group_id', id);
    if (updatedCountError)
      return json(res, 500, safeError(updatedCountError, 'class_update_failed'));
    return json(res, 200, {
      ok: true,
      classGroup: {
        id: data.id,
        name: data.name,
        grade: data.grade,
        studentCount: updatedCount || 0,
      },
    });
  }
  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_class_id' });
    // M2: deleting a class cascades (students SET NULL, exam links CASCADE).
    // When it is the last allowed class of an exam, the delete would silently
    // widen a restricted exam to whole-roster — refuse while referenced.
    const { data: refStudents, error: refStudentsError } = await teacher.admin
      .from('students')
      .select('id')
      .eq('class_group_id', id)
      .eq('teacher_id', teacher.id)
      .limit(1);
    if (refStudentsError) return json(res, 500, safeError(refStudentsError, 'class_delete_check_failed'));
    if ((refStudents || []).length > 0)
      return json(res, 409, { error: 'class_has_students' });
    const { data: refLinks, error: refLinksError } = await teacher.admin
      .from('exam_allowed_classes')
      .select('exam_id, exams!inner(id, teacher_id)')
      .eq('class_group_id', id)
      .eq('exams.teacher_id', teacher.id)
      .limit(1);
    if (refLinksError) return json(res, 500, safeError(refLinksError, 'class_delete_check_failed'));
    if ((refLinks || []).length > 0)
      return json(res, 409, { error: 'class_used_by_exam' });
    const { error } = await teacher.admin
      .from('class_groups')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher.id);
    if (error) return json(res, 400, safeError(error, 'class_delete_failed'));
    await auditLog(teacher.admin, { actorType: 'teacher', actorId: teacher.id, action: 'class_delete', entityType: 'class_group', entityId: id });
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'unknown_action' });
}
