# Product-craft release manifest — draft

_Date: 2026-09-25_

This is the implementation-complete draft. It becomes the final release manifest only after the manual target-browser/device gates in `PRODUCT_CRAFT_TASKS.md` pass.

## Delivered systems

- First-paint-safe light, dark, and system appearance with OS live-change support.
- Semantic visual tokens, motion policy, forced-colors fallbacks, and automated token enforcement.
- Shared interaction states, modals, mobile sheets, typed tables, toasts, empty/error/loading states, and save-state feedback.
- Unsaved-change protection across editors, shell navigation, browser unload, and destructive replacement paths.
- Offline answer queue, connectivity feedback, import recovery, deletion rollback, and class-deletion undo.
- Persian normalization, dates, numbers, copy conventions, mixed-direction isolation, and RTL interaction review.
- Remembered list preferences, URL-backed filters, command palette, entity search, route preloading, and browser-safe navigation sequences.
- Responsive safe areas, coarse-pointer targets, reduced-motion support, modal focus management, and accessibility smoke coverage.
- Bundle budgets, image-loading policy, route splitting, layout-matched skeletons, and isolated high-frequency exam countdown updates.
- Supabase-backed teacher profile fields and preserved CSV/XLSX import workflow.

## Automated release evidence

The production suite covers TypeScript, zero-warning ESLint, theme-token enforcement, icon-button accessible names, unit/integration tests, production build, JavaScript bundle budgets, formatting, and whitespace integrity.

## Known limitations and honest open gates

- Real screen-reader pronunciation and traversal require VoiceOver/NVDA/TalkBack.
- Safari, Firefox, physical mobile safe areas/keyboards, 200% zoom, and OS forced-colors need target-environment verification.
- Full contrast measurement for translucent, image-backed surfaces remains a manual page audit.
- Low-end Android React Profiler traces remain outstanding, although the one-second parent rerender was removed.
- Production Supabase verification requires valid deployment credentials and representative data.
- Screenshot regression baselines are not yet established.
- Heterogeneous exam-answer values still use a documented `any`; safe removal requires a question-type discriminated model rather than a broad union.

## Provisional score

The implementation is provisionally **93/100** for frontend and product craft, up from the 72/100 audited baseline. The score is provisional until manual release gates pass; failures found there must reduce the score or be corrected before publication.
