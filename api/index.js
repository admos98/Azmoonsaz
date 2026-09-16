import { json } from './_lib/http.js';
import { handleHealth, handleSecurityCheck, handleStudentIdDemo } from './routes/public.js';
import { handleStudentStartSession, handleStudentExamPayload, handleStudentSaveAnswer, handleStudentSubmit } from './routes/student.js';
import { handleTeacherMe, handleTeacherClasses, handleTeacherStudents, handleTeacherSummary, handleTeacherQuestions, handleTeacherExams, handleTeacherSubmissions, handleTeacherGradeAnswer, handleTeacherFinalizeSubmission } from './routes/teacher.js';
import { handleSignup, handleOnboardingStatus, handleOnboarding } from './routes/auth.js';

function routePath(req) {
  // Vercel usually provides req.query.path for api/[...path].js,
  // but depending on dev/prod routing it can be missing. Fall back to req.url.
  const value = req.query?.path;
  if (Array.isArray(value) && value.length > 0) return value.join('/').replace(/^\/+|\/+$/g, '');
  if (typeof value === 'string' && value.length > 0) return value.replace(/^\/+|\/+$/g, '');

  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname || '');
    pathname = pathname.replace(/^\/api\/?/, '');
    pathname = pathname.replace(/^\/+|\/+$/g, '');
    return pathname;
  } catch {
    return '';
  }
}

const routes = {
  'health': handleHealth,
  'security-check': handleSecurityCheck,
  'student-id-demo': handleStudentIdDemo,
  'auth/signup': handleSignup,
  'auth/onboarding-status': handleOnboardingStatus,
  'auth/onboarding': handleOnboarding,
  'student/start-session': handleStudentStartSession,
  'student/exam-payload': handleStudentExamPayload,
  'student/save-answer': handleStudentSaveAnswer,
  'student/submit': handleStudentSubmit,
  'teacher/me': handleTeacherMe,
  'teacher/classes': handleTeacherClasses,
  'teacher/students': handleTeacherStudents,
  'teacher/summary': handleTeacherSummary,
  'teacher/questions': handleTeacherQuestions,
  'teacher/exams': handleTeacherExams,
  'teacher/submissions': handleTeacherSubmissions,
  'teacher/grade-answer': handleTeacherGradeAnswer,
  'teacher/finalize-submission': handleTeacherFinalizeSubmission,
};

export default async function handler(req, res) {
  const path = routePath(req);
  if (!path) {
    return json(res, 200, {
      ok: true,
      service: 'azmoonsaz-api',
      message: 'API root. Try /api/health or /api/security-check.',
      routes: Object.keys(routes).sort(),
    });
  }
  const route = routes[path];
  if (!route) return json(res, 404, { error: 'api_route_not_found', path });
  return route(req, res);
}
