/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Button } from '../../../ui';
import { toPersianDigits } from '../../../utils/persian';
import type { ExamSession } from '../useExamSession';

/** Post-login handoff: exam identity tiles and the paper-load action. */
export function ReadyScreen({ session }: { session: ExamSession }) {
  const { exam, student, handleLoadPayload, loading } = session;

  if (!exam || !student) return null;

  return (
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
        className="px-6 py-3 text-label"
      >
        دریافت سوالات و شروع آزمون
      </Button>
    </div>
  );
}
