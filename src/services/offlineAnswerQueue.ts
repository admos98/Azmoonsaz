/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiPost, ApiError } from '../lib/apiClient';
import { logger } from '../lib/logger';

export type QueuedAnswerValue = string | boolean | string[] | Record<string, unknown>;

export interface QueuedAnswer {
  token: string;
  questionId: string;
  value: QueuedAnswerValue;
  queuedAt: string;
  retryCount: number;
}

const STORAGE_KEY = 'azmoonsaz_offline_answers_v2';

export function getQueuedAnswers(): QueuedAnswer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    logger.warn('Failed to read offline answers queue:', err);
    return [];
  }
}

function saveQueue(queue: QueuedAnswer[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    logger.warn('Failed to persist offline answers queue:', err);
  }
}

export function queueAnswerOffline(token: string, questionId: string, value: QueuedAnswerValue): void {
  const queue = getQueuedAnswers();
  const filtered = queue.filter((q) => !(q.token === token && q.questionId === questionId));
  filtered.push({ token, questionId, value, queuedAt: new Date().toISOString(), retryCount: 0 });
  saveQueue(filtered);
}

export async function flushQueuedAnswers(): Promise<{
  syncedCount: number;
  remainingCount: number;
  droppedCount: number;
}> {
  const queue = getQueuedAnswers();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0, droppedCount: 0 };

  const remaining: QueuedAnswer[] = [];
  let syncedCount = 0;
  let droppedCount = 0;

  for (const item of queue) {
    try {
      await apiPost(
        '/api/student/save-answer',
        {
          questionId: item.questionId,
          answer: { value: item.value },
        },
        { Authorization: 'Bearer ' + item.token },
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

  saveQueue(remaining);
  return { syncedCount, remainingCount: remaining.length, droppedCount };
}

export function clearQueueForToken(token: string): void {
  const queue = getQueuedAnswers().filter((q) => q.token !== token);
  saveQueue(queue);
}
