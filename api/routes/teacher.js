// Thin entry — the teacher route handlers live in api/routes/teacher/*.js.
// This module only re-exports them so that api/index.js and the server tests
// keep importing from './routes/teacher.js' exactly as before.
export { handleTeacherMe, handleTeacherProfile } from './_teacher/profile.js';
export { handleTeacherClasses } from './_teacher/classes.js';
export { handleTeacherStudents, handleTeacherStudentsBulk } from './_teacher/students.js';
export { handleTeacherSummary } from './_teacher/summary.js';
export { handleTeacherQuestions } from './_teacher/questions.js';
export { handleTeacherExams } from './_teacher/exams.js';
export {
  handleTeacherSubmissions,
  handleTeacherGradeAnswer,
  handleTeacherFinalizeSubmission,
} from './_teacher/submissions.js';
