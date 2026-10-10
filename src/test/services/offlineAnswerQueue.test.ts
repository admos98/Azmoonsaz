import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queueAnswerOffline,
  flushQueuedAnswers,
  getQueuedAnswers,
  clearQueueForToken,
} from '../../services/offlineAnswerQueue';

const STORAGE_KEY = 'azmoonsaz_offline_answers_v2';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('offlineAnswerQueue', () => {
  it('queues and retrieves answers', () => {
    queueAnswerOffline('token-1', 'q-1', 'answer-a');
    const queued = getQueuedAnswers();
    expect(queued.length).toBe(1);
    expect(queued[0].questionId).toBe('q-1');
    expect(queued[0].value).toBe('answer-a');
    expect(queued[0].token).toBe('token-1');
  });

  it('deduplicates by token+questionId', () => {
    queueAnswerOffline('token-1', 'q-1', 'first');
    queueAnswerOffline('token-1', 'q-1', 'second');
    const queued = getQueuedAnswers();
    expect(queued.length).toBe(1);
    expect(queued[0].value).toBe('second');
  });

  it('clears queue for a token', () => {
    queueAnswerOffline('token-a', 'q-1', 'a1');
    queueAnswerOffline('token-b', 'q-2', 'b1');
    clearQueueForToken('token-a');
    const remaining = getQueuedAnswers();
    expect(remaining.length).toBe(1);
    expect(remaining[0].token).toBe('token-b');
  });

  it('returns empty array when no data', () => {
    expect(getQueuedAnswers()).toEqual([]);
  });

  it('drops finally-rejected writes (deadline passed) instead of retrying them', async () => {
    queueAnswerOffline('token-1', 'q-1', 'late-answer');
    const headers = new Map([['content-type', 'application/json']]);
    // save-answer now rejects with 410 past the strict deadline
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        headers: { get: (k: string) => headers.get(k) },
        json: () => Promise.resolve({ error: 'exam_time_expired' }),
        text: () => Promise.resolve('{"error":"exam_time_expired"}'),
      }),
    );
    try {
      const result = await flushQueuedAnswers();
      expect(result.droppedCount).toBe(1);
      expect(result.remainingCount).toBe(0);
      expect(getQueuedAnswers()).toEqual([]);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('keeps network failures queued for the next flush', async () => {
    queueAnswerOffline('token-1', 'q-1', 'offline-answer');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    try {
      const result = await flushQueuedAnswers();
      expect(result.droppedCount).toBe(0);
      expect(result.remainingCount).toBe(1);
      expect(getQueuedAnswers()).toHaveLength(1);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
