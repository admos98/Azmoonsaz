# Backend fixes needed (from Rounds 2–4 triage, 2026-10-05)

Frontend-led work is NOT in this file — it ships as normal frontend batches.
Each item below needs `api/` work or a backend contract decision first.
Evidence paths verified against the tree at `5cf72da` + `f5c62ea`.

## BE-1 · Bulk student-import endpoint (P1-5) — new endpoint
- Today: `src/features/student-import/StudentImportWizard.tsx:129` awaits
  `studentService.createStudent` once per row — N sequential POSTs.
- Need: `POST /api/teacher/students:bulk` (or equivalent) accepting an array,
  validating each row server-side (Iranian national-ID checksum, duplicate
  detection, class-group resolution), returning per-row results
  `{ imported: [...], failed: [{ row, reason }] }`.
- Frontend then becomes one call + result render. Acceptance: 100-row import
  in < 5s on broadband; no partial-silence (every row accounted for).

## BE-2 · Exam join code: single source of truth (P0-1, server half)
- Today: `api/routes/teacher.js:253-257` already issues `randomExamCode()`
  server-side on create; but `src/pages/teacher/ExamSettings.tsx:326-337`
  mints its own `AZMOON-{grade}-{randCode}` client-side link and persists
  `settings.examLink` — two competing code systems.
- Need: confirm `GET exam` hydration always returns the server `exam_code`;
  frontend deletes randCode/gradeLetter/generatedLink and reads the code off
  the hydrated exam. `settings.examLink` stops being persisted.
- Acceptance: publish → student joins with the server code → submits →
  teacher grades, covered by extending `tests/e2e/exam-flow.spec.ts`
  (infra exists: `playwright.config.ts` + one spec already).

## BE-3 · Scheduling evaluated server-side at request time (P0-3, server half)
- Today: `ExamSettings.tsx:339-341` compares against a hardcoded
  `new Date('2026-06-13T18:36:44-07:00')` mock clock; defaults `:53-56`
  hardcode `2026-06-15`; `_timezone:60` is a decorative label, never used
  in computation.
- Need: exam `status` (scheduled/active/completed) derived on the server
  from stored start/end timestamps at request time, in Asia/Tehran;
  frontend sends real timestamps and renders the returned status.
- Acceptance: no `Date('2026-…')` literals in src; status flips without a
  teacher re-save; timezone explicit end-to-end.

## BE-4 · AI grading: build it or keep it deleted (P0-2, decision)
- Today: `ExamResults.tsx:261-303` `triggerAiAssistedGrading` assigns
  `0.85 + Math.random() * 0.12` of rubric points as real student scores.
  No `/api/teacher/ai-grade` exists. Frontend batch will delete the button
  and the function.
- Decision needed: is server-side AI grading on the roadmap? If yes, spec
  the endpoint contract (input: submission answers + rubric; output:
  per-rubric scores + rationales; model, cost cap, teacher-override rule).
  If no, BE-4 closes the moment the frontend deletion lands.
- Acceptance: either a live endpoint with eval coverage, or zero
  random-grade code paths in the tree.

## BE-5 · Submissions scoping: verify, don't build (P1-4, server half)
- Server already scopes: `api/routes/teacher.js:297-302` (`examId` query,
  `allowedExamIds`, `exam_not_owned` 403). Frontend calls
  `getSubmissions(undefined)` (all exams) from `TeacherContext`.
- Need: confirm the `examId` param path is covered by a server test or
  smoke check; frontend then passes the current exam's id. No new endpoint.
- Acceptance: ExamResults for exam A never receives exam B rows even if
  the client omits the param (server default-deny or teacher-scoped).

## BE-6 · Request hygiene on the new endpoints
- `AbortController` support: no `signal` plumbing exists anywhere in
  `src/contexts` or `src/services` (frontend adds it alongside BE-1/BE-5
  work). Server should tolerate client disconnects on bulk import
  (idempotency key or dedupe on national-ID hash per exam).
- Rate limits on BE-1/BE-4 (bulk + AI are the two abuse-prone surfaces).

## Explicitly NOT backend work (stays frontend)
- P0-4 Excel: `xlsx@^0.18.5` is already a dependency — real XLSX export is
  a frontend-only change (plus deleting the fake ExcelJS success toast at
  `ExamResults.tsx:395-402`).
- P1-9 CSV: quote escaping + formula-injection guard + masked-national-ID
  export all live in `src/pages/teacher/exam-results/student-rows.ts`.
- P1-2 `/dev/` harness: ships in the prod bundle behind a runtime pathname
  check (`App.tsx:284`) — fix is `import.meta.env.DEV` gating (Vite
  dead-code-eliminates it). No server involvement.
- P2-1 AGENTS.md rewrite, P2-2 test trim, F-7/F-10 hygiene: frontend docs/tests.
