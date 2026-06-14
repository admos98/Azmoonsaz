import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, Lock, Send, ShieldCheck } from 'lucide-react';
import { apiPost, ApiError } from '../../lib/apiClient';
import { toPersianDigits } from '../../utils/persian';

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

type SafeStudent = {
  id: string;
  name: string;
  grade: string;
};

type SafeQuestion = {
  id: string;
  type: string;
  title: string;
  body: {
    text?: string;
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

export default function SecureExamPortal({ presetExamCode, onBackToTeacher }: SecureExamPortalProps) {
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
      const response = await apiPost<PayloadResponse>('/api/student/exam-payload', { token });
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
      const response = await apiPost<{ ok: boolean; savedAt: string }>('/api/student/save-answer', {
        token,
        questionId,
        answer: { value },
      });
      setSavedAt(response.savedAt);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('آیا از ارسال نهایی آزمون مطمئن هستید؟ پس از ارسال امکان تغییر پاسخ‌ها وجود ندارد.')) return;
    setError('');
    setLoading(true);
    try {
      await apiPost('/api/student/submit', { token });
      setPhase('submitted');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800">درگاه امن آزمون</h1>
              <p className="text-[11px] text-slate-400">نسخه متصل به بک‌اند امن</p>
            </div>
          </div>
          <button onClick={onBackToTeacher} className="text-xs font-bold text-indigo-700 hover:underline">
            بازگشت به پنل معلم
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {phase === 'login' && (
          <form onSubmit={handleStartSession} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-xl mx-auto space-y-5">
            <div className="text-center space-y-2">
              <Lock className="w-12 h-12 mx-auto text-indigo-600" />
              <h2 className="font-black text-slate-800">ورود امن دانش‌آموز</h2>
              <p className="text-xs text-slate-500 leading-relaxed">کد ملی در مرورگر ذخیره نمی‌شود؛ اعتبارسنجی و تطبیق آن فقط در بک‌اند انجام می‌شود.</p>
            </div>

            <label className="block space-y-1.5 text-right">
              <span className="text-xs font-bold text-slate-600">کد آزمون</span>
              <input value={examCode} onChange={(e) => setExamCode(e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-left ltr" />
            </label>

            <label className="block space-y-1.5 text-right">
              <span className="text-xs font-bold text-slate-600">کد ملی دانش‌آموز</span>
              <input value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/D/g, '').slice(0, 10))} placeholder="مثلاً 1000000001" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-left tracking-widest" />
            </label>

            <button disabled={loading || nationalId.length !== 10} className="w-full rounded-xl bg-indigo-600 disabled:bg-indigo-300 text-white py-3 text-sm font-black flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              ورود امن به آزمون
            </button>
          </form>
        )}

        {phase === 'ready' && exam && student && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-2xl mx-auto space-y-5 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h2 className="font-black text-slate-800">سلام، {student.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 rounded-2xl p-3"><span className="block text-slate-400">آزمون</span><strong>{exam.title}</strong></div>
              <div className="bg-slate-50 rounded-2xl p-3"><span className="block text-slate-400">درس</span><strong>{exam.subject}</strong></div>
              <div className="bg-slate-50 rounded-2xl p-3"><span className="block text-slate-400">زمان</span><strong>{toPersianDigits(exam.durationMinutes)} دقیقه</strong></div>
            </div>
            <button onClick={handleLoadPayload} disabled={loading} className="rounded-xl bg-indigo-600 disabled:bg-indigo-300 text-white px-6 py-3 text-sm font-black inline-flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              دریافت سوالات و شروع آزمون
            </button>
          </div>
        )}

        {phase === 'take' && exam && (
          <div className="space-y-5">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-10">
              <div>
                <h2 className="font-black text-slate-800">{exam.title}</h2>
                <p className="text-xs text-slate-500 mt-1">پاسخ‌داده‌شده: {toPersianDigits(answeredCount)} از {toPersianDigits(questions.length)}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {saving && <span className="text-amber-600 font-bold">در حال ذخیره...</span>}
                {savedAt && !saving && <span className="text-emerald-600 font-bold">ذخیره شد</span>}
                <button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-emerald-600 disabled:bg-emerald-300 text-white px-4 py-2.5 font-black inline-flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  ارسال نهایی
                </button>
              </div>
            </div>

            {questions.map((question, index) => (
              <section key={question.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 className="font-black text-slate-800 text-sm">سوال {toPersianDigits(index + 1)}: {question.title}</h3>
                  <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-xl px-3 py-1 text-xs font-black">{toPersianDigits(question.points)} نمره</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{question.body?.text || 'متن سوال موجود نیست.'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(question.body?.options || []).map((option) => {
                    const selected = answers[question.id] === option.id;
                    return (
                      <button key={option.id} onClick={() => handleSaveAnswer(question.id, option.id)} className={(selected ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 ') + 'rounded-2xl border p-4 text-right text-xs font-bold transition-all'}>
                        <span className="font-mono ml-2">{option.id}</span>
                        {option.text}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {phase === 'submitted' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 max-w-xl mx-auto text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
            <h2 className="font-black text-slate-800">پاسخ شما با موفقیت ثبت شد.</h2>
            <p className="text-xs text-slate-500">پس از ارسال نهایی، نشست آزمون قفل شده و امکان تغییر پاسخ‌ها وجود ندارد.</p>
          </div>
        )}
      </main>
    </div>
  );
}
