# Teacher auth and real students

Patch 008 connects the teacher login to Supabase Auth when Supabase env variables are configured.

## What is real now

- Teacher login uses Supabase Auth.
- The backend verifies the teacher JWT before teacher API calls.
- Student list reads from Supabase via /api/teacher/students.
- Manual create/update/delete student actions go through backend APIs.
- National IDs are hashed server-side with STUDENT_ID_PEPPER.

## Important

The app still keeps mock fallback mode if Supabase is not configured or login is not available.

## Local testing

Use two terminals:

Terminal 1:

npm run dev:api

Terminal 2:

npm run dev

Open http://localhost:3000 and log in with the teacher email/password you created in Supabase Authentication.

## Security

Do not create students directly from the browser with Supabase inserts. Use the API route so national IDs are hashed server-side.
