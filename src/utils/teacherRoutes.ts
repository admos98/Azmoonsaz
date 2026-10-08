const PATH_TO_TAB: Record<string, string> = {
  '/teacher/dashboard': 'dashboard',
  '/teacher/profile': 'profile',
  '/teacher/profile/students': 'students',
  '/teacher/profile/classes': 'classes',
  '/teacher/settings': 'settings',
  '/teacher/settings/questions': 'questions',
  '/teacher/exams': 'exams',
  '/teacher/exams/new': 'exams/new',
  '/teacher/results': 'results',
};

export const teacherTabFromPath = (path: string): string => {
  if (/^\/teacher\/exams\/[^/]+\/results$/.test(path)) return 'exams';
  return PATH_TO_TAB[path] || 'dashboard';
};

/** C.2 (P0-2): any path outside this set renders the 404 absence page
 *  instead of silently falling back to the dashboard. '/' is the boot
 *  root (replaceState'd to /teacher/dashboard on a live session). */
export const isKnownTeacherPath = (path: string): boolean =>
  path === '/' ||
  path in PATH_TO_TAB ||
  /^\/teacher\/exams\/[^/]+\/results$/.test(path);

export const teacherPathFromTab = (tab: string): string => {
  const routes: Record<string, string> = {
    dashboard: '/teacher/dashboard',
    profile: '/teacher/profile',
    students: '/teacher/profile/students',
    classes: '/teacher/profile/classes',
    settings: '/teacher/settings',
    questions: '/teacher/settings/questions',
    exams: '/teacher/exams',
    'exams/new': '/teacher/exams/new',
    results: '/teacher/results',
  };
  return routes[tab] || '/teacher/dashboard';
};
