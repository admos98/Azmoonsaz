# Student API flow

These endpoints are server-side Vercel functions. They are not connected to the React UI yet.

## Endpoints

Start session:
POST /api/student/start-session
Body: { "examCode": "DEMO7", "nationalId": "VALID_TEST_NATIONAL_ID" }
Returns a short-lived signed student token.

Get safe exam payload:
POST /api/student/exam-payload
Header: Authorization: Bearer STUDENT_TOKEN
Returns safe questions only. It strips answer keys and teacher-only fields.

Save answer:
POST /api/student/save-answer
Body: { "token": "STUDENT_TOKEN", "questionId": "QUESTION_UUID", "answer": { "value": "a" } }

Submit:
POST /api/student/submit
Body: { "token": "STUDENT_TOKEN" }

## Local testing

Use Vercel dev for API functions:

npm run dev:vercel

Before testing, run the Supabase schema and seed SQL.
