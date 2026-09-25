# Product engineering decisions

_Last reviewed: 2026-09-25_

## Preference persistence

Browser-local persistence is the intentional default for display density, list filters, recent destinations, and notification controls. These values are non-sensitive, device-specific, validated on read, synchronized across tabs, and resettable. Supabase synchronization was evaluated and intentionally deferred: syncing device-specific density and transient filters would surprise users and adds a server contract without clear product value. Account-level synchronization can be reconsidered only with explicit per-preference semantics and migration behavior.

## Asynchronous-screen inventory

| Surface | Operations | Existing user state |
| --- | --- | --- |
| Authentication/onboarding | Session check, sign-in, profile creation | Loading states and actionable errors |
| Dashboard | Exams, submissions, health summaries | Stable skeletons, empty/error states where services expose failure |
| Exams and creation | Load/create/update exam and draft | Explicit save, guarded draft, validation feedback |
| Exam settings/preview | Load access data, save/publish | Guarded dirty state; explicit save actions |
| Questions | Load/create/update/delete questions | Editor draft preserved on failure; delete confirmation |
| Students/classes | Load and CRUD | Editor draft preserved on failure; confirmations |
| Student import | Parse, validate, preview, row imports | Parsing/importing states, retryable preview, partial result summary |
| Teacher profile/avatar | Upload and save | Uploading/saving/success/error states; draft preserved |
| Results/grading | Load submissions, grading and exports | Loading/empty states and explicit mutations |
| Student exam | Answer persistence, offline queue, submit | Real local persistence, queue, connectivity and submission state |
| Notifications | Exams and submissions refresh | Loading, empty, read/unread and category preferences |

Any newly introduced promise-backed screen or mutation must identify loading, empty, error, retry, success, offline, and draft-preservation behavior during review.

## Autosave policy

Autosave is permitted only in the student answer flow, where local persistence and the offline answer queue provide a real recovery contract. Teacher editors use explicit save/publish actions and dirty-state protection. Labels must not claim cloud persistence merely because local React state changed. New autosave behavior requires an idempotent backend operation, visible failure/retry state, and a tested recovery path.

## Virtualization decision

No current list has a measured rendering bottleneck that justifies virtualization. Pagination/filtering and responsive representations remain preferable because they preserve browser search, accessibility, and simpler focus behavior. Virtualization will be introduced only after profiling demonstrates a large-list interaction or rendering regression and includes keyboard/screen-reader verification.
