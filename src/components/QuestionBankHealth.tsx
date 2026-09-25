import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, RefreshCw } from 'lucide-react';
import { questionService } from '../services/api';
import { Question } from '../types';

type HealthItem = { label: string; count: number };
type LoadState = 'loading' | 'ready' | 'error';

function HealthBar({ items, total }: { items: HealthItem[]; total: number }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-[70px_1fr_35px] items-center gap-3 text-caption"
        >
          <span>{item.label}</span>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-black/[.05]"
            role="progressbar"
            aria-label={`${item.label}: ${item.count}`}
            aria-valuenow={item.count}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="h-full rounded-full bg-[var(--color-ink)]"
              style={{ width: total ? `${Math.max(3, (item.count / total) * 100)}%` : '0%' }}
            />
          </div>
          <b>{item.count.toLocaleString('fa-IR')}</b>
        </div>
      ))}
    </div>
  );
}

export default function QuestionBankHealth() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const load = () => {
    setLoadState('loading');
    questionService
      .getQuestions({ throwOnError: true })
      .then((result) => {
        setQuestions(result);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/set-state-in-effect -- starts an external request

  const data = useMemo(() => {
    const grades = ['هفتم', 'هشتم', 'نهم'].map((label) => ({
      label,
      count: questions.filter((question) => question.grade === label).length,
    }));
    const choice = questions.filter(
      (question) => question.type === 'single_choice' || question.type === 'multiple_choice',
    ).length;
    const essay = questions.filter(
      (question) => question.type === 'long_answer' || question.type === 'short_answer',
    ).length;
    return {
      grades,
      types: [
        { label: 'تستی', count: choice },
        { label: 'تشریحی', count: essay },
        { label: 'سایر', count: Math.max(0, questions.length - choice - essay) },
      ],
    };
  }, [questions]);

  return (
    <section className="profile-panel space-y-5" aria-busy={loadState === 'loading'}>
      <div className="profile-section-title">
        <BookOpen aria-hidden="true" />
        <div>
          <h2>سلامت بانک سوالات</h2>
          <p>پوشش سوال‌ها بر اساس پایه و ساختار</p>
        </div>
      </div>
      {loadState === 'loading' && (
        <div
          role="status"
          className="grid min-h-32 place-items-center text-caption text-[var(--color-text-secondary)]"
        >
          در حال محاسبه وضعیت بانک سوالات…
        </div>
      )}
      {loadState === 'error' && (
        <div
          role="alert"
          className="grid min-h-32 place-items-center gap-3 text-center text-caption text-[var(--color-danger)]"
        >
          <span>دریافت وضعیت بانک سوالات انجام نشد.</span>
          <button type="button" className="btn-soft" onClick={load}>
            <RefreshCw className="h-4 w-4" /> تلاش دوباره
          </button>
        </div>
      )}
      {loadState === 'ready' && (
        <>
          {questions.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="profile-field-title mb-3">پایه تحصیلی</h3>
                <HealthBar items={data.grades} total={questions.length} />
              </div>
              <div>
                <h3 className="profile-field-title mb-3">نوع سوال</h3>
                <HealthBar items={data.types} total={questions.length} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--color-glass-light-fill)] p-6 text-center text-caption text-[var(--color-text-secondary)]">
              هنوز سوالی ثبت نشده است. اولین سوال را از بخش پایین اضافه کنید.
            </div>
          )}
          {questions.length > 0 && questions.length < 12 && (
            <div className="flex gap-3 rounded-[14px] bg-[var(--color-warning-soft)] p-4 text-caption text-[var(--color-warning)]">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>برای ساخت آزمون‌های متنوع‌تر، سوال‌های بیشتری به بانک اضافه کنید.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
