<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cf840fa5-9958-4ec4-b270-963a2ab3c3d7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Security-first production notes

This app is currently a frontend prototype with mock/localStorage data. Do not use it for real exams until the backend security work is complete.

Read:

- docs/security-architecture.md
- docs/supabase-hardening.md
- supabase/schema-security-draft.sql

Important rules:

- Do not store plain national IDs in production.
- Do not expose SUPABASE_SERVICE_ROLE_KEY, STUDENT_ID_PEPPER, or GEMINI_API_KEY to browser code.
- Student exam access should go through server-side API endpoints.
- Student-facing payloads must never include answer keys.


## Backend foundation patch 003

This project now includes a secure backend foundation for Vercel API functions and Supabase.

New frontend helpers:

- src/config/env.ts
- src/lib/supabasePublic.ts
- src/lib/apiClient.ts

New server helpers:

- api/_lib/supabaseAdmin.js
- api/_lib/studentSession.js
- api/_lib/rateLimit.js

Test endpoints:

- /api/health
- /api/security-check
- /api/student-id-demo
- /api/student/exam-entry

Do not use real exams until the full database schema, RLS policies, teacher auth, student sessions, answer stripping, autosave, and submission locking are complete.

## Small fixes patch 004

Added safe local tooling:

- `npm run check:env`
- `npm run hash:national-id -- 0012345678`
- `npm run dev:vercel`

Read `docs/local-api-testing.md` and `docs/supabase-first-run.md` before connecting real data.
