import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

async function safeCount(client, table, teacherId) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId);
  if (error) return 0;
  return count || 0;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const [students, exams, questions] = await Promise.all([
    safeCount(teacher.admin, 'students', teacher.id),
    safeCount(teacher.admin, 'exams', teacher.id),
    safeCount(teacher.admin, 'questions', teacher.id),
  ]);

  json(res, 200, {
    ok: true,
    summary: { students, exams, questions },
  });
}
