# BACKEND & SECURITY — remaining tasks

> Written 2026-10-15. Everything previously tracked in `docs/backend-fixes-needed.md`,
> `docs/backend-audit-2026-10-13.md` and `docs/supabase-hardening.md` is either shipped or
> repeated below. Verified against the tree, not against old notes.
> Scope: `api/**`, `supabase/migrations/**`, deploy/ops.

## Status of the last backend audit (2026-10-13)

Verdict was **PASS-WITH-NOTES, no release-blockers**. Of 25 findings: 12 FIXED,
1 accepted (ML1), 1 verified-unreachable (L5), the rest accepted with reasons.
Round 2 (data layer + storage) closed S1–S5 verified-clean except S3 (accepted).
Nothing from that audit is an open blocker. The items below are what remains.

---

## 1. Operator-only (cannot be run from the dev shell)

- [ ] **Prod-state verification.** RLS policies, rate-limit behaviour and
      `security-check` against the live project after any schema change.
      Local shells have no service key / pepper by design, so this needs the
      Vercel/Supabase dashboard. Run after every `supabase db push`.
      Check: `/api/security-check` returns `configured: true`; teacher login,
      student creation, question creation, exam creation, one published exam
      code walked end to end.
- [ ] **Keep `supabase db push` and the deployed API in step.** The API assumes
      the current migration set is applied. 18 migrations are in sync today.

## 2. Dormant code — must be revisited on activation

- [ ] **S3 driver has zero test coverage (`api/_lib/s3Store.js`).**
      Accepted while dormant: the provider stays on Supabase Storage unless all
      four `S3_*` env vars are set. On the day S3 is switched on, write driver
      tests mirroring `tests/server/imageStore.test.ts` (ownership asserts on
      `mintUploadUrl` / `deleteObject` / `putObject` / `listObjects`,
      `upsert: false`, prefix-exact listing) and run a live migration of one
      image before trusting it.
- [ ] **S3 deployment: extend the CSP in `vercel.json`.** `connect-src` **and**
      `img-src` must include the S3 origin (browser PUTs directly, then `<img>`
      loads). Supabase needs no change — `*.supabase.co` is already allowed.
      Until this is done, flipping to S3 breaks uploads and rendering.

## 3. Accepted trade-offs — documented, do not "fix" without a product decision

- **ML1 · PIN-setup 200 vs 403 reveals enrollment.** The difference is the
  designed UX; the identity bucket is 10/min and the signal self-closes once a
  PIN is set. Revisit only if enrollment enumeration becomes a real threat.
- **S3 · avatar extension allow-list gap.** `storageService.ts` accepts any
  filename extension while the bucket allow-list is jpeg/png/webp. Storage
  rejects the upload, so the only effect is a confusing error after a 5 MB
  upload. Enforcement already sits at the correct layer.
- **L6/L7/L8/L11 · scale and design limits.** Orphan-scan caps at 2000 rows
  (free-tier scale, converges on re-run); exam-question membership is immutable
  post-create by design; mid-exam question deletion is a deliberate teacher act.
- **PIN first-setup.** Per the stated local-school scope this stays an
  operational trade-off, not a launch blocker. Keep exam-code distribution
  controlled; use the teacher reset flow if a student reports an enrollment
  problem.

## 4. Hygiene / small

- [ ] **`npm run check:env` exits non-zero locally** because
      `SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_ID_PEPPER` and `APP_URL` are
      server-only and deliberately absent from `.env.local`. Decide whether a
      local run should warn instead of fail, or document the expectation in the
      script header. Currently non-zero is correct-but-alarming.
- [ ] **Connection pinning for image migration (deliberate non-fix).** The SSRF
      chain validates each hop and re-checks after DNS resolution, but does not
      pin the socket to the validated IP. Doing so needs a custom agent/
      dispatcher. Safe while the endpoint stays teacher-authenticated, bounded
      and free of untrusted legacy rows; revisit if that changes.
- [ ] **`docs/supabase-hardening.md` and `docs/security-architecture.md`** are
      the surviving reference docs. Re-read them before touching RLS or the
      auth model; they describe intent, the migrations are the truth.

## 5. Verification commands

```bash
npm run typecheck:server      # API-side types
npm test                      # browser + server suites
npm run verify:prod           # secret-marker scan
npm run gate                  # the real gate (incl. typecheck:e2e + Playwright)
```

`npm run gate` is the only thing that runs the E2E type-check and Playwright;
`hermes verify` does not cover those.
