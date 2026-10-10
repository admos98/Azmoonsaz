import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queueAnswerOffline,
  flushQueuedAnswers,
  getQueuedAnswers,
  clearQueueForExam,
  __resetQueueForTests,
} from '../../services/offlineAnswerQueue';

const EXAM = 'DEMO7';
const TOKEN = 'live-bearer-token';

beforeEach(() => {
  __resetQueueForTests();
});

describe('offlineAnswerQueue (T4: no bearer tokens at rest)', () => {
  it('queues and retrieves answers keyed by exam code', () => {
    queueAnswerOffline(EXAM, 'q-1', 'answer-a');
    const queued = getQueuedAnswers(EXAM);
    expect(queued.length).toBe(1);
    expect(queued[0].questionId).toBe('q-1');
    expect(queued[0].value).toBe('answer-a');
    expect(queued[0].examCode).toBe(EXAM);
    expect(queued[0]).not.toHaveProperty('token');
  });

  it('deduplicates by exam+questionId', () => {
    queueAnswerOffline(EXAM, 'q-1', 'first');
    queueAnswerOffline(EXAM, 'q-1', 'second');
    const queued = getQueuedAnswers(EXAM);
    expect(queued.length).toBe(1);
    expect(queued[0].value).toBe('second');
  });

  it('scopes reads and clears per exam', () => {
    queueAnswerOffline('EXAM-A', 'q-1', 'a1');
    queueAnswerOffline('EXAM-B', 'q-2', 'b1');
    expect(getQueuedAnswers('EXAM-A')).toHaveLength(1);
    clearQueueForExam('EXAM-A');
    expect(getQueuedAnswers('EXAM-A')).toHaveLength(0);
    expect(getQueuedAnswers('EXAM-B')).toHaveLength(1);
  });

  it('drops the legacy localStorage queue without importing tokens', () => {
    window.localStorage.setItem(
      'azmoonsaz_offline_answers_v2',
      JSON.stringify([{ token: 'stale-token', questionId: 'q-9', value: 'x', queuedAt: '', retryCount: 0 }]),
    );
    expect(getQueuedAnswers()).toEqual([]);
    expect(window.localStorage.getItem('azmoonsaz_offline_answers_v2')).toBeNull();
    // sessionStorage backup holds no token either.
    queueAnswerOffline(EXAM, 'q-1', 'a');
    const raw = window.sessionStorage.getItem('examforge_offline_answers_v1') || '';
    expect(raw).not.toContain('token');
  });

  it('returns empty array when no data', () => {
    expect(getQueuedAnswers()).toEqual([]);
  });

  it('drops finally-rejected writes (deadline passed) instead of retrying them', async () => {
    queueAnswerOffline(EXAM, 'q-1', 'late-answer');
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
      const result = await flushQueuedAnswers(EXAM, TOKEN);
      expect(result.droppedCount).toBe(1);
      expect(result.remainingCount).toBe(0);
      expect(getQueuedAnswers(EXAM)).toEqual([]);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('keeps network failures queued for the next flush', async () => {
    queueAnswerOffline(EXAM, 'q-1', 'offline-answer');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    try {
      const result = await flushQueuedAnswers(EXAM, TOKEN);
      expect(result.droppedCount).toBe(0);
      expect(result.remainingCount).toBe(1);
      expect(getQueuedAnswers(EXAM)).toHaveLength(1);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('sends the live token as the bearer header', async () => {
    queueAnswerOffline(EXAM, 'q-1', 'answer-a');
    const seen: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        seen.push({ url, init: init as RequestInit });
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ ok: true, savedAt: new Date().toISOString() }),
          text: () => Promise.resolve('{}'),
        });
      }),
    );
    try {
      await flushQueuedAnswers(EXAM, TOKEN);
      expect(seen).toHaveLength(1);
      expect((seen[0].init.headers as Record<string, string>).Authorization).toBe('Bearer ' + TOKEN);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
