/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client parity twin of `deriveExamStatus()` in `api/_lib/examSecurity.js`.
 *
 * CQ-9: the previous inline mirror inside ExamSettings' publish flow only
 * implemented the clock branch (scheduled/active/completed) and silently
 * omitted the sticky `draft`/`archived`/`completed` branches — any future
 * caller reusing it would have drifted from the server's semantics. This
 * module is a character-for-character semantic port of the server function
 * (same branch order, same NaN guards); `src/test/lib/examStatus.test.ts`
 * mirrors `tests/server/examStatus.test.ts` case-for-case so the two
 * implementations are locked together by their test suites.
 *
 * Timestamps are absolute instants (timestamptz), so the comparison is
 * timezone-independent: Asia/Tehran only matters when the wall-clock input is
 * converted to an instant, which the frontend does via src/utils/tehranClock.
 */
export type DerivedExamStatus = 'draft' | 'archived' | 'completed' | 'scheduled' | 'active';

export interface StatusDerivationInput {
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export function deriveExamStatus(
  exam: StatusDerivationInput,
  now: Date = new Date(),
): DerivedExamStatus {
  const stored = exam?.status || 'active';
  if (stored === 'draft') return 'draft';
  if (stored === 'archived') return 'archived';
  // Teacher explicitly closed it — that decision wins over the clock.
  if (stored === 'completed') return 'completed';

  const startsAt = exam?.starts_at ? new Date(exam.starts_at) : null;
  const endsAt = exam?.ends_at ? new Date(exam.ends_at) : null;

  if (endsAt && !Number.isNaN(endsAt.getTime()) && now > endsAt) return 'completed';
  if (startsAt && !Number.isNaN(startsAt.getTime()) && now < startsAt) return 'scheduled';
  return 'active';
}
