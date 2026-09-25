export const loadDashboard = () => import('../pages/teacher/Dashboard');
export const loadExams = () => import('../pages/teacher/Exams');
export const loadNewExam = () => import('../pages/teacher/NewExam');
export const loadSettingsHub = () => import('../pages/teacher/SettingsHub');
export const loadTeacherProfile = () => import('../pages/teacher/TeacherProfile');

const loaders: Record<string, () => Promise<unknown>> = {
  dashboard: loadDashboard,
  exams: loadExams,
  'new-exam': loadNewExam,
  settings: loadSettingsHub,
  profile: loadTeacherProfile,
  students: loadTeacherProfile,
  classes: loadTeacherProfile,
};

const started = new Set<string>();

/** Preloads only after explicit user intent (focus/hover), never speculatively on startup. */
export function preloadTeacherPage(destination: string): void {
  if (started.has(destination)) return;
  const loader = loaders[destination];
  if (!loader) return;
  started.add(destination);
  void loader().catch(() => started.delete(destination));
}
