import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { apiPost, ApiError } from '../../lib/apiClient';
import { logger } from '../../lib/logger';
import { toPersianDigits } from '../../utils/persian';
import {
  queueAnswerOffline,
  flushQueuedAnswers,
  clearQueueForExam,
  getQueuedAnswers,
} from '../../services/offlineAnswerQueue';
import {
  persistExamSession,
  readPersistedExamSession,
  clearPersistedExamSession,
} from '../../services/studentSessionStore';
import { ConfirmDialog, PillButton, TextLink, Button, Input } from '../../ui';
import { ExamCountdown } from '../../components/ExamCountdown';
import StudentQuestionCard, { type StudentAnswerValue } from '../../components/StudentQuestionCard';
import { useExamGuard } from '../../features/exam-guard/useExamGuard';
import { Watermark } from '../../features/exam-guard/Watermark';

type Phase = 'login' | 'pin-setup' | 'ready' | 'take' | 'submitted';

// Wave B: Turnstile join check — renders only when the site key is deployed;
// the server enforces only when its secret is deployed (both or neither).
const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => void;
    };
  }
}

type SafeExam = {
  id: string;
  examCode: string;
  title: string;
  grade: string;
  subject: string;
  status: string;
  mode: string;
  startsAt?: string;
  endsAt?: string;
  durationMinutes: number;
};
type SafeStudent = { id: string; name: string; grade: string };
type SafeQuestion = {
  id: string;
  type: string;
  title: string;
  body: {
    text?: string;
    imageUrl?: string;
    options?: { id: string; text: string; imageUrl?: string }[];
    parts?: {
      id: string;
      text: string;
      type: string;
      imageUrl?: string;
      options?: { id: string; text: string; imageUrl?: string }[];
    }[];
    displayPairs?: { left: string; right: string }[];
    displayItems?: string[];
    /** Non-secret fill-blank field count (correctFillBlanks stays server-side). */
    blankCount?: number;
  };
  points: number;
  sectionTitle?: string;
  position?: number;
};
type StartResponse = {
  ok: boolean;
  token?: string;
  pinSetupRequired?: boolean;
  session?: { id: string; status: string; started_at: string; submitted_at?: string | null };
  exam?: SafeExam;
  student: SafeStudent;
};
type PayloadResponse = {
  ok: boolean;
  exam: SafeExam;
  session: { id: string; startedAt: string };
  student?: SafeStudent | null;
  questions: SafeQuestion[];
  savedAnswers?: Record<string, unknown>;
};

interface SecureExamPortalProps {
  presetExamCode: string;
  onBackToTeacher: () => void;
}

function friendlyApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.message;
    const map: Record<string, string> = {
      invalid_credentials: 'اطلاعات وارد شده معتبر نیست یا شما اجازه شرکت در این آزمون را ندارید.',
      invalid_exam_code: 'کد آزمون معتبر نیست.',
      exam_not_found: 'آزمونی با این کد پیدا نشد.',
      exam_not_open: 'این آزمون هنوز شروع نشده است.',
      exam_closed: 'زمان شرکت در این آزمون به پایان رسیده است.',
      exam_already_finalized: 'پاسخ شما قبلاً برای این آزمون ثبت نهایی شده است.',
      exam_time_expired: 'زمان آزمون شما به پایان رسیده است. پاسخ‌نامه را ثبت کنید.',
      not_allowed_for_exam: 'شما اجازه شرکت در این آزمون را ندارید.',
      too_many_requests: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
      session_not_active: 'نشست آزمون فعال نیست یا قبلاً ارسال شده است.',
      invalid_session: 'نشست آزمون نامعتبر است. دوباره وارد آزمون شوید.',
      exam_invalidated: 'شرکت شما در این آزمون مسدود شده است. برای پیگیری با دبیر تماس بگیرید.',
      turnstile_invalid: 'احراز هویت امنیتی تکمیل نشد. لطفاً دوباره تلاش کنید.',
    };
    return map[code] || 'خطایی در ارتباط با سرور رخ داد.';
  }
  return 'خطایی غیرمنتظره رخ داد.';
}

