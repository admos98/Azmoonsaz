/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Clock, Loader2, RefreshCw, Send, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { Button, PillButton } from '../../../ui';
import { ExamCountdown } from '../../../components/ExamCountdown';
import StudentQuestionCard from '../../../components/StudentQuestionCard';
import { toPersianDigits } from '../../../utils/persian';
import { Watermark } from '../../exam-guard/Watermark';
import type { ExamSession } from '../useExamSession';

/** The exam itself: proctor banner, status bar (countdown / offline queue /
 * save state), the timed-out notice, and the paper. */
export function TakeScreen({ session }: { session: ExamSession }) {
  const {
    answers,
    answeredCount,
    exam,
    guard,
    handleSaveAnswer,
    handleSubmit,
    handleSyncQueued,
    loading,
    questions,
    savedAt,
    saving,
    sessionStartedAt,
    setTimeExpired,
    student,
    syncing,
    queuedCount,
    timeExpired,
  } = session;

  if (!exam || !student) return null;

  return (
    <>
      <Watermark
        label={`${student.name} — کد آزمون ${exam.examCode} — ${exam.title}`}
      />

      <div className="space-y-5">
        {guard.total > 0 && (
          <div
            role="status"
            className="lens rounded-2xl p-3 border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 text-[var(--color-warning)] text-caption font-bold flex items-center gap-2"
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
    </>
  );
}
