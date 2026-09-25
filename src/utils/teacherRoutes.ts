export const teacherTabFromPath = (path: string): string => {
  if (/^\/teacher\/exams\/[^/]+\/results$/.test(path)) return 'exams';
  const routes: Record<string, string> = {
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
  return routes[path] || 'dashboard';
};

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
