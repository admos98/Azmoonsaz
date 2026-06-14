# Real results and grading

Patch 012 connects the teacher results page to Supabase-backed submissions.

## Added endpoints

- GET /api/teacher/submissions?examId=...
- POST /api/teacher/grade-answer
- POST /api/teacher/finalize-submission

All endpoints require teacher Supabase auth.

## Storage model

Manual grading metadata is currently stored inside student_answers.answer.__grading.

This avoids an immediate migration, but a future schema improvement should add explicit columns:

- student_answers.score_gained
- student_answers.teacher_comment
- student_answers.is_correct
- student_exam_sessions.score
- student_exam_sessions.graded_at
- student_exam_sessions.graded_by

## Test flow

1. Submit an exam from /secure-exam/DEMO7.
2. Log in as teacher.
3. Open exam results.
4. Verify the backend submission appears.
5. Grade descriptive/manual answers if present.
6. Finalize grading.
