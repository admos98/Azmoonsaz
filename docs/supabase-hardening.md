# Supabase Hardening Plan

## 1. Auth

- Use Supabase Auth for teachers only.
- Disable public signups unless you explicitly want teacher self-registration.
- Enable email confirmations.
- Use MFA for teachers where possible.

## 2. RLS

Enable RLS on every table.

Default posture:

- No anonymous table reads.
- No anonymous table writes.
- Teachers can access only rows connected to their school/profile.
- Students should not query tables directly. Student access should go through API endpoints.

## 3. Secrets

Never place these in frontend code or VITE variables:

- SUPABASE_SERVICE_ROLE_KEY
- STUDENT_ID_PEPPER
- GEMINI_API_KEY

Only use them in server code.

## 4. Storage

Use private buckets by default:

- question-images
- exam-assets
- student-uploads if needed later

For student exam display, generate signed URLs with short expiry or proxy files through an authenticated API.

## 5. National ID handling

Production table should store:

- national_id_hash as HMAC-SHA256
- national_id_last4 for display

Avoid storing plain national_id.

## 6. Rate limiting

Vercel serverless memory rate limiting is not enough for production. For free MVP, start with basic in-memory throttling, but later use:

- Upstash Redis free tier, or
- Supabase-backed attempt logs, or
- Cloudflare Turnstile for public student entry.

## 7. Backups

Supabase free tier has limitations. Export important data regularly if used for real exams.
