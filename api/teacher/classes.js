import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const { data, error } = await teacher.admin
    .from('class_groups')
    .select('id, name, grade')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false });

  if (error) {
    json(res, 500, { error: 'classes_fetch_failed' });
    return;
  }

  json(res, 200, {
    ok: true,
    classes: (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      grade: row.grade,
      studentCount: 0,
    })),
  });
}
