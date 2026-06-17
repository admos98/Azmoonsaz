/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiPost } from '../lib/apiClient';

export interface QueuedAnswer {
  token: string;
  questionId: string;
  value: string;
  queuedAt: string;
  retryCount: number;
}

const STORAGE_KEY = 'azmoonsaz_offline_answers_v2';

export function getQueuedAnswers(): QueuedAnswer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to read offline answers queue:', err);
    return [];
  }
}

function saveQueue(queue: QueuedAnswer[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Failed to persist offline answers queue:', err);
  }
}

export function queueAnswerOffline(token: string, questionId: string, value: string): void {
  const queue = getQueuedAnswers();
  const filtered = queue.filter(q => !(q.token === token && q.questionId === questionId));
  filtered.push({ token, questionId, value, queuedAt: new Date().toISOString(), retryCount: 0 });
  saveQueue(filtered);
  console.log(`[Offline Queue] Queued answer for question ${questionId}. Total queued: ${filtered.length}`);
}

export async function flushQueuedAnswers(): Promise<{ syncedCount: number; remainingCount: number }> {
  const queue = getQueuedAnswers();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  console.log(`[Offline Queue] Attempting to sync ${queue.length} offline answers...`);
  const remaining: QueuedAnswer[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      await apiPost('/api/student/save-answer', {
        token: item.token,
        questionId: item.questionId,
        answer: { value: item.value },
      });
      syncedCount++;
    } catch (err) {
      console.warn(`[Offline Queue] Failed to sync answer for ${item.questionId}, keeping in queue:`, err);
      item.retryCount++;
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { syncedCount, remainingCount: remaining.length };
}

export function clearQueueForToken(token: string): void {
  const queue = getQueuedAnswers().filter(q => q.token !== token);
  saveQueue(queue);
}