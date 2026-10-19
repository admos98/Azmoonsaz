/**
 * The answer pipeline for the secure exam: local-first answer state, the
 * text-save debounce, offline queueing on network failure, the manual sync
 * action and the flush-before-submit gate. Owns nothing about auth or the
 * phase machine — composes under useExamSession.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { ApiError, apiPost } from '../../lib/apiClient';
import { logger } from '../../lib/logger';
import { toPersianDigits } from '../../utils/persian';
import {
  flushQueuedAnswers,
  getQueuedAnswers,
  queueAnswerOffline,
} from '../../services/offlineAnswerQueue';
import type { StudentAnswerValue } from '../../components/StudentQuestionCard';

/** Callbacks the flow needs from its host (phase machine / session data). */
export type AnswerFlowHost = {
  examCode: string;
  token: () => string;
  guardTotal: () => number;
  guardFlags: () => Record<string, unknown>;
  timeExpired: boolean;
  setTimeExpired: (v: boolean) => void;
  errorSetter: (message: string) => void;
};

/**
 * Answer storage + persistence flow. `answers` is keyed by question id and
 * holds per-type values: string (choice/text), boolean (true/false),
 * string[] (multiple/ordering/fill-blank), record (matching, cloze parts).
 */
export function useAnswerFlow(host: AnswerFlowHost) {

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Text-save debounce: every gesture updates local state instantly, but the
  // server write may trail by TEXT_SAVE_DEBOUNCE_MS. The split is by VALUE
  // SHAPE, not by question type — `isTextAnswer` below returns true for any
  // bare string OR string[] (every element a string), which covers free text,
  // fill-blank rows, multiple_choice id lists and ordering sequences. Those
  // debounce; only shapes outside that predicate (booleans, and the part-keyed
  // / left-keyed records of cloze, reading and matching) send immediately.
  // Pending values flush through the same send path before final submit so
  // nothing is lost at the gate.
  const pendingTextSaves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingTextValues = useRef(new Map<string, StudentAnswerValue>());
  const TEXT_SAVE_DEBOUNCE_MS = 800;
  const isTextAnswer = (value: StudentAnswerValue): boolean =>
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'));

  // Host callbacks kept in refs so the debounce timers never go stale.
  const hostRef = useRef(host);
  useEffect(() => {
    // Sync after every render (never during render — refs are not render state).
    hostRef.current = host;
  });

  const sendSaveAnswer = async (questionId: string, value: StudentAnswerValue) => {
    setSaving(true);
    hostRef.current.errorSetter('');
    try {
      const flags = hostRef.current.guardFlags();
      const response = await apiPost<{ ok: boolean; savedAt: string }>(
        '/api/student/save-answer',
        {
          questionId,
          answer: { value },
          ...(hostRef.current.guardTotal() > 0 ? { proctor: flags } : {}),
        },
        { Authorization: 'Bearer ' + hostRef.current.token() },
      );
      setSavedAt(response.savedAt);
    } catch (err) {
      // The server ends answer writes exactly at the deadline (grace is
      // submit-only). A 410 here is final — queuing would only replay a
      // rejected write, so surface it and freeze the UI instead.
      if (
        err instanceof ApiError &&
        (err.message === 'exam_time_expired' || err.message === 'exam_closed')
      ) {
        hostRef.current.setTimeExpired(true);
        hostRef.current.errorSetter('زمان آزمون به پایان رسید؛ پاسخ جدیدی ذخیره نمی‌شود.');
        return;
      }
      logger.warn('Network save failed. Queuing answer offline:', err);
      queueAnswerOffline(hostRef.current.examCode, questionId, value);
      setSavedAt('ذخیره به‌صورت آفلاین (در انتظار همگام‌سازی شبکه)');
    } finally {
      setSaving(false);
    }
  };

  // Flush every pending debounced write through the real send path, then
  // submit. Awaits each so the paper the server grades includes them.
  const flushPendingTextSaves = async () => {
    const pending = [...pendingTextValues.current.entries()];
    for (const [, timer] of pendingTextSaves.current) clearTimeout(timer);
    pendingTextSaves.current.clear();
    pendingTextValues.current.clear();
    for (const [questionId, value] of pending) {
      await sendSaveAnswer(questionId, value);
    }
  };

  // Local answers always update instantly; the server write is debounced for
  // free-text streams and immediate for discrete choice gestures.
  const handleSaveAnswer = (questionId: string, value: StudentAnswerValue) => {
    if (hostRef.current.timeExpired) {
      hostRef.current.errorSetter('زمان آزمون به پایان رسید؛ پاسخ جدیدی ذخیره نمی‌شود.');
      return;
    }
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (!isTextAnswer(value)) {
      void sendSaveAnswer(questionId, value);
      return;
    }
    const existing = pendingTextSaves.current.get(questionId);
    if (existing) clearTimeout(existing);
    pendingTextValues.current.set(questionId, value);
    pendingTextSaves.current.set(
      questionId,
      setTimeout(() => {
        pendingTextSaves.current.delete(questionId);
        const latest = pendingTextValues.current.get(questionId);
        pendingTextValues.current.delete(questionId);
        void sendSaveAnswer(questionId, latest ?? value);
      }, TEXT_SAVE_DEBOUNCE_MS),
    );
  };

  // Unmount cleanup: drop pending timers (values stay in local state; the
  // offline queue remains the reload path — timers must not fire post-unmount).
  useEffect(() => {
    const timers = pendingTextSaves.current;
    const values = pendingTextValues.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      values.clear();
    };
  }, []);

  const handleSyncQueued = async () => {
    setSyncing(true);
    hostRef.current.errorSetter('');
    try {
      const result = await flushQueuedAnswers(hostRef.current.examCode, hostRef.current.token());
      if (result.remainingCount === 0) {
        setSavedAt('تمام پاسخ‌های آفلاین با موفقیت به سرور همگام شد.');
      } else {
        hostRef.current.errorSetter(
          `ارتباط با سرور برقرار نشد. ${toPersianDigits(result.remainingCount)} پاسخ همچنان در صف باقی ماند.`,
        );
      }
    } catch {
      hostRef.current.errorSetter('خطا در همگام‌سازی پاسخ‌های آفلاین.');
    } finally {
      setSyncing(false);
    }
  };

  const hasQueuedAnswers = () => getQueuedAnswers(hostRef.current.examCode).length > 0;

  return {
    answers,
    setAnswers,
    saving,
    savedAt,
    setSavedAt,
    syncing,
    handleSaveAnswer,
    handleSyncQueued,
    flushPendingTextSaves,
    hasQueuedAnswers,
  };
}

export type AnswerFlow = ReturnType<typeof useAnswerFlow>;
