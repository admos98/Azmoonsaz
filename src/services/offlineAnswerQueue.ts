/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiPost, ApiError } from '../lib/apiClient';
import { logger } from '../lib/logger';

export type QueuedAnswerValue = string | boolean | string[] | Record<string, unknown>;

/**
 * T4: entries carry NO bearer token. The token lives in the portal's state
 * (memory) and is passed to flush — exactly like the online save path. Rows
 * are keyed by exam code + question id, so a shared-device user recovers
 * answer TEXT at worst, never a still-valid session.
 *
 * Session-scoped storage: in-memory first (dies with reload), sessionStorage
 * backup (dies with the tab). localStorage is never used.
 */
export interface QueuedAnswer {
  examCode: string;
  questionId: string;
  value: QueuedAnswerValue;
  queuedAt: string;
  retryCount: number;
}

const STORAGE_KEY = 'examforge_offline_answers_v1';
const LEGACY_STORAGE_KEY = 'azmoonsaz_offline_answers_v2';

// In-memory primary: survives re-renders, dies with the page.
let memoryQueue: QueuedAnswer[] = [];
let migratedLegacy = false;

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * One-time migration: a v2 localStorage queue (with bearer tokens) left by
 * an older client is dropped, never imported. Answers re-queue naturally on
 * the next failed save with the live in-memory token.
 */
function dropLegacyQueue(): void {
  if (migratedLegacy) return;
  migratedLegacy = true;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    /* best-effort */
  }
}

function persistBackup(queue: QueuedAnswer[]): void {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    logger.warn('Failed to persist offline answers queue:', err);
  }
}

function readBackup(): QueuedAnswer[] {
  const storage = safeSessionStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is QueuedAnswer =>
        q &&
        typeof q === 'object' &&
        typeof q.examCode === 'string' &&
        typeof q.questionId === 'string' &&
        !('token' in q),
    );
  } catch (err) {
    logger.warn('Failed to read offline answers queue:', err);
    return [];
  }
}

function currentQueue(): QueuedAnswer[] {
  dropLegacyQueue();
  if (memoryQueue.length > 0) return [...memoryQueue];
  // Reload with the tab still alive: restore the session backup into memory.
  memoryQueue = readBackup();
  return [...memoryQueue];
}

function replaceQueue(queue: QueuedAnswer[]): void {
  memoryQueue = [...queue];
  persistBackup(memoryQueue);
}

/** Test-only reset: clears memory, backup, and the legacy-migration flag. */
export function __resetQueueForTests(): void {
  memoryQueue = [];
  migratedLegacy = false;
  try {
    window.sessionStorage?.removeItem(STORAGE_KEY);
    window.localStorage?.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}

export function getQueuedAnswers(examCode?: string): QueuedAnswer[] {
  const queue = currentQueue();
  if (!examCode) return queue;
  const code = String(examCode).trim().toUpperCase();
  return queue.filter((q) => q.examCode === code);
}

export function queueAnswerOffline(
  examCode: string,
  questionId: string,
  value: QueuedAnswerValue,
): void {
  const code = String(examCode || '').trim().toUpperCase();
  if (!code || !questionId) return;
  const queue = currentQueue().filter((q) => !(q.examCode === code && q.questionId === questionId));
  queue.push({ examCode: code, questionId, value, queuedAt: new Date().toISOString(), retryCount: 0 });
  replaceQueue(queue);
}

/**
 * Flush with the caller's live bearer token (memory, never stored).
 * Only this exam's entries are attempted; other exams' rows are untouched.
 */
export async function flushQueuedAnswers(
  examCode: string,
  token: string,
): Promise<{
  syncedCount: number;
  remainingCount: number;
  droppedCount: number;
}> {
  const code = String(examCode || '').trim().toUpperCase();
  const mine = currentQueue().filter((q) => q.examCode === code);
  const others = currentQueue().filter((q) => q.examCode !== code);
  if (mine.length === 0 || !token) {
    return { syncedCount: 0, remainingCount: mine.length, droppedCount: 0 };
  }

  const remaining: QueuedAnswer[] = [];
  let syncedCount = 0;
  let droppedCount = 0;

  for (const item of mine) {
    try {
      await apiPost(
        '/api/student/save-answer',
        {
          questionId: item.questionId,
          answer: { value: item.value },
        },
        { Authorization: 'Bearer ' + token },
      );
      syncedCount++;
    } catch (err) {
      // Final server rejections (deadline passed, session closed) are dropped,
      // not retried — replaying them can never succeed. Everything else
      // (network loss, 5xx, rate limits) stays queued for the next flush.
      if (
        err instanceof ApiError &&
        (err.message === 'exam_time_expired' ||
          err.message === 'exam_closed' ||
          err.message === 'session_not_active' ||
          err.message === 'session_not_active_or_already_submitted' ||
          err.message === 'question_not_in_exam')
      ) {
        logger.warn(
          `[Offline Queue] Dropping answer for ${item.questionId}: server rejected it finally (${err.message})`,
        );
        droppedCount++;
        continue;
      }
      logger.warn(
        `[Offline Queue] Failed to sync answer for ${item.questionId}, keeping in queue:`,
        err,
      );
      item.retryCount++;
      remaining.push(item);
    }
  }

  replaceQueue([...others, ...remaining]);
  return { syncedCount, remainingCount: remaining.length, droppedCount };
}

/** Drop this exam's queued rows — call on submit. */
export function clearQueueForExam(examCode: string): void {
  const code = String(examCode || '').trim().toUpperCase();
  replaceQueue(currentQueue().filter((q) => q.examCode !== code));
}
