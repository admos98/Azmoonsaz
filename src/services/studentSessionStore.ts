/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Student exam session persistence — tab-scoped rejoin after refresh.
 *
 * `sessionStorage` (never `localStorage`): the bearer token dies with the
 * tab, so a shared-device user cannot recover a still-valid session from
 * disk later. The payload is the minimum needed to re-fetch the paper —
 * token + exam code. Identity (national ID) is never persisted; a token
 * that fails verification drops the student back to login, where they
 * re-authenticate.
 */

export interface PersistedExamSession {
  /** Student session bearer token (JWT, server-expiring). */
  token: string;
  /** Exam code from the URL — scopes the stored token to one exam. */
  examCode: string;
  /** Display snapshot so the ready screen can render before re-fetch. */
  exam?: { title: string; subject: string } | null;
  student?: { name: string } | null;
}

const STORAGE_PREFIX = 'examforge_student_session_v1:';

function keyFor(examCode: string): string {
  return STORAGE_PREFIX + String(examCode || '').trim().toUpperCase();
}

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Persist the active session after login / rejoin. Overwrites any prior. */
export function persistExamSession(session: PersistedExamSession): void {
  const storage = safeSessionStorage();
  if (!storage || !session?.token || !session?.examCode) return;
  try {
    storage.setItem(
      keyFor(session.examCode),
      JSON.stringify({
        token: session.token,
        examCode: session.examCode,
        exam: session.exam ?? null,
        student: session.student ?? null,
      } satisfies PersistedExamSession),
    );
  } catch {
    // Storage full or blocked (private mode) — the exam still works, only
    // refresh recovery is lost. Never throw into the login flow.
  }
}

/** Read a previously persisted session for this exam code, if any. */
export function readPersistedExamSession(examCode: string): PersistedExamSession | null {
  const storage = safeSessionStorage();
  if (!storage || !examCode) return null;
  try {
    const raw = storage.getItem(keyFor(examCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedExamSession>;
    if (
      typeof parsed?.token !== 'string' ||
      parsed.token.length === 0 ||
      typeof parsed?.examCode !== 'string' ||
      parsed.examCode.trim().toUpperCase() !== String(examCode).trim().toUpperCase()
    ) {
      return null;
    }
    return {
      token: parsed.token,
      examCode: parsed.examCode,
      exam: parsed.exam ?? null,
      student: parsed.student ?? null,
    };
  } catch {
    return null;
  }
}

/** Drop the persisted session — call on submit, expiry, logout, invalid token. */
export function clearPersistedExamSession(examCode: string): void {
  const storage = safeSessionStorage();
  if (!storage || !examCode) return;
  try {
    storage.removeItem(keyFor(examCode));
  } catch {
    // Best-effort cleanup — never throw into the submit flow.
  }
}
