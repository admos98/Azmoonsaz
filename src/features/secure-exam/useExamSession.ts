/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiPost } from '../../lib/apiClient';
import { clearQueueForExam, getQueuedAnswers } from '../../services/offlineAnswerQueue';
import {
  clearPersistedExamSession,
  persistExamSession,
  readPersistedExamSession,
} from '../../services/studentSessionStore';
import { useExamGuard } from '../exam-guard/useExamGuard';
import { useAnswerFlow } from './useAnswerFlow';
import { toEnglishDigits } from '../../utils/persian';
import {
  TURNSTILE_SITE_KEY,
  friendlyApiError,
  type Phase,
  type PayloadResponse,
  type SafeExam,
  type SafeQuestion,
  type SafeStudent,
  type StartResponse,
} from './protocol';

export type ConfirmStage = 'sync-queued' | 'final-submit' | null;

/**
 * The secure-exam state machine: every piece of server, persistence and
 * answer-flow logic lives here. Screens receive state and callbacks —
 * they never touch the network.
 */
export function useExamSession(presetExamCode: string) {
  // Refresh snapshot, read synchronously at mount (lazy initializers, not an
  // effect): a reload in the same tab re-fetches the paper without re-login.
  // The token is tab-scoped (sessionStorage); the national ID is never stored.
  const [restoredSession] = useState(() => readPersistedExamSession(presetExamCode || ''));
  const [phase, setPhase] = useState<Phase>('login');
  const [examCode, setExamCode] = useState(presetExamCode || 'DEMO7');
  const [nationalId, setNationalId] = useState('');
  // T7: 6-digit exam PIN — memory only, never persisted (same as the token).
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [token, setToken] = useState(restoredSession?.token ?? '');
  const [exam, setExam] = useState<SafeExam | null>(() =>
    restoredSession?.exam
      ? {
          id: '',
          examCode: restoredSession.examCode,
          title: restoredSession.exam.title,
          grade: '',
          subject: restoredSession.exam.subject,
          status: '',
          mode: '',
          durationMinutes: 0,
        }
      : null,
  );
  const [student, setStudent] = useState<SafeStudent | null>(() =>
    restoredSession?.student ? { id: '', ...restoredSession.student, grade: '' } : null,
  );
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [loading, setLoading] = useState(restoredSession !== null);
  const [error, setError] = useState('');
  const [confirmStage, setConfirmStage] = useState<ConfirmStage>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  // Wave A: copy/print/tab-switch deterrence, active only while questions
  // are on screen (take phase).
  const guard = useExamGuard(phase === 'take');

  // The answer pipeline (save/debounce/offline/sync) is a peer module; it
  // writes back through this session's error setter so the student sees one
  // coherent error surface.
  const flow = useAnswerFlow({
    examCode,
    token: () => token,
    guardFlags: () => guard.flags,
    timeExpired,
    setTimeExpired,
    errorSetter: setError,
    guardTotal: () => guard.total,
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || phase !== 'login') return;
    const container = turnstileRef.current;
    if (!container) return;
    const renderWidget = () => {
      window.turnstile?.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (value: string) => setTurnstileToken(value),
        'expired-callback': () => setTurnstileToken(''),
      });
    };
    if (document.getElementById('cf-turnstile-script')) {
      renderWidget();
      return;
    }
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [phase]);

  useEffect(() => {
    if (!token) return;
    const updateQueueCount = () => {
      setQueuedCount(getQueuedAnswers(examCode).length);
    };
    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);
    return () => clearInterval(interval);
  }, [token, examCode]);

  // Persian/Arabic digits → ASCII; strip the rest.
  // CQ-4 fix: delegate to the shared toEnglishDigits instead of re-implementing
  // the same two range replaces a third time in the codebase.
  const normalizePinInput = (value: string) =>
    toEnglishDigits(value)
      .replace(/\D/g, '')
      .slice(0, 6);

  const normalizeNationalId = (value: string) =>
    value.replace(/\D/g, '').slice(0, 10);

  const handleStartSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiPost<StartResponse>('/api/student/start-session', {
        examCode,
        nationalId,
        pin,
        ...(TURNSTILE_SITE_KEY ? { turnstileToken } : {}),
      });
      if (response.pinSetupRequired) {
        // First-ever login (or teacher reset): greet, then ask for a new PIN.
        setStudent(response.student);
        setPin('');
        setPinConfirm('');
        setPhase('pin-setup');
        return;
      }
      if (!response.token || !response.exam) {
        setError(friendlyApiError(new ApiError('invalid_credentials', 403, {})));
        return;
      }
      setToken(response.token);
      setExam(response.exam);
      setStudent(response.student);
      // Persist for refresh recovery: same tab can re-fetch the paper without
      // re-typing the national ID (which is never stored client-side).
      persistExamSession({
        token: response.token,
        examCode,
        exam: { title: response.exam.title, subject: response.exam.subject },
        student: { name: response.student.name },
      });
      setPhase('ready');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (pin.length !== 6 || pin !== pinConfirm) {
      setError('رمز ۶ رقمی باید دقیقاً ۶ رقم باشد و تکرار آن یکسان باشد.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiPost<StartResponse>('/api/student/start-session', {
        examCode,
        nationalId,
        pin,
        pinConfirm,
        ...(TURNSTILE_SITE_KEY ? { turnstileToken } : {}),
      });
      if (response.pinSetupRequired) {
        setError('رمز پذیرفته نشد. هر دو فیلد باید دقیقاً یک رمز ۶ رقمی یکسان باشند.');
        return;
      }
      if (!response.token || !response.exam) {
        setError(friendlyApiError(new ApiError('invalid_credentials', 403, {})));
        return;
      }
      setToken(response.token);
      setExam(response.exam);
      setStudent(response.student);
      setPin('');
      setPinConfirm('');
      persistExamSession({
        token: response.token,
        examCode,
        exam: { title: response.exam.title, subject: response.exam.subject },
        student: { name: response.student.name },
      });
      setPhase('ready');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadPaperWithToken = useCallback(async (activeToken: string) => {
    const response = await apiPost<PayloadResponse>(
      '/api/student/exam-payload',
      {},
      { Authorization: 'Bearer ' + activeToken },
    );
    setExam(response.exam);
    // The student object is not persisted (national ID is never stored), so
    // prefer the server echo when present and fall back to the snapshot.
    if (response.student) setStudent(response.student);
    setQuestions(response.questions || []);
    // Restore previously saved answers (value-only map from the server).
    // Values keep their per-type shape (string/array/record) — the typed
    // renderer restores each input from its own shape.
    const saved = response.savedAnswers;
    if (saved && typeof saved === 'object') {
      const restored: Record<string, unknown> = {};
      for (const [questionId, value] of Object.entries(saved)) {
        if (value === undefined) continue;
        restored[questionId] = value;
      }
      flow.setAnswers(restored);
    } else {
      flow.setAnswers({});
    }
    setSessionStartedAt(response.session?.startedAt || null);
    setTimeExpired(false);
    setPhase('take');
  }, [flow]);

  const handleLoadPayload = async () => {
    setError('');
    setLoading(true);
    // Best-effort fullscreen, still inside the click gesture. Unsupported or
    // denied browsers simply continue — exits are counted as a proctor flag.
    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      /* not supported — exam proceeds windowed */
    }
    try {
      await loadPaperWithToken(token);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Refresh recovery: the effect performs only the async re-fetch — all state
  // snapshots come from the lazy initializers, so there is no
  // set-state-in-effect. An invalid/expired token clears storage and falls
  // back to login (re-authenticate with the national ID, never persisted).
  // StrictMode-safe: the ref guards the dev double-effect from firing twice.
  const rejoinAttemptedRef = useRef(false);
  useEffect(() => {
    if (rejoinAttemptedRef.current) return;
    rejoinAttemptedRef.current = true;
    if (!restoredSession) return;
    const persisted = restoredSession;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time rejoin fetch after refresh; syncs with an external system (the API), not derived state
    loadPaperWithToken(persisted.token).catch((err: unknown) => {
      // Session gone (submitted/expired/invalidated) — clear the dead token
      // and land on login. Anything else keeps the ready screen snapshot so
      // the student can retry without re-typing credentials blindly.
      if (
        err instanceof ApiError &&
        (err.message === 'invalid_session' ||
          err.message === 'session_not_active' ||
          err.message === 'session_not_active_or_already_submitted' ||
          err.message === 'exam_time_expired' ||
          err.message === 'exam_closed')
      ) {
        clearPersistedExamSession(persisted.examCode);
        setToken('');
        setPhase('login');
        setError(friendlyApiError(err));
      } else {
        setPhase('ready');
        setError(friendlyApiError(err));
      }
    }).finally(() => setLoading(false));
  }, [restoredSession, loadPaperWithToken]);

  // Irreversible actions go through the designed ConfirmDialog, never browser chrome
  // (audit §5.4 / §7.2-1: the student submit is the highest-stakes surface).
  const handleSubmit = () => {
    setConfirmStage(queuedCount > 0 ? 'sync-queued' : 'final-submit');
  };

  const dismissConfirm = () => setConfirmStage(null);

  const handleConfirmSync = async () => {
    setConfirmStage(null);
    await flow.handleSyncQueued();
    if (flow.hasQueuedAnswers()) {
      setError('خطا: ابتدا از اتصال اینترنت خود اطمینان حاصل کنید تا پاسخ‌های آفلاین همگام شوند.');
      return;
    }
    setConfirmStage('final-submit');
  };

  const runFinalSubmit = async () => {
    setConfirmStage(null);
    setError('');
    setLoading(true);
    try {
      // Debounced keystrokes land first — otherwise the graded paper could
      // miss the student's last 800ms of typing.
      await flow.flushPendingTextSaves();
      await apiPost(
        '/api/student/submit',
        guard.total > 0 ? { proctor: guard.flags } : {},
        { Authorization: 'Bearer ' + token },
      );
      clearQueueForExam(examCode);
      clearPersistedExamSession(examCode);
      setPhase('submitted');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const answeredCount = useMemo(() => Object.keys(flow.answers).length, [flow.answers]);

  return {
    // identity / data
    phase,
    exam,
    examCode,
    setExamCode,
    student,
    questions,
    answers: flow.answers,
    loading,
    saving: flow.saving,
    error,
    answeredCount,
    // hooks/surface
    guard,
    sessionStartedAt,
    timeExpired,
    turnstileToken,
    turnstileRef,
    savedAt: flow.savedAt,
    syncing: flow.syncing,
    queuedCount,
    confirmStage,
    // auth form state
    nationalId,
    setNationalId,
    pin,
    setPin,
    pinConfirm,
    setPinConfirm,
    // actions
    handleSyncQueued: flow.handleSyncQueued,
    setTimeExpired,
    normalizePinInput,
    normalizeNationalId,
    handleStartSession,
    handleSetPin,
    handleLoadPayload,
    handleSaveAnswer: flow.handleSaveAnswer,
    handleSubmit,
    handleConfirmSync,
    dismissConfirm,
    runFinalSubmit,
  };
}

export type ExamSession = ReturnType<typeof useExamSession>;
