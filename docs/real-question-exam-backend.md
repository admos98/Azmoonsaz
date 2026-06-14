# Real question bank and exams

Patch 010 connects the question bank and exam list/create/update/delete flows to Supabase-backed teacher APIs.

## Added endpoints

- GET/POST /api/teacher/questions
- GET/POST /api/teacher/exams

All endpoints require the teacher Supabase JWT.

## Security model

Questions store student-visible content in body JSON and teacher-only answers in answer_key JSON.
Student exam payload endpoints must only read body and must never return answer_key.

## Local development

Terminal 1:

npm run dev:api

Terminal 2:

npm run dev

Log in with a real Supabase teacher account, then use Bank Questions and Exams pages.
