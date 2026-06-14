import { json, requireMethod } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const { data: profile, error } = await teacher.admin
    .from('teacher_profiles')
    .select('id, full_name, school_name')
    .eq('id', teacher.id)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: 'teacher_profile_failed' });
    return;
  }

  json(res, 200, {
    ok: true,
    teacher: {
      id: teacher.id,
      email: teacher.email,
      name: profile?.full_name || teacher.email || 'Teacher',
      schoolName: profile?.school_name || '',
    },
  });
}
