# Data-safety and editor inventory

_Last reviewed: 2026-09-25_

This inventory separates persistent editors from transient filters and dialogs. A route is not considered protected merely because its primary save action works: browser close, in-app back actions, replacement imports, uploads, retries, and modal dismissal must also be considered.

| Surface | Persistent user input | Current protection | Remaining work |
| --- | --- | --- | --- |
| Exam Preview / builder | Exam questions and draft configuration | Reusable dirty-state guard protects both back actions and browser unload; dirty baseline resets after save/continue | Verify route changes initiated outside the page shell |
| Exam Settings | Schedule, access, behavior, results, instructions, publication status | Snapshot-based dirty detection protects both back actions and browser unload; successful save/publish resets baseline | Add component-level interaction coverage and a visible saved/failed status |
| Teacher Profile | Biography, contact and profile metadata, avatar | Avatar upload preserves unsaved biography; dirty drafts protect tab changes and browser unload; explicit saving/success/error states exist | Protect navigation initiated by the outer application shell |
| Questions | Question create/edit form and bulk operations | Dirty create/edit drafts protect drawer dismissal and browser unload; destructive confirmations exist | Assess suitable undo for deletion and outer-shell navigation |
| Students | Student create/edit form and CSV/XLSX import | Real import preview and confirmations exist; dirty add/edit drafts protect modal dismissal and browser unload | Protect destructive replacement/import transitions |
| Classes | Class create/edit form | Dirty create/edit drafts protect modal dismissal and browser unload; destructive confirmation exists | Assess suitable undo for deletion |
| Exam creation flow | Metadata and selected questions | Explicit continuation/save actions | Audit every step transition and browser unload; preserve step draft on retry |
| Grading/results | Scores, feedback and manual grading | Explicit actions | Inventory unsaved grading fields and failed-submit recovery |
| Application Settings | Appearance/motion and account settings | Display preferences persist immediately | Distinguish immediate preferences from server-backed profile fields; expose failure state where applicable |

## Shared implementation policy

- Use `useUnsavedChanges` for browser unload and every in-app action that can abandon a persistent draft.
- Reset the saved baseline only after the save operation has been accepted; asynchronous failures must leave the editor dirty.
- Do not autosave unless the backend operation is idempotent and failures can be surfaced and retried safely.
- Do not guard transient UI state such as search text, expanded panels, copied-link feedback, or validation visibility.
- Preserve user-entered fields across uploads, retries, tab changes, and recoverable network errors.
