import React, { useEffect, useMemo, useState } from 'react';
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
  clearQueueForToken,
  getQueuedAnswers,
} from '../../services/offlineAnswerQueue';

type Phase = 'login' | 'ready' | 'take' | 'submitted';

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
  };
  points: number;
  sectionTitle?: string;
  position?: number;
};
type StartResponse = {
  ok: boolean;
  token: string;
  session: { id: string; status: string; started_at: string; submitted_at?: string | null };
  exam: SafeExam;
  student: SafeStudent;
};
type PayloadResponse = {
  ok: boolean;
  exam: SafeExam;
  session: { id: string; startedAt: string };
  questions: SafeQuestion[];
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
      not_allowed_for_exam: 'شما اجازه شرکت در این آزمون را ندارید.',
      too_many_requests: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
      session_not_active: 'نشست آزمون فعال نیست یا قبلاً ارسال شده است.',
      invalid_session: 'نشست آزمون نامعتبر است. دوباره وارد آزمون شوید.',
    };
    return map[code] || 'خطایی در ارتباط با سرور رخ داد.';
  }
  return 'خطایی غیرمنتظره رخ داد.';
}

export default function SecureExamPortal({
  presetExamCode,
  onBackToTeacher,
}: SecureExamPortalProps) {
  const [phase, setPhase] = useState<Phase>('login');
  const [examCode, setExamCode] = useState(presetExamCode || 'DEMO7');
  const [nationalId, setNationalId] = useState('');
  const [token, setToken] = useState('');
  const [exam, setExam] = useState<SafeExam | null>(null);
  const [student, setStudent] = useState<SafeStudent | null>(null);
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    const updateQueueCount = () => {
      const q = getQueuedAnswers().filter((item) => item.token === token);
      setQueuedCount(q.length);
    };
    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const handleStartSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiPost<StartResponse>('/api/student/start-session', {
        examCode,
        nationalId,
      });
      setToken(response.token);
      setExam(response.exam);
      setStudent(response.student);
      setPhase('ready');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPayload = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await apiPost<PayloadResponse>(
        '/api/student/exam-payload',
        {},
        { Authorization: 'Bearer ' + token },
      );
      setExam(response.exam);
      setQuestions(response.questions || []);
      setPhase('take');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnswer = async (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSaving(true);
    setError('');
    try {
      const response = await apiPost<{ ok: boolean; savedAt: string }>(
        '/api/student/save-answer',
        { questionId, answer: { value } },
        { Authorization: 'Bearer ' + token },
      );
      setSavedAt(response.savedAt);
    } catch (err) {
      logger.warn('Network save failed. Queuing answer offline:', err);
      queueAnswerOffline(token, questionId, value);
      setSavedAt('ذخیره به‌صورت آفلاین (در انتظار همگام‌سازی شبکه)');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncQueued = async () => {
    setSyncing(true);
    setError('');
    try {
      const result = await flushQueuedAnswers();
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

  const handleSubmit = async () => {
    if (queuedCount > 0) {
      const confirmSync = window.confirm(
        `شما ${toPersianDigits(queuedCount)} پاسخ همگام‌نشدۀ آفلاین دارید. آیا ابتدا تلاش شود پاسخ‌ها به سرور ارسال گردند؟`,
      );
      if (confirmSync) {
        await handleSyncQueued();
        if (getQueuedAnswers().filter((q) => q.token === token).length > 0) {
          alert('خطا: ابتدا از اتصال اینترنت خود اطمینان حاصل کنید تا پاسخ‌های آفلاین همگام شوند.');
          return;
        }
      } else {
        return;
      }
    }

    if (
      !window.confirm(
        'آیا از ارسال نهایی آزمون مطمئن هستید؟ پس از ارسال امکان تغییر پاسخ‌ها وجود ندارد.',
      )
    )
      return;
    setError('');
    setLoading(true);
    try {
      await apiPost('/api/student/submit', {}, { Authorization: 'Bearer ' + token });
      clearQueueForToken(token);
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
      className="min-h-screen bg-[var(--color-on-dark-subtle)] text-[var(--color-text-primary)] flex flex-col"
    >
      <header className="border-b border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-label font-black text-[var(--color-text-primary)]">
                درگاه امن آزمون (آلفا نسخه ۲)
              </h1>
              <p className="text-micro text-[var(--color-text-tertiary)]">
                مجهز به ذخیره‌ساز هوشمند آفلاین در قطعی اینترنت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToTeacher}
            className="text-caption font-bold text-[var(--color-accent)] hover:underline"
          >
            بازگشت به پنل معلم
          </button>
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
            className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-sm p-6 md:p-8 max-w-xl mx-auto space-y-5"
          >
            <div className="text-center space-y-2">
              <Lock className="w-12 h-12 mx-auto text-[var(--color-accent)]" />
              <h2 className="font-black text-[var(--color-text-primary)]">ورود امن دانش‌آموز</h2>
              <p className="text-caption text-[var(--color-text-tertiary)] leading-relaxed">
                کد ملی در مرورگر ذخیره نمی‌شود؛ اعتبارسنجی و تطبیق آن فقط در بک‌اند انجام می‌شود.
              </p>
            </div>
            <label className="block space-y-1.5 text-right">
              <span className="text-caption font-bold text-[var(--color-text-secondary)]">
                کد آزمون
              </span>
              <input
                value={examCode}
                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-on-dark-subtle)] px-4 py-3 text-label font-bold text-left ltr"
              />
            </label>
            <label className="block space-y-1.5 text-right">
              <span className="text-caption font-bold text-[var(--color-text-secondary)]">
                کد ملی دانش‌آموز
              </span>
              <input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="مثلاً 1000000001"
                className="w-full rounded-xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-on-dark-subtle)] px-4 py-3 text-label font-bold text-left tracking-widest"
              />
            </label>
            <button
              type="submit"
              disabled={loading || nationalId.length !== 10}
              className="w-full rounded-xl bg-[var(--color-accent-solid)] disabled:bg-[var(--color-accent-soft)]/40 text-[var(--color-text-on-solid)] py-3 text-label font-black flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              ورود امن به آزمون
            </button>
          </form>
        )}

        {phase === 'ready' && exam && student && (
          <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-sm p-6 md:p-8 max-w-2xl mx-auto space-y-5 text-center">
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
            <button
              type="button"
              onClick={handleLoadPayload}
              disabled={loading}
              className="rounded-xl bg-[var(--color-accent-solid)] disabled:bg-[var(--color-accent-soft)]/40 text-[var(--color-text-on-solid)] px-6 py-3 text-label font-black inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              دریافت سوالات و شروع آزمون
            </button>
          </div>
        )}

        {phase === 'take' && exam && (
          <div className="space-y-5">
            <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-glass-light-stroke)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-10 shadow-xs">
              <div>
                <h2 className="font-black text-[var(--color-text-primary)]">{exam.title}</h2>
                <p className="text-caption text-[var(--color-text-tertiary)] mt-1">
                  پاسخ‌داده‌شده: {toPersianDigits(answeredCount)} از{' '}
                  {toPersianDigits(questions.length)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-caption">
                {queuedCount > 0 ? (
                  <div className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 text-[var(--color-warning)]/80 rounded-xl px-3 py-2 flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-[var(--color-warning)] animate-pulse" />
                    <span className="font-bold">
                      {toPersianDigits(queuedCount)} پاسخ همگام‌نشده (آفلاین)
                    </span>
                    <button
                      type="button"
                      onClick={handleSyncQueued}
                      disabled={syncing}
                      className="bg-[var(--color-warning-solid)] hover:bg-[var(--color-warning-solid)] px-2 py-1 rounded-lg font-black text-[var(--color-warning)] inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {syncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      همگام‌سازی الآن
                    </button>
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
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-xl bg-[var(--color-success-solid)] disabled:bg-[var(--color-success-solid)] text-[var(--color-text-on-solid)] px-5 py-2.5 font-black inline-flex items-center gap-2 shadow-sm hover:bg-[var(--color-success-solid)]/90 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  ارسال نهایی پاسخ‌ها
                </button>
              </div>
            </div>

            {questions.map((question, index) => (
              <section
                key={question.id}
                className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-sm p-5 md:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-glass-light-stroke)] pb-3">
                  <h3 className="font-black text-[var(--color-text-primary)] text-label">
                    سوال {toPersianDigits(index + 1)}: {question.title}
                  </h3>
                  <span className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 rounded-xl px-3 py-1 text-caption font-black">
                    {toPersianDigits(question.points)} نمره
                  </span>
                </div>
                <p className="text-label text-[var(--color-text-secondary)] leading-relaxed">
                  {question.body?.text || 'متن سوال موجود نیست.'}
                </p>
                {question.body?.imageUrl && (
                  <div className="my-3">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={question.body!.imageUrl}
                      alt="پیوست سوال"
                      className="max-h-64 rounded-2xl object-cover border border-[var(--color-glass-light-stroke)] shadow-xs"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(question.body?.options || []).map((option) => {
                    const selected = answers[question.id] === option.id;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() => handleSaveAnswer(question.id, option.id)}
                        className={
                          (selected
                            ? 'border-[var(--color-accent)]/100 bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs font-black '
                            : 'border-[var(--color-glass-light-stroke)] bg-[var(--color-on-dark-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-glass-light-stroke)] ') +
                          'rounded-2xl border p-4 text-right text-caption transition-all flex items-center justify-between cursor-pointer'
                        }
                      >
                        <span>{option.text}</span>
                        {option.imageUrl && (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={option.imageUrl}
                            alt="گزینه"
                            className="w-10 h-10 rounded-lg object-cover border border-[var(--color-glass-light-stroke)] ml-2"
                          />
                        )}
                        <span className="font-mono text-micro text-[var(--color-text-tertiary)] font-bold bg-[var(--color-surface)] px-2 py-0.5 rounded-md border">
                          {option.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {phase === 'submitted' && (
          <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-sm p-8 max-w-xl mx-auto text-center space-y-4 animate-in zoom-in-95 duration-200">
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
    </div>
  );
}
