# Route migration and mock lockdown

Patch 013 makes /exam/:code use the secure backend route when Supabase is configured and VITE_ENABLE_MOCK_MODE is false.

## Routes

- /exam/:code: secure route in backend mode, mock route only when mock mode is enabled or Supabase is not configured.
- /secure-exam/:code: always secure route.
- /mock-exam/:code: explicit mock route for local demos.

## Production env

Use:

VITE_ENABLE_MOCK_MODE=false

Do not enable mock mode in production.

## Migration

Run this SQL in Supabase SQL Editor before final production grading work:

supabase/migrations/002_grading_columns.sql
