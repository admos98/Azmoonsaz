# Backend fixes — status after the 2026-10-06 pass

> History: written from Rounds 2–4 triage on 2026-10-05; frontend halves landed
> in `674d2ab`. This revision re-audited every claim against the tree, shipped
> the server halves, and closed what was already closed.
>
> **Server tests now exist:** `tests/server/**` (config
> `vitest.server.config.ts`, typechecked by `tsconfig.server.json`). `npm test`
> runs browser + server suites; `npm run typecheck:server` checks the API
> side. Both are wired into `check` and `gate`.

## BE-1 · Bulk student-import endpoint — ✅ shipped

`POST /api/teacher/students/bulk` replaces N sequential POSTs with one call:

- validates every row server-side (Iranian national-ID checksum, required
  fields), resolves class groups **once per distinct class** — no N lookups and
  no race that creates the same class twice;
- inserts in batches of 10 and answers for **every** row: `imported[]` or
  `failed[{ row, reason }]` — never a silent count;
- idempotent on `unique (teacher_id, national_id_hash)`: a re-run row returns
  `duplicate_student`, never a duplicate student;
- returns hash + last-4 only — the plain national ID never leaves the server.

Frontend: `studentService.importStudents` is a single request and the wizard
renders each failed row with its Persian reason.

**Tests:** `tests/server/studentsBulk.test.ts` (9 cases: happy path, per-row
reasons, duplicates, class-not-found, 400s, 500-row cap, 429, 405, hashing).

## BE-2 · Exam join code: single source of truth — ✅ closed

Client-side minting is gone: `ExamSettings.tsx` derives the link from
`exam.examCode` and no longer persists `settings.examLink` (the old
`AZMOON-{grade}-{rand}` code never matched `exam_code` and 404'd). The server
mints `exam_code` at create and `mapExam` round-trips it.

**Test:** `tests/server/examCreate.test.ts` — stored code === returned code,
scheduling instant survives the round trip.

## BE-3 · Scheduling — ✅ fixed (the original evidence was stale)

The doc's evidence (mock clock `2026-06-13`, hardcoded defaults, decorative
`_timezone`) no longer exists in the tree — and window enforcement at request
time already lived in `getExamAvailability`. What the audit *missed* was the
actual bug, now fixed:

**Naive strings (`2026-06-15T08:30`) written into `timestamptz` are cast as UTC
by Postgres while the teacher means Tehran — every exam window was 3h30m off.**

- `src/utils/tehranClock.ts` — `wallClockToIso` / `isoToWallClock` with an
  explicit `+03:30` (Iran has had no DST since 2022). `ExamSettings.tsx` emits
  instants from both save paths and recovers legacy wall clocks on load.
- `api/_lib/examSecurity.js` — `deriveExamStatus(exam, now)` is the single
  source of truth: stored intent + start/end window, evaluated per read.
  `getExamAvailability`, `safeExamForStudent` and `mapExam` all consume it, so
  status flips without a re-save and the student payload matches the badge.

**Tests:** `tests/server/examStatus.test.ts` (12 cases: sticky states, window
transitions, garbage timestamps, availability contract, answer-key leak).

## BE-4 · AI grading — ✅ closed, decision: do not build

Zero random-grade code paths remain (the only `Math.random` near grading is
inside a comment explaining its removal), and no `/api/teacher/ai-grade` route
exists. Grades are teacher-entered only. The acceptance — "zero random-grade
code paths in the tree" — is met.

## BE-5 · Submissions scoping — ✅ verified, nothing to build

`api/routes/teacher.js` scopes every query to the teacher's own exams and 403s
a foreign `examId`. The frontend intentionally fetches once and derives the
per-exam view client-side (`ExamResults.tsx`, a shared-cache design that
replaced a per-page refetch), so `?examId=` stays optional — the server default
is teacher-scoped, never global.

**Tests:** `tests/server/submissionsScope.test.ts` — foreign examId → 403,
owned examId → only that exam's rows, omitted examId → this teacher's exams
only.

## BE-6 · Request hygiene — ✅ shipped with BE-1

- Rate limit on the bulk surface: `students-bulk:<teacherId>`, 10/min, backed
  by the Supabase `rate_limits` table with an in-memory fallback.
- `AbortController`: `teacherGet`/`teacherPost` accept `{ signal }`; the import
  wizard aborts in-flight imports when the modal closes.
- Idempotency came free from the unique constraint (see BE-1).

**Tests:** rate-limit case in `studentsBulk.test.ts`; the wizard's signal
assertion in `src/test/features/StudentImportWizard.test.tsx`.

## Explicitly NOT backend work (stays frontend)

- P0-4 Excel: `xlsx@^0.18.5` is already a dependency — real XLSX export is a
  frontend-only change (plus deleting the fake ExcelJS success toast).
- P1-9 CSV: quote escaping + formula-injection guard + masked-national-ID
  export live in `src/pages/teacher/exam-results/student-rows.ts`.
- P1-2 `/dev/` harness: **already fixed** in `83bc374` (`import.meta.env.DEV`
  gating at `App.tsx`).
- P2-1 AGENTS.md rewrite, P2-2 test trim, F-7/F-10 hygiene: frontend docs/tests.
- E2E (`tests/e2e/exam-flow.spec.ts`) still drives the `DEMO7` fixture; a full
  authenticated Playwright journey needs seeded credentials — tracked as
  E2E/frontend work, not server work.
