# Mock cleanup plan

The app still contains mock data for fallback/demo mode. Do not remove everything blindly.

## Safe cleanup order

1. Keep mock fallback while real backend features are still being migrated.
2. Add VITE_ENABLE_MOCK_MODE=false before production.
3. Hide mock shortcuts from production UI.
4. Remove mock national IDs from production bundles.
5. Replace mock images with local placeholders or Supabase Storage assets.
6. Keep tests/fixtures separate from runtime source.

## Already real or partially real

- Teacher auth: real Supabase Auth
- Student management: real backend
- Secure student exam route: real backend
- Question bank: real backend after Patch 011
- Exams: real backend after Patch 011

## Still needs migration

- Results/grading dashboard
- Advanced exam builder templates
- Image upload/storage
- Beast Mode variants
