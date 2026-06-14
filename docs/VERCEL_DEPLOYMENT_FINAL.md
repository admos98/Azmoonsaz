# Final Vercel deployment guide

## 1. Pre-deploy local checks

Run:

npm run predeploy

This runs:

- TypeScript check
- production build
- production safety scan
- deployment env readiness check

## 2. GitHub

Push your repo to GitHub. Do not commit:

- .env.local
- supabase/seed-demo.generated.sql
- project-dump.txt
- project-tree.txt
- node_modules
- dist

## 3. Vercel project settings

Framework preset: Vite
Build command: npm run build
Output directory: dist

## 4. Vercel environment variables

Set these exactly:

VITE_APP_URL=https://YOUR_APP.vercel.app
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_OR_ANON_KEY
VITE_ENABLE_MOCK_MODE=false
SUPABASE_SERVICE_ROLE_KEY : YOUR_SERVICE_ROLE_KEY
STUDENT_ID_PEPPER : YOUR_LONG_RANDOM_SECRET
APP_URL=https://YOUR_APP.vercel.app

Never prefix service role or pepper with VITE_.

## 5. Supabase SQL before production

Run:

- supabase/schema-security-draft.sql
- supabase/migrations/002_grading_columns.sql

## 6. Post-deploy checks

Open:

/api/health
/api/security-check

Then test:

- teacher login
- add student
- add question
- create exam
- /exam/EXAMCODE student flow
- save answer
- submit
- teacher results

## 7. Security reminders

- RLS must stay enabled.
- Student national IDs must not be stored plain.
- Student payload must never include answer_key.
- Do not weaken CSP unless a specific production issue is identified.
