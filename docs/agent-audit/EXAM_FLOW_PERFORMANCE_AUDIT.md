# High-frequency exam-flow performance audit

_Last updated: 2026-09-25_

## Identified hot path

`ExamPortal` previously owned `timerSeconds`. Its one-second interval updated the parent page, causing React to reconcile the full question renderer, answer controls, navigation map, alerts, mobile sheet, and submission UI every second regardless of user activity.

## Correction

The countdown now lives in the memoized `ExamCountdown` leaf component. It receives only duration, start time, and expiration behavior. Its interval updates local state, so ordinary ticks reconcile only the timer subtree. Expiration still invokes the existing submission path through a current callback ref. The component calculates resumed time from the persisted submission start timestamp, exposes `role="timer"` with a Persian accessible description, and keeps rapidly changing visible digits out of repeated screen-reader announcements.

## Other observations

- Answer persistence remains event-driven rather than timer-driven.
- Question navigation derives its status from answer state and does not poll.
- Search normalization in teacher lists is outside the student answer loop.
- The heterogeneous answer model should be migrated with question-type discriminated unions; a broad union replacement is unsafe and was intentionally rejected.

## Remaining measurement gate

Commit-level React Profiler traces on a representative low-end Android device remain a release-environment task. The architectural one-second parent rerender is removed, but device-specific interaction latency must not be claimed from static inspection alone.
