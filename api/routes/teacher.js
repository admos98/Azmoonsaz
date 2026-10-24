// Thin entry — the teacher route handlers live in api/routes/teacher/*.js.
// This module only re-exports them so that api/index.js and the server tests
// keep importing from './routes/teacher.js' exactly as before.
export { handleTeacherMe, handleTeacherProfile } from './teacher/profile.js';
export { handleTeacherClasses } from './teacher/classes.js';
export { handleTeacherStudents, handleTeacherStudentsBulk } from './teacher/students.js';
export { handleTeacherSummary } from './teacher/summary.js';
export { handleTeacherQuestions } from './teacher/questions.js';
export { handleTeacherExams } from './teacher/exams.js';
export {
  handleTeacherSubmissions,
  handleTeacherGradeAnswer,
  handleTeacherFinalizeSubmission,
} from './teacher/submissions.js';
