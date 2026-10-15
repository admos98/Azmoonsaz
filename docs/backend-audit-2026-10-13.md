# Backend audit — 2026-10-13 (check-only, all 21 API files + migrations)

Scope: `api/**/*.js` (21 files), `supabase/migrations/*.sql`. Read-only pass,
every finding verified against current code. No fixes in this pass.

Verdict: **PASS-WITH-NOTES. No release-blockers.** Auth coverage, secret
handling, tenant isolation, and the answer-contract batch all hold.

## Verified clean (credit)

- All 23 handlers mounted in `api/index.js`; every teacher route calls
  `requireTeacher()` first; every student route verifies the JWT + matches
  sid/eid/stid against the DB row.
- PIN: domain-separated HMAC (`student_pin:`), trivial-PIN ban, CAS setup,
  `timingSafeEqual` verify, reset revokes ongoing sessions (`pin_reset`).
- Revocation enforced per-request via session status — JWT TTL is irrelevant
  to kill-time.
- Images: write-time 403 ownership (`utils.js:95`), payload mint filtered to
  owner prefix + unminted keys stripped (`student.js:463-490`), SSRF manual
  5-hop chain + per-hop and DNS-rebinding guards (`images.js:140-255`).
- Answer keys never in any student select; `sanitizeBody` whitelist +
  `stripTeacherOnlyFields` on every student-facing body.
- Rate limits on all mutating surfaces (teacher-write 120/min global +
  per-endpoint budgets; student save 120/min; payload 20/min).
- `safeError` prod-opaque; zero `console.log`; zero TODOs; zero raw SQL
  except the `bump_rate_limit` RPC; secrets server-only
  (`supabaseAdmin.js`, `crypto.js`, `studentSession.js`); no VITE secrets.
- `__proto__` answer keys are dropped by `sanitizeRecord` into a fresh `{}` —
  no pollution path (no `Object.assign`/spread of raw answers server-side).

## Findings

| ID | Sev | Location | Finding | Disposition |
|----|-----|----------|---------|-------------|
| M1 | Med | `teacher.js:1058-1077` | finalize sets `graded` on any owned session, incl. `ongoing` — cuts a live exam off, scores ~0 | FIXED: conditional update on `status=submitted`, 409 `submission_not_submitted` otherwise |
| M2 | Med | `teacher.js:257-267` | class delete: students `SET NULL`, allowed-classes `CASCADE` — deleting the last allowed class silently widens a restricted exam to whole-roster | FIXED: 409 `class_has_students` / `class_used_by_exam` while referenced + audit row |
| M3 | Med | `teacher.js:768-771,787-798` | exam create never checks allowed-classes / exam-questions inserts — silent partial create (unrestricted or question-less exam) | FIXED: ownership pre-validated before insert; both link inserts checked with compensating exam delete; audit row |
| ML1 | Med-low | `student.js:209-218` | PIN-setup 200 vs 403 distinguishes enrolled IDs (F-12 gap) | ACCEPTED: signal is the designed UX; identity bucket 10/min; self-closes after setup |
| ML2 | Med-low | `student.js:345-368` | 23505 race-rejoin mints a token without window/availability checks and without pin_reset re-admit | FIXED: shared `evaluateRejoin` helper, both paths, contract codes preserved |
| ML3 | Med-low | `teacher.js:941-945` | submissions student lookup `.in(id)` without `teacher_id` scope | FIXED: added `.eq('teacher_id', teacher.id)` |
| ML4 | Med-low | `teacher.js` various | no audit rows for student/class/question/exam CRUD + deletes (grade/finalize/reset/bulk covered) | FIXED: `auditLog` on all 12 uncovered mutating actions, ids only |
| L1 | Low | `examSecurity.js:65-86` | stale comment (matching/ordering teacher-only — false since T1) + unreachable array branch on hostile shapes | FIXED: comment describes live fallback role, behavior frozen |
| L2 | Low | `studentSession.js:60` | `JSON.parse` outside try/catch on attacker-controlled segment | FIXED: try/catch → null |
| L3 | Low | `teacher.js:1004`, `utils.js:150-160`, `teacher.js:733,807` | uncapped strings: grade comment, question display metadata, exam description/settings blob | FIXED: 2k comment/description caps; tags 20×40, section 100, difficulty enum-or-20, completenessStatus enum |
| L4 | Low | `turnstile.js:13-17` | outbound `fetch` with no timeout | FIXED: `AbortSignal.timeout(10s)`, runtime-guarded |
| L5 | Low | `teacher.js:377-383` + `student.js:223-241` | must_change+hash row would lock out (setup CAS needs NULL) | VERIFIED-UNREACHABLE: sole producer nulls both atomically; no fix |
| L6 | Low | `s3Store.js` | S3 driver zero test coverage | ACCEPTED: dormant until fully configured; revisit on activation |
| L7 | Low | `teacher.js:672-677` | sibling orphan-scan caps at 2000 rows | ACCEPTED: free-tier scale; cleanup sweep converges on re-run |
| L8 | Low | — (absence) | exam-question membership immutable post-create | ACCEPTED: design; delete+recreate covers it |
| L9 | Low | `images.js:28` vs `:126` | upload allowlist excludes gif, everything downstream accepts it | FIXED: gif accepted at upload + regression test |
| L10 | Low | `examSecurity.js:329-358` | `__proto__` answer keys silently dropped (verified benign — fresh-object assignment, never serialized) | FIXED: regression test, no code change |
| L11 | Low | `teacher.js:652-668` | mid-exam question delete silently drops it from the live paper | ACCEPTED: deliberate teacher action, same as editing text mid-exam |

