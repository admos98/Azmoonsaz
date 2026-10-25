import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { safeError } from '../../_lib/utils.js';

export async function handleTeacherSummary(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  // BE-8 fix: the Supabase error member was never checked, so any DB failure
  // answered a confident { students: 0, ... } — the dashboard showed an empty
  // account during an outage. Fail loudly instead.
  async function count(table) {
    const { count, error } = await teacher.admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id);
    if (error) throw error;
    return count || 0;
  }
  try {
    const [students, exams, questions] = await Promise.all([
      count('students'),
      count('exams'),
      count('questions'),
    ]);
    json(res, 200, { ok: true, summary: { students, exams, questions } });
  } catch (error) {
    json(res, 500, safeError(error, 'summary_fetch_failed'));
  }
}
