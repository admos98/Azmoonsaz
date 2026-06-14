# Azmoonsaz Security Architecture

This project handles student identity data, exam questions, exam schedules, answers, and grading. Treat it as sensitive educational data.

## Security goal

Use a zero-trust design:

- The browser is untrusted.
- Students are untrusted clients.
- Teachers are authenticated users, but can only access their own school/class data.
- National IDs must never be stored or exposed in plain text in production.
- The Supabase service-role key must never be shipped to the browser.
- All sensitive writes must go through server-side code.

## Recommended production stack

- Vercel for hosting the Vite frontend and serverless API endpoints.
- Supabase Postgres for database.
- Supabase Auth for teacher accounts.
- Supabase Storage for question/exam images.
- Vercel environment variables for server-only secrets.

## Critical rule: no plain national IDs

Production should store:

- national_id_hash: HMAC-SHA256(nationalId, STUDENT_ID_PEPPER)
- national_id_last4: for masked display only

Do not store full national IDs unless a legal/compliance requirement forces it. If you must store them, encrypt them server-side and keep the key out of the database.

## Student login model

Students should not use Supabase Auth directly in version 1.

Use a backend endpoint:

1. Student opens /exam/:examCode.
2. Student enters national ID and optional access code.
3. API normalizes and validates the ID.
4. API computes national_id_hash using server-only STUDENT_ID_PEPPER.
5. API checks exam schedule, allowed class/student, attempts, previous submission.
6. API creates a short-lived signed student session token.
7. All answer autosaves/submission calls use that student session token.

## Teacher auth model

Teachers should use Supabase Auth with email/password.

Minimum requirements:

- Email confirmation enabled.
- Strong passwords.
- MFA enabled for teacher accounts if available on your plan.
- RLS policies restricting each teacher to their own school/classes/exams.

## Server-only operations

These operations should be done only by Vercel API functions or Supabase Edge Functions:

- Student national ID lookup.
- Exam start/session creation.
- Beast Mode variant generation.
- Autosave answer validation.
- Final exam submission.
- Manual grading writes.
- Image upload signing if private buckets are used.
- AI-assisted grading.

## Frontend should never contain

- Supabase service role key.
- Gemini API key.
- Student national IDs.
- Full student lists on public routes.
- Answer keys in student exam payloads.
- Unpublished exam questions.

## Exam payload rules

Student-facing exam payload must exclude:

- correctAnswer
- correctFillBlanks
- rubrics unless intentionally shown after grading
- teacher-only explanations
- hidden tags used for generation

## Anti-cheat reality

Browser anti-cheat is limited. You can add warnings and logs, but you cannot guarantee full lockdown in a normal browser.

Use audit signals instead:

- tab blur/focus events
- suspicious refreshes
- multiple sessions
- IP/user-agent changes
- time anomalies
- excessive answer changes

Do not rely on these as perfect proof of cheating.

## Deployment hardening

Vercel should set security headers. This repo includes vercel.json with:

- HSTS
- CSP
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy
- X-Content-Type-Options

Test after deployment because strict CSP can break external assets.

## Logging and audit trail

Create an audit_logs table for:

- teacher login/logout
- student exam start
- autosave failures
- submission
- grading changes
- publish/unpublish exam
- suspicious activity

Logs should be append-only in normal app flows.
