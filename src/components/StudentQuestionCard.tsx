/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { toPersianDigits } from '../utils/persian';
import { QuestionImage } from './student-questions/typedInputs';
import { AnswerBody } from './student-questions/answerBody';
import type { StudentAnswerValue, StudentQuestion } from './student-questions/types';

export type { StudentAnswerValue, StudentQuestion, StudentQuestionBody } from './student-questions/types';

/**
 * Full student question card: header, text, image, typed input.
 * `answer` is the current value for this question id (any JSON the server
 * accepted); `onAnswer` saves through the portal's save path.
 *
 * Structure lives in ./student-questions: types.ts (the saved-answer
 * contract), typedInputs.tsx (leaf input per question type),
 * answerBody.tsx (the composite switch incl. recursive cloze parts).
 */
export default function StudentQuestionCard({
  question,
  index,
  answer,
  onAnswer,
  disabled,
}: {
  question: StudentQuestion;
  index: number;
  answer: unknown;
  onAnswer: (questionId: string, value: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  const value = answer as StudentAnswerValue | undefined;

  return (
    <section className="lens rounded-3xl p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-glass-light-stroke)] pb-3">
        <h3 className="text-[var(--color-text-primary)] text-label">
          سوال {toPersianDigits(index + 1)}: {question.title}
        </h3>
        <span className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 rounded-xl px-3 py-1 text-caption font-bold">
          {toPersianDigits(question.points)} نمره
        </span>
      </div>
      <p className="text-label text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {question.body?.text || 'متن سوال موجود نیست.'}
      </p>
      <QuestionImage url={question.body?.imageUrl} alt="پیوست سوال" />
      <AnswerBody
        question={question}
        value={value}
        onChange={(next) => onAnswer(question.id, next)}
        disabled={disabled}
      />
    </section>
  );
}
