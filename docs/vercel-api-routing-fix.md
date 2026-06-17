# Vercel API routing fix

Patch 017 consolidates the API into api/index.js and adds a rewrite in vercel.json:

/api/:path* -> /api?path=:path*

This fixes production 404 errors such as /api/teacher/me while staying within Vercel Hobby's serverless function limit.

After deployment, test:

- /api
- /api/health
- /api/security-check
- /api/teacher/me after logging in
