import React, { useMemo } from 'react';
import { Button, Card, PageHeader } from './UIComponents';
import { AlertTriangle, BookOpen, RefreshCw } from 'lucide-react';
import { useTeacherCollections } from '../contexts/TeacherContext';

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
  // The health readout rides the shared questions cache; the retry button
  // re-runs the collection loader instead of a private fetch.
  const { questions, status, reload } = useTeacherCollections();
  const loadState: LoadState =
    status.questions === 'loading'
      ? 'loading'
      : status.questions === 'error'
        ? 'error'
        : 'ready';
  const load = () => void reload('questions');

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
    <Card
      glassLayer="light"
      className="rounded-3xl space-y-5"
      aria-busy={loadState === 'loading'}
    >
      <PageHeader
        level={2}
        icon={<BookOpen className="h-5 w-5" />}
        title="سلامت بانک سوالات"
        subtitle="پوشش سوال‌ها بر اساس پایه و ساختار"
      />
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
          <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw className="h-4 w-4" />}>
            تلاش دوباره
          </Button>
        </div>
      )}
      {loadState === 'ready' && (
        <>
          {questions.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 block text-caption md:text-label font-bold text-[var(--color-text-secondary)]">پایه تحصیلی</h3>
                <HealthBar items={data.grades} total={questions.length} />
              </div>
              <div>
                <h3 className="mb-3 block text-caption md:text-label font-bold text-[var(--color-text-secondary)]">نوع سوال</h3>
                <HealthBar items={data.types} total={questions.length} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--color-glass-light-fill)] p-6 text-center text-caption text-[var(--color-text-secondary)]">
              هنوز سوالی ثبت نشده است. اولین سوال را از بخش پایین اضافه کنید.
            </div>
          )}
          {questions.length > 0 && questions.length < 12 && (
            <div className="flex gap-3 rounded-lg bg-[var(--color-warning-soft)] p-4 text-caption text-[var(--color-warning)]">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>برای ساخت آزمون‌های متنوع‌تر، سوال‌های بیشتری به بانک اضافه کنید.</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
