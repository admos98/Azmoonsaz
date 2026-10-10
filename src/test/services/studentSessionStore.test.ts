import { beforeEach, describe, expect, it } from 'vitest';
import {
  persistExamSession,
  readPersistedExamSession,
  clearPersistedExamSession,
} from '../../services/studentSessionStore';

const EXAM_CODE = 'DEMO7';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('studentSessionStore (tab-scoped refresh recovery)', () => {
  it('persists and reads back a session for the same exam code', () => {
    persistExamSession({
      token: 'token-abc',
      examCode: EXAM_CODE,
      exam: { title: 'ریاضی', subject: 'ریاضی' },
      student: { name: 'دانش‌آموز' },
    });
    const restored = readPersistedExamSession(EXAM_CODE);
    expect(restored).toMatchObject({ token: 'token-abc', examCode: EXAM_CODE });
    expect(restored?.student).toEqual({ name: 'دانش‌آموز' });
  });

  it('is scoped per exam code — a token never leaks across exams', () => {
    persistExamSession({ token: 'token-a', examCode: 'EXAM1' });
    expect(readPersistedExamSession('EXAM2')).toBeNull();
    expect(readPersistedExamSession('EXAM1')?.token).toBe('token-a');
  });

  it('clears the persisted session on submit / logout', () => {
    persistExamSession({ token: 'token-abc', examCode: EXAM_CODE });
    clearPersistedExamSession(EXAM_CODE);
    expect(readPersistedExamSession(EXAM_CODE)).toBeNull();
  });

  it('returns null for missing or corrupted entries', () => {
    expect(readPersistedExamSession(EXAM_CODE)).toBeNull();
    window.sessionStorage.setItem('examforge_student_session_v1:' + EXAM_CODE, 'not-json{{{');
    expect(readPersistedExamSession(EXAM_CODE)).toBeNull();
  });

  it('rejects entries whose exam code does not match (case-insensitive)', () => {
    window.sessionStorage.setItem(
      'examforge_student_session_v1:' + EXAM_CODE,
      JSON.stringify({ token: 'token-x', examCode: 'OTHER' }),
    );
    expect(readPersistedExamSession(EXAM_CODE)).toBeNull();
  });

  it('refuses to persist a session without token or exam code', () => {
    persistExamSession({ token: '', examCode: EXAM_CODE });
    persistExamSession({ token: 'token-abc', examCode: '' });
    expect(readPersistedExamSession(EXAM_CODE)).toBeNull();
  });
});