export default function SecureExamPortal({
  presetExamCode,
  onBackToTeacher,
}: SecureExamPortalProps) {
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
  // Answers are per-type values: string (choice/text), boolean (true/false),
  // string[] (multiple/ordering/fill-blank), record (matching, cloze parts).
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(restoredSession !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmStage, setConfirmStage] = useState<'sync-queued' | 'final-submit' | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  // Wave A: copy/print/tab-switch deterrence, active only while questions
  // are on screen (take phase).
  const guard = useExamGuard(phase === 'take');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);

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
      const q = getQueuedAnswers(examCode);
      setQueuedCount(q.length);
    };
    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);
    return () => clearInterval(interval);
  }, [token, examCode]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  // Persian/Arabic digits → ASCII; strip the rest.
  const normalizePinInput = (value: string) =>
    value
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) // persian-ok — Arabic-Indic digit map table, not copy
      .replace(/\D/g, '')
      .slice(0, 6);

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

  const loadPaperWithToken = async (activeToken: string) => {
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
      setAnswers(restored);
    } else {
      setAnswers({});
    }
    setSessionStartedAt(response.session?.startedAt || null);
    setTimeExpired(false);
    setPhase('take');
  };

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
  // snapshots come from the lazy initializers above, so there is no
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
  }, [restoredSession]);

  // Text-save debounce: every keystroke updates local state instantly, but
  // the server write trails by TEXT_SAVE_DEBOUNCE_MS. Choice taps (single /
  // multiple / true-false / matching / ordering) save immediately — they are
  // discrete gestures, never keystroke streams. Pending values flush through
  // the same send path before final submit so nothing is lost at the gate.
  const pendingTextSaves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingTextValues = useRef(new Map<string, StudentAnswerValue>());
  const TEXT_SAVE_DEBOUNCE_MS = 800;
  const isTextAnswer = (value: StudentAnswerValue): boolean =>
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'));

  const sendSaveAnswer = async (questionId: string, value: StudentAnswerValue) => {
    setSaving(true);
    setError('');
    try {
      const response = await apiPost<{ ok: boolean; savedAt: string }>(
        '/api/student/save-answer',
        {
          questionId,
          answer: { value },
          ...(guard.total > 0 ? { proctor: guard.flags } : {}),
        },
        { Authorization: 'Bearer ' + token },
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
        setTimeExpired(true);
        setError('زمان آزمون به پایان رسید؛ پاسخ جدیدی ذخیره نمی‌شود.');
        return;
      }
      logger.warn('Network save failed. Queuing answer offline:', err);
      queueAnswerOffline(examCode, questionId, value);
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
    if (timeExpired) {
      setError('زمان آزمون به پایان رسید؛ پاسخ جدیدی ذخیره نمی‌شود.');
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
    setError('');
    try {
      const result = await flushQueuedAnswers(examCode, token);
      if (result.remainingCount === 0) {
        setSavedAt('تمام پاسخ‌های آفلاین با موفقیت به سرور همگام شد.');
      } else {
        setError(
          `ارتباط با سرور برقرار نشد. ${toPersianDigits(result.remainingCount)} پاسخ همچنان در صف باقی ماند.`,
        );
      }
    } catch (_err) {
      setError('خطا در همگام‌سازی پاسخ‌های آفلاین.');
    } finally {
      setSyncing(false);
    }
  };

  // Irreversible actions go through the designed ConfirmDialog, never browser chrome
  // (audit §5.4 / §7.2-1: the student submit is the highest-stakes surface).
  const handleSubmit = () => {
    setConfirmStage(queuedCount > 0 ? 'sync-queued' : 'final-submit');
  };

  const handleConfirmSync = async () => {
    setConfirmStage(null);
    await handleSyncQueued();
    if (getQueuedAnswers(examCode).length > 0) {
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
      await flushPendingTextSaves();
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

  return (
    <div
      dir="rtl"
      className="min-h-dvh bg-[var(--color-on-dark-subtle)] text-[var(--color-text-primary)] flex flex-col"
    >
      <header className="lens border-b border-[var(--color-glass-light-stroke)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-label font-black text-[var(--color-text-primary)]">
                درگاه امن آزمون (آلفا نسخه ۲)
              </h1>
              <p className="text-micro text-[var(--color-text-secondary)]">
                مجهز به ذخیره‌ساز هوشمند آفلاین در قطعی اینترنت
              </p>
            </div>
          </div>
          <TextLink size="md" bold onClick={onBackToTeacher}>
            بازگشت به پنل معلم
          </TextLink>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {error && (
          <div className="mb-5 bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/20 text-[var(--color-danger)]/80 rounded-2xl p-4 text-caption font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {phase === 'login' && (
          <form
            onSubmit={handleStartSession}
            className="lens rounded-3xl p-6 md:p-8 max-w-xl mx-auto space-y-5"
          >
            <div className="text-center space-y-2">
              <Lock className="w-12 h-12 mx-auto text-[var(--color-accent)]" />
              <h2 className="font-black text-[var(--color-text-primary)]">ورود امن دانش‌آموز</h2>
              <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">
                کد ملی در مرورگر ذخیره نمی‌شود؛ اعتبارسنجی و تطبیق آن فقط در بک‌اند انجام می‌شود.
              </p>
            </div>
            <Input
              label="کد آزمون"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value.toUpperCase())}
              className="font-bold text-left ltr"
            />
            <Input
              label="کد ملی دانش‌آموز"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="مثلاً 1000000001"
              className="font-bold text-left tracking-widest"
              inputMode="numeric"
            />
            <Input
              label="رمز ۶ رقمی"
              value={pin}
              onChange={(e) => setPin(normalizePinInput(e.target.value))}
              placeholder="۶ رقم"
              inputMode="numeric"
              autoComplete="off"
              className="font-bold text-left tracking-widest"
            />
            {TURNSTILE_SITE_KEY && (
              <div ref={turnstileRef} className="flex justify-center" />
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={
                loading ||
                nationalId.length !== 10 ||
                pin.length !== 6 ||
                Boolean(TURNSTILE_SITE_KEY && !turnstileToken)
              }
              icon={
                loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )
              }
              className="w-full py-3 text-label font-black"
            >
              ورود امن به آزمون
            </Button>
          </form>
        )}

        {phase === 'pin-setup' && student && (
          <form
            onSubmit={handleSetPin}
            className="lens rounded-3xl p-6 md:p-8 max-w-xl mx-auto space-y-5"
          >
            <div className="text-center space-y-2">
              <Lock className="w-12 h-12 mx-auto text-[var(--color-accent)]" />
              <h2 className="font-black text-[var(--color-text-primary)]">سلام، {student.name}</h2>
              <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">
                برای نخستین ورود، یک رمز ۶ رقمی برای خودت انتخاب کن. از این پس با همین رمز وارد
                آزمون‌ها می‌شوی؛ آن را به خاطر بسپار و به کسی نده.
              </p>
            </div>
            <Input
              label="رمز ۶ رقمی جدید"
              value={pin}
              onChange={(e) => setPin(normalizePinInput(e.target.value))}
              placeholder="۶ رقم"
              inputMode="numeric"
              autoComplete="new-password"
              className="font-bold text-left tracking-widest"
            />
            <Input
              label="تکرار رمز ۶ رقمی"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(normalizePinInput(e.target.value))}
              placeholder="تکرار ۶ رقم"
              inputMode="numeric"
              autoComplete="new-password"
              className="font-bold text-left tracking-widest"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading || pin.length !== 6 || pinConfirm.length !== 6}
              icon={
                loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )
              }
              className="w-full py-3 text-label font-black"
            >
              ثبت رمز و ورود به آزمون
            </Button>
          </form>
        )}

        {phase === 'ready' && exam && student && (
          <div className="lens rounded-3xl p-6 md:p-8 max-w-2xl mx-auto space-y-5 text-center">
            <CheckCircle2 className="w-14 h-14 text-[var(--color-success)] mx-auto" />
            <h2 className="font-black text-[var(--color-text-primary)]">سلام، {student.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-caption">
              <div className="bg-[var(--color-on-dark-subtle)] rounded-2xl p-3">
                <span className="block text-[var(--color-text-tertiary)]">آزمون</span>
                <strong>{exam.title}</strong>
              </div>
              <div className="bg-[var(--color-on-dark-subtle)] rounded-2xl p-3">
                <span className="block text-[var(--color-text-tertiary)]">درس</span>
                <strong>{exam.subject}</strong>
              </div>
              <div className="bg-[var(--color-on-dark-subtle)] rounded-2xl p-3">
                <span className="block text-[var(--color-text-tertiary)]">زمان</span>
                <strong>{toPersianDigits(exam.durationMinutes)} دقیقه</strong>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleLoadPayload}
              disabled={loading}
              icon={
                loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4" />
                )
              }
              className="px-6 py-3 text-label font-black"
            >
              دریافت سوالات و شروع آزمون
            </Button>
          </div>
        )}

        {phase === 'take' && exam && student && (
          <Watermark
            label={`${student.name} — کد آزمون ${exam.examCode} — ${exam.title}`}
          />
        )}

        {phase === 'take' && exam && (
          <div className="space-y-5">
            {guard.total > 0 && (
              <div
                role="status"
                className="lens rounded-2xl p-3 border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 text-[var(--color-warning)] text-caption font-black flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  رویداد غیرعادی ثبت شد (کپی، خروج از صفحه یا چاپ):{' '}
                  {toPersianDigits(guard.total)} مورد — این رویدادها به دبیر
                  گزارش می‌شود.
                </span>
              </div>
            )}
            <div className="pane rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-10">
              <div>
                <h2 className="font-black text-[var(--color-text-primary)]">{exam.title}</h2>
                <p
                  className="text-caption text-[var(--color-text-tertiary)] mt-1"
                  aria-live="polite"
                >
                  پاسخ‌داده‌شده: {toPersianDigits(answeredCount)} از{' '}
                  {toPersianDigits(questions.length)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-caption">
                {sessionStartedAt && (exam.durationMinutes ?? 0) > 0 && (
                  <ExamCountdown
                    durationMinutes={exam.durationMinutes}
                    startedAt={sessionStartedAt}
                    onExpire={() => setTimeExpired(true)}
                  />
                )}
                {queuedCount > 0 ? (
                  <div className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 text-[var(--color-warning)]/80 rounded-xl px-3 py-2 flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-[var(--color-warning)] animate-pulse" />
                    <span className="font-bold">
                      {toPersianDigits(queuedCount)} پاسخ همگام‌نشده (آفلاین)
                    </span>
                    <PillButton
                      fill="warning-solid"
                      size="xs"
                      radius="lg"
                      weight="black"
                      textColor="warning"
                      onClick={handleSyncQueued}
                      disabled={syncing}
                      className="hover:bg-[var(--color-warning-solid)] inline-flex items-center gap-1 transition-colors"
                    >
                      {syncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      همگام‌سازی الآن
                    </PillButton>
                  </div>
                ) : (
                  <div
                    className="text-[var(--color-text-tertiary)] flex items-center gap-1.5"
                    title="اتصال زنده برقرار است"
                  >
                    <Wifi className="w-4 h-4 text-[var(--color-success)]" />
                    <span className="text-micro">ارتباط آنلاین</span>
                  </div>
                )}
                {saving && (
                  <span className="text-[var(--color-warning)] font-bold">در حال ذخیره...</span>
                )}
                {savedAt && !saving && (
                  <span className="text-[var(--color-success)] font-bold max-w-xs truncate">
                    {savedAt}
                  </span>
                )}
                <Button
                  type="button"
                  variant="success"
                  size="md"
                  onClick={handleSubmit}
                  disabled={loading}
                  icon={<Send className="w-4 h-4" />}
                  className="px-5 py-2.5 font-black"
                >
                  ارسال نهایی پاسخ‌ها
                </Button>
              </div>
            </div>

            {timeExpired && (
              <div
                role="alert"
                className="lens rounded-3xl p-4 border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 text-[var(--color-danger)] font-black text-caption flex items-center gap-2"
              >
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                زمان آزمون به پایان رسید — پاسخ‌ها دیگر ذخیره نمی‌شوند. پاسخ‌نامه خود را ثبت کنید.
              </div>
            )}

            <div inert={timeExpired} className="select-none">
              {questions.map((question, index) => (
                <StudentQuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  answer={answers[question.id]}
                  onAnswer={handleSaveAnswer}
                  disabled={timeExpired}
                />
              ))}
            </div>
          </div>
        )}

        {phase === 'submitted' && (
          <div className="lens rounded-3xl p-6 md:p-8 max-w-xl mx-auto text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-[var(--color-success)] mx-auto" />
            <h2 className="font-black text-[var(--color-text-primary)] text-heading-3">
              پاسخ شما با موفقیت در سامانه ثبت نهایی شد.
            </h2>
            <p className="text-caption text-[var(--color-text-tertiary)] leading-relaxed">
              پس از ارسال نهایی، نشست آزمون قفل شده و امکان تغییر پاسخ‌ها وجود ندارد. برای مشاهده
              کارنامه یا نتایج به دستورالعمل دبیر خود مراجعه نمایید.
            </p>
          </div>
        )}
      </main>

      {/* Designed confirmation for irreversible exam actions */}
      <ConfirmDialog
        isOpen={confirmStage === 'sync-queued'}
        title="همگام‌سازی پاسخ‌های آفلاین"
        message={`شما ${toPersianDigits(queuedCount)} پاسخ همگام‌نشدهٔ آفلاین دارید. ابتدا تلاش شود پاسخ‌ها به سرور ارسال شوند؟`}
        confirmText="همگام‌سازی و ادامه"
        cancelText="انصراف"
        onConfirm={handleConfirmSync}
        onCancel={() => setConfirmStage(null)}
      />
      <ConfirmDialog
        isOpen={confirmStage === 'final-submit'}
        title="ارسال نهایی آزمون"
        message="آیا از ارسال نهایی آزمون مطمئن هستید؟ پس از ارسال امکان تغییر پاسخ‌ها وجود ندارد."
        confirmText="ارسال نهایی"
        cancelText="انصراف"
        variant="danger"
        onConfirm={runFinalSubmit}
        onCancel={() => setConfirmStage(null)}
      />
    </div>
  );
}