## Out of scope (not findings — unread)

`supabaseStore.js:1-84`, RLS policy migration bodies, PIN-migration backfill
shape, `vercel.json` CSP, live prod state.

## Round 2 — data layer + storage (2026-10-13, same session)

Scope: `api/_lib/supabaseStore.js:85-160`, `s3Store.js` (full),
all 16 migrations, browser→DB surface. Read-only; no code changes.

### S1 — exam_allowed_classes / exam_questions: FORCE RLS, zero policies (by design — VERIFIED CLEAN)
Both junction tables carry ENABLE + FORCE RLS with no policies anywhere in
history: deny-all for every role except the service role (which bypasses
RLS). The only readers/writers are the API handlers via `getSupabaseAdmin()`
(`teacher.js` exams/submissions/questions/hydrate, `student.js` start/payload/
save/grade), each with handler-level ownership checks (requireTeacher,
requireOwnedSession, exam_allowed_classes membership, question ownership).
No browser client touches either table directly (grep: zero `.from(` on tables
in `src/` outside tests — the browser reaches only Auth + Storage). This is
the same deny-all pattern as `audit_logs` / `rate_limits`, documented. No fix.

### S2 — RLS policy coverage on the rest (VERIFIED CLEAN)
- Owner tables (`teacher_profiles`, `class_groups`, `students`, `exams`,
  `questions`, `teacher_schools`, `teacher_schedule`): `teacher_id = auth.uid()`
  (initplan form), FORCE RLS. `students`/`student_exam_sessions`/
  `student_answers` intentionally have NO student-tier policy — students never
  hold a Supabase session; every student read goes through the service role
  behind the signed JWT + triple-ID match.
- `question-images`: public-read policy dropped in `...0002`, bucket flipped
  private + 5 MB + MIME allow-list; `...0009` scopes select/insert to the
  teacher's own folder (`foldername(name)[1] = auth.uid()`). No UPDATE/DELETE
  policy — overwrite/delete impossible from any client; service role only.
- `audit_logs`, `rate_limits`: ENABLE + FORCE, zero policies (deny-all),
  service-role writers only.
- `teacher-avatars`: public bucket by design (avatars render via public URL);
  insert/update path-scoped to own folder. Browser `upsert:true` on own path
  only — correct.

### S3 — avatar extension allow-list gap (LOW, accepted)
`storageService.ts:10` takes any `file.name` extension (`.svg`, `.exe`) while
the bucket allow-list is jpeg/png/webp; Storage rejects the upload, so the
only effect is a confusing error after 5 MB of upload. Client `file.size`
check also duplicated server-side by the bucket cap. No fix (defense already
at the enforcement point).

### S4 — PIN migrations consistent with code (VERIFIED CLEAN)
`20261012000001`: nullable `pin_hash`/`pin_set_at`, `pin_must_change`
default false, unique `(exam_id, student_id)` — matches the CAS (`.is('pin_hash',
null)`) and the 23505 race path. `20261012000002`: nullable text
`invalidated_reason`, matches the reset/re-admit contract. The migration
comment still says "delete + fresh mint; answers cascade" while the code does
update-in-place + explicit wipe — stale comment, cosmetic only (schema itself
is right).

### S5 — store drivers (VERIFIED CLEAN)
Supabase driver: every mutating op asserts ownership (`mintUploadUrl`,
`deleteObject`, `putObject`, `listObjects` prefix-exact); the sole unchecked
op is `mintReadUrlUnchecked`, whose only caller pre-filters to the exam-owner
prefix and strips unminted keys. S3 driver mirrors the same asserts. `upsert:
false` on both server writes — no silent overwrite.

No live prod access from this shell (no service key / pepper locally, per
design) — prod-state verification stays an operator step.

## Verification

- `npm run typecheck:server` clean
- Server suite 181/181 (13 files); full suite 277 + 181 on the base commit
- `npm run verify:prod` passed
