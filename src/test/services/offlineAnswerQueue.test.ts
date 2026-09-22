import { describe, it, expect, beforeEach } from 'vitest';
import {
  queueAnswerOffline,
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
});
