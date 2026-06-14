# Secure student frontend route

Patch 007 adds a separate secure student route:

- /secure-exam/DEMO7

This route calls the backend endpoints:

- /api/student/start-session
- /api/student/exam-payload
- /api/student/save-answer
- /api/student/submit

## Local development

Use two terminals.

Terminal 1, API server:

npm run dev:api

Terminal 2, Vite frontend:

npm run dev

Open:

http://localhost:3000/secure-exam/DEMO7

The Vite dev server proxies /api calls to http://localhost:3001.

## Why not use npm run dev:vercel for UI?

The production CSP is strict and can block Vite React Refresh inline scripts during local Vercel UI development. For now, use Vite for UI and Vercel dev for API.
