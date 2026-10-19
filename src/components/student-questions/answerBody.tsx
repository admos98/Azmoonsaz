/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { StudentAnswerValue, StudentQuestion, StudentQuestionBody } from './types';
import { toPersianDigits } from '../../utils/persian';
import { QuestionImage, SingleChoiceInput, MultipleChoiceInput, TrueFalseInput, FillBlankInput, TextInput, MatchingInput, OrderingInput } from './typedInputs';

function PartInput({
  part,
  value,
  onChange,
  disabled,
}: {
  part: NonNullable<StudentQuestionBody['parts']>[number];
  value: StudentAnswerValue | undefined;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  const inner: StudentQuestion = {
    id: part.id,
    type: part.type,
    title: part.text,
    body: { text: part.text, imageUrl: part.imageUrl, options: part.options },
    points: 0,
  };
  return (
    <div className="pane rounded-xl p-4 space-y-3">
      <p className="text-caption font-bold text-[var(--color-text-primary)]">{part.text}</p>
      <QuestionImage url={part.imageUrl} alt="پیوست مینی‌سوال" />
      <AnswerBody question={inner} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function AnswerBody({
  question,
  value,
  onChange,
  disabled,
}: {
  question: StudentQuestion;
  value: StudentAnswerValue | undefined;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  switch (question.type) {
    case 'single_choice':
    case 'image_based':
      return <SingleChoiceInput question={question} value={value as StudentAnswerValue} onChange={onChange} disabled={disabled} />;
    case 'multiple_choice':
      return <MultipleChoiceInput question={question} value={value as StudentAnswerValue} onChange={onChange} disabled={disabled} />;
    case 'true_false':
      return <TrueFalseInput value={value as StudentAnswerValue} onChange={onChange} disabled={disabled} />;
    case 'fill_blank': {
      // Field count comes from the server's non-secret blankCount; fall back
      // to the restored length so refresh never loses a row, then to 1.
      const serverCount =
        typeof question.body.blankCount === 'number' && question.body.blankCount >= 1
          ? Math.min(20, Math.floor(question.body.blankCount))
          : 0;
      const blanks = Array.isArray(value) ? value.length : 0;
      return (
        <FillBlankInput
          blankCount={Math.max(1, serverCount, blanks)}
          value={value as StudentAnswerValue}
          onChange={onChange}
          disabled={disabled}
        />
      );
    }
    case 'short_answer':
      return <TextInput value={value as StudentAnswerValue} onChange={onChange} disabled={disabled} long={false} />;
    case 'long_answer':
      return <TextInput value={value as StudentAnswerValue} onChange={onChange} disabled={disabled} long />;
    case 'matching':
      return (
        <MatchingInput
          pairs={question.body.displayPairs || []}
          value={value as StudentAnswerValue}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'ordering':
      return (
        <OrderingInput
          items={question.body.displayItems || []}
          value={value as StudentAnswerValue}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'cloze':
    case 'reading_comprehension': {
      const map =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, StudentAnswerValue>)
          : {};
      return (
        <div className="space-y-3">
          {(question.body.parts || []).map((part) => (
            <PartInput
              key={part.id}
              part={part}
              value={map[part.id]}
              onChange={(next) => {
                // Cloze parts stay inside the shared schema: scalar-or-array
                // values only — nested objects would be dropped on save.
                const clean: string | string[] | boolean =
                  typeof next === 'string' || typeof next === 'boolean' || Array.isArray(next)
                    ? (next as string | string[] | boolean)
                    : String(next ?? '');
                onChange({ ...(map as Record<string, string | string[] | boolean>), [part.id]: clean });
              }}
              disabled={disabled}
            />
          ))}
        </div>
      );
    }
    default:
      return (
        <TextInput value={value as StudentAnswerValue} onChange={onChange} disabled={disabled} long={false} />
      );
  }
}

/**
 * Full student question card: header, text, image, typed input.
 * `answer` is the current value for this question id (any JSON the server
 * accepted); `onAnswer` saves through the portal's save path.
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
