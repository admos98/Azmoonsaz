# Vercel Hobby function limit fix

Vercel Hobby allows a maximum of 12 Serverless Functions per deployment.

Earlier versions had one file per API endpoint, which exceeded the limit.

Patch 015 consolidates all public API endpoints into one catch-all function:

api/[...path].js

Helper files remain under api/_lib. The deployment should now stay below the Hobby function limit.

Important: API URLs did not change. The catch-all router still serves:

- /api/health
- /api/security-check
- /api/student/start-session
- /api/student/exam-payload
- /api/student/save-answer
- /api/student/submit
- /api/teacher/students
- /api/teacher/questions
- /api/teacher/exams
- /api/teacher/submissions
