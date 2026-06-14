# Local API testing

Vite dev server runs the frontend only. It does not run Vercel API functions from the api folder.

For frontend-only work:

```powershell
npm run dev
```

For frontend plus API function testing:

```powershell
npm run dev:vercel
```

The first run may ask you to log in to Vercel. That is normal.

Useful checks:

```powershell
npm run check:env
```

Then open:

- http://localhost:3000/api/health
- http://localhost:3000/api/security-check

Never paste SUPABASE_SERVICE_ROLE_KEY, STUDENT_ID_PEPPER, or GEMINI_API_KEY into chat or frontend code.


## Patch 006 note

Vercel dev may not always expose local environment variables to API functions in the same way as Vite. The API now explicitly loads .env.local from the project root for local development. Production still uses Vercel environment variables.

If /api/security-check shows all values as false, stop and restart npm run dev:vercel after editing .env.local.
