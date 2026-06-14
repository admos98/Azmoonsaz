# Deployment checklist

## Before deploy

Run:

npm run lint
npm run build
npm run verify:prod

Confirm .env.local is not committed:

git status

## Vercel environment variables

Set these in Vercel project settings:

- VITE_APP_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- STUDENT_ID_PEPPER
- APP_URL

Never expose service role or pepper with a VITE_ prefix.

## Vercel settings

Framework: Vite
Build command: npm run build
Output directory: dist

## Post-deploy checks

Open:

/api/health
/api/security-check

security-check must show all required booleans as true.

Then test:

- teacher login
- student creation
- question creation
- exam creation
- /secure-exam/DEMO7 or a newly published exam code
