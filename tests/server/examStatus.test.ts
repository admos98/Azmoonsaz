/**
 * BE-3 (status derived at request time) + BE-2 (exam code round-trip).
 *
 * These are the pure functions behind every exam read — no HTTP, no DB.
 */
import { describe, expect, it } from 'vitest';
import {
  deriveExamStatus,
  getExamAvailability,
  safeExamForStudent,
} from '../../api/_lib/examSecurity.js';
import { mapExam, randomExamCode } from '../../api/_lib/utils.js';

const T = (iso: string) => new Date(iso);

describe('deriveExamStatus', () => {
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
});

describe('getExamAvailability', () => {
  const now = T('2026-06-15T10:00:00.000Z');

  it('maps every state to the contract the student portal relies on', () => {
    expect(getExamAvailability(null, now)).toEqual({
      ok: false,
      status: 404,
      error: 'exam_not_found',
    });
    expect(getExamAvailability({ status: 'draft' }, now)).toEqual({
      ok: false,
      status: 403,
      error: 'exam_not_available',
    });
    expect(getExamAvailability({ status: 'archived' }, now)).toEqual({
      ok: false,
      status: 410,
      error: 'exam_closed',
    });
    expect(
      getExamAvailability(
        { status: 'scheduled', starts_at: '2026-06-15T12:00:00.000Z' },
        now,
      ),
    ).toEqual({ ok: false, status: 423, error: 'exam_not_open' });
    expect(
      getExamAvailability(
        { status: 'scheduled', ends_at: '2026-06-15T09:00:00.000Z' },
        now,
      ),
    ).toEqual({ ok: false, status: 410, error: 'exam_closed' });
    expect(
      getExamAvailability(
        {
          status: 'scheduled',
          starts_at: '2026-06-15T09:00:00.000Z',
          ends_at: '2026-06-15T11:00:00.000Z',
        },
        now,
      ),
    ).toEqual({ ok: true });
  });

  it('is decided by absolute instants, so the wall clock cannot move the window', () => {
    // 09:00Z is 12:30 in Tehran and 05:00 in New York — the same instant.
    const exam = { status: 'scheduled', starts_at: '2026-06-15T09:00:00.000Z' };
    expect(getExamAvailability(exam, T('2026-06-15T08:59:59.000Z')).error).toBe('exam_not_open');
    expect(getExamAvailability(exam, T('2026-06-15T09:00:00.000Z')).ok).toBe(true);
  });
});

describe('safeExamForStudent', () => {
  const exam = {
    id: 'exam-1',
    exam_code: 'ABC123',
    title: 'ریاضی',
    grade: 'هفتم',
    subject: 'ریاضی',
    status: 'scheduled',
    mode: 'official',
    starts_at: '2026-06-15T09:00:00.000Z',
    ends_at: '2026-06-15T11:00:00.000Z',
    duration_minutes: 45,
  };

  it('exposes the derived status, not the stored one', () => {
    const before = safeExamForStudent(exam, T('2026-06-15T08:00:00.000Z'));
    const during = safeExamForStudent(exam, T('2026-06-15T10:00:00.000Z'));
    expect(before.status).toBe('scheduled');
    expect(during.status).toBe('active');
  });

  it('never leaks answer keys to the student payload', () => {
    const payload = safeExamForStudent(
      { ...exam, answer_key: { correctAnswer: 'opt-2' }, status: 'active' },
      T('2026-06-15T10:00:00.000Z'),
    ) as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('correctAnswer');
    expect(serialized).not.toContain('answer_key');
    expect(Object.keys(payload)).toEqual([
      'id',
      'examCode',
      'title',
      'grade',
      'subject',
      'status',
      'mode',
      'startsAt',
      'endsAt',
      'durationMinutes',
    ]);
  });
});

describe('mapExam hydration', () => {
  const row = {
    id: 'exam-1',
    exam_code: 'XYZ789',
    title: 'ریاضی',
    grade: 'هفتم',
    subject: 'ریاضی',
    status: 'scheduled',
    mode: 'official',
    starts_at: '2026-06-15T09:00:00.000Z',
    ends_at: '2026-06-15T11:00:00.000Z',
    duration_minutes: 45,
    settings: {
      // A stale naive string left by an older client — the column must win.
      startTime: '2026-06-15T05:00:00',
      startDate: '2026-06-15',
      startHour: '08:30',
      shuffleQuestions: true,
    },
    created_at: '2026-06-01T00:00:00.000Z',
  };

  it('round-trips the server-minted exam code (the join link source of truth)', () => {
    const exam = mapExam(row);
    expect(exam.examCode).toBe('XYZ789');
    expect(exam.settings.startTime).toBe('2026-06-15T09:00:00.000Z');
    // Editor wall-clock fields survive so the settings screen reopens intact.
    expect(exam.settings.startDate).toBe('2026-06-15');
    expect(exam.settings.startHour).toBe('08:30');
  });

  it('reports a derived status rather than the stored value', () => {
    // Live window: mapExam derives against the real clock, so "scheduled"
    // must mean *actually* in the future, not a fixed past date.
    const liveRow = {
      ...row,
      starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
    expect(mapExam(liveRow).status).toBe('scheduled');
    expect(mapExam({ ...liveRow, status: 'draft' }).status).toBe('draft');
  });
});

describe('randomExamCode', () => {
  it('mints six characters from the unambiguous alphabet', () => {
    const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
    for (let i = 0; i < 50; i++) expect(randomExamCode()).toMatch(allowed);
  });

  it('does not collide across a burst of mints', () => {
    const codes = new Set(Array.from({ length: 200 }, () => randomExamCode()));
    expect(codes.size).toBe(200);
  });
});
