import { describe, it, expect } from 'vitest';
import { deriveExamStatus } from '../../lib/examStatus';

/**
 * CQ-9: case-for-case parity with tests/server/examStatus.test.ts.
 * src/lib/examStatus.ts is the client twin of
 * api/_lib/examSecurity.js#deriveExamStatus — when one side changes, the
 * other's suite must be updated in the same commit.
 */
const T = (iso: string) => new Date(iso);

describe('deriveExamStatus (client parity twin)', () => {
  it('keeps teacher intent sticky for draft / archived / completed', () => {
    const now = T('2026-06-15T10:00:00.000Z');
    const window = { starts_at: '2026-06-15T09:00:00.000Z', ends_at: '2026-06-15T11:00:00.000Z' };

    expect(deriveExamStatus({ ...window, status: 'draft' }, now)).toBe('draft');
    expect(deriveExamStatus({ ...window, status: 'archived' }, now)).toBe('archived');
    // A manually closed exam stays closed even though the window is open —
    // only the teacher can reopen it.
    expect(deriveExamStatus({ ...window, status: 'completed' }, now)).toBe('completed');
  });

  it('flips scheduled -> active -> completed without any re-save', () => {
    const exam = {
      status: 'scheduled',
      starts_at: '2026-06-15T09:00:00.000Z',
      ends_at: '2026-06-15T11:00:00.000Z',
    };
    expect(deriveExamStatus(exam, T('2026-06-15T08:59:59.000Z'))).toBe('scheduled');
    expect(deriveExamStatus(exam, T('2026-06-15T09:00:00.000Z'))).toBe('active');
    expect(deriveExamStatus(exam, T('2026-06-15T10:59:59.000Z'))).toBe('active');
    expect(deriveExamStatus(exam, T('2026-06-15T11:00:01.000Z'))).toBe('completed');
  });

  it('treats a stored "active" exam with no timestamps as open', () => {
    expect(deriveExamStatus({ status: 'active' }, T('2026-06-15T10:00:00.000Z'))).toBe('active');
  });

  it('falls back to active when a timestamp is garbage instead of crashing', () => {
    const now = T('2026-06-15T10:00:00.000Z');
    expect(
      deriveExamStatus({ status: 'active', starts_at: 'not-a-date', ends_at: 'also-bad' }, now),
    ).toBe('active');
  });

  it('defaults a missing status to active (publish flow contract)', () => {
    // ExamSettings' publish flow calls this with status 'active' and the
    // freshly-converted Tehran wall clock — the clock alone must decide.
    const exam = {
      status: 'active',
      starts_at: '2026-06-15T09:00:00.000Z',
      ends_at: '2026-06-15T11:00:00.000Z',
    };
    expect(deriveExamStatus(exam, T('2026-06-15T08:00:00.000Z'))).toBe('scheduled');
    expect(deriveExamStatus(exam, T('2026-06-15T10:00:00.000Z'))).toBe('active');
    expect(deriveExamStatus(exam, T('2026-06-15T12:00:00.000Z'))).toBe('completed');
  });

  it('handles missing/null timestamp fields like the server', () => {
    const now = T('2026-06-15T10:00:00.000Z');
    expect(deriveExamStatus({ status: 'active', starts_at: null, ends_at: null }, now)).toBe(
      'active',
    );
    expect(
      deriveExamStatus({ status: 'scheduled', ends_at: '2026-06-15T09:00:00.000Z' }, now),
    ).toBe('completed');
  });

  it('is decided by absolute instants, so the wall clock cannot move the window', () => {
    // 09:00Z is 12:30 in Tehran and 05:00 in New York — the same instant.
    const exam = { status: 'scheduled', starts_at: '2026-06-15T09:00:00.000Z' };
    expect(deriveExamStatus(exam, T('2026-06-15T08:59:59.000Z'))).toBe('scheduled');
    expect(deriveExamStatus(exam, T('2026-06-15T09:00:00.000Z'))).toBe('active');
  });
});
