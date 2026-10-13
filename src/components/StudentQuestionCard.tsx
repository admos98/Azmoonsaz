/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { toPersianDigits } from '../utils/persian';
import { ResolvedImage } from './QuestionImage';
import { PillButton, IconButton, Input, Textarea, Dropdown } from '../ui';

/**
 * Typed student answer renderer (T1) — one interactive input per question
 * type, matching the teacher's drawer data shapes:
 *
 * - single_choice / image_based → option id (string)
 * - multiple_choice → option id array (toggle)
 * - true_false → boolean
 * - fill_blank → string array, positional per blank
 * - short_answer / long_answer → free text (long uses textarea)
 * - matching → record { left: rightText } via per-row select
 * - ordering → ordered string array via up/down moves
 * - cloze / reading_comprehension → per-part record { partId: value };
 *   each part renders its own typed input recursively
 *
 * Never displays keys, rubrics, or correctness — pure input. `value` is the
 * restored answer (or undefined); every change calls `onChange` with the
 * full answer value for save-answer. Disabled entirely when `disabled`.
 */

export type StudentAnswerValue =
  | string
  | boolean
  | string[]
  | Record<string, string | string[] | boolean>;

/**
 * Shared answer-value contract (renderer → save → restore → queue → grader).
 * Mirrors the server's discriminated schema in examSecurity.js:
 * - scalar string/boolean: choice ids, true/false, free text
 * - string[]: multiple_choice ids, ordering sequence, fill-blank rows
 * - Record<string, string | string[]>: matching { left: right }, cloze/reading
 *   parts { partId: scalar-or-array }
 * Anything outside these shapes is dropped by sanitizeStudentAnswer — the
 * "saved" indicator must never conceal a lost answer.
 */

export interface StudentQuestionBody {
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
  /** Non-secret field count for fill-blank (correctFillBlanks stays server-side). */
  blankCount?: number;
}

export interface StudentQuestion {
  id: string;
  type: string;
  title: string;
  body: StudentQuestionBody;
  points: number;
}

const selectedCls =
  'border-[var(--color-accent)]/100 bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs font-black ';
const btnLayoutCls =
  'w-full rounded-2xl border p-4 text-right text-caption transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ';

function QuestionImage({ url, alt }: { url?: string; alt: string }) {
  if (!url) return null;
  return (
    <div className="my-3">
      <ResolvedImage
        value={url}
        alt={alt}
        className="max-h-64 rounded-2xl border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)]"
        imgClassName="max-h-64 rounded-2xl object-contain border border-[var(--color-glass-light-stroke)] shadow-xs bg-[var(--color-surface)]"
      />
    </div>
  );
}

function OptionImage({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <ResolvedImage
      value={url}
      alt="گزینه"
      className="w-10 h-10 rounded-lg border border-[var(--color-glass-light-stroke)] ml-2 bg-[var(--color-surface)]"
      imgClassName="w-10 h-10 rounded-lg object-cover border border-[var(--color-glass-light-stroke)] ml-2 bg-[var(--color-surface)]"
    />
  );
}

function SingleChoiceInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: StudentQuestion;
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(question.body.options || []).map((option) => {
        const selected = value === option.id;
        return (
          <PillButton
            key={option.id}
            fill={selected ? 'accent-soft' : 'surface'}
            size="none"
            radius="2xl"
            text="caption"
            weight="black"
            textColor={selected ? 'accent' : 'secondary'}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`${btnLayoutCls} ${selected ? selectedCls : 'border-[var(--color-glass-light-stroke)] hover:border-[var(--color-glass-light-stroke)]'}`}
          >
            <span>{option.text}</span>
            <OptionImage url={option.imageUrl} />
          </PillButton>
        );
      })}
    </div>
  );
}

function MultipleChoiceInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: StudentQuestion;
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  const selected = useMemo(() => (Array.isArray(value) ? value.map(String) : []), [value]);
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(question.body.options || []).map((option) => {
        const isOn = selected.includes(option.id);
        return (
          <PillButton
            key={option.id}
            fill={isOn ? 'accent-soft' : 'surface'}
            size="none"
            radius="2xl"
            text="caption"
            weight="black"
            textColor={isOn ? 'accent' : 'secondary'}
            aria-pressed={isOn}
            disabled={disabled}
            onClick={() => toggle(option.id)}
            className={`${btnLayoutCls} ${isOn ? selectedCls : 'border-[var(--color-glass-light-stroke)] hover:border-[var(--color-glass-light-stroke)]'}`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                  isOn ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : ''
                }`}
              >
                {isOn && <Check className="w-3.5 h-3.5 text-[var(--color-text-on-solid)]" />}
              </span>
              {option.text}
            </span>
            <OptionImage url={option.imageUrl} />
          </PillButton>
        );
      })}
    </div>
  );
}

function TrueFalseInput({
  value,
  onChange,
  disabled,
}: {
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  const choices: { label: string; val: boolean }[] = [
    { label: 'درست', val: true },
    { label: 'نادرست', val: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((c) => {
        const selected = value === c.val;
        return (
          <PillButton
            key={String(c.val)}
            fill={selected ? 'accent-soft' : 'surface'}
            size="none"
            radius="2xl"
            text="caption"
            weight="black"
            textColor={selected ? 'accent' : 'secondary'}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(c.val)}
            className={`border p-4 text-center transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selected ? selectedCls : 'border-[var(--color-glass-light-stroke)] hover:border-[var(--color-glass-light-stroke)]'}`}
          >
            {c.label}
          </PillButton>
        );
      })}
    </div>
  );
}

function FillBlankInput({
  blankCount,
  value,
  onChange,
  disabled,
}: {
  blankCount: number;
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  const rows = Array.isArray(value) ? value.map(String) : [];
  const setRow = (index: number, text: string) => {
    const next = [...rows];
    while (next.length <= index) next.push('');
    next[index] = text;
    onChange(next);
  };
  return (
    <div className="space-y-2.5">
      {Array.from({ length: Math.max(1, blankCount) }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-micro font-bold text-[var(--color-text-secondary)] shrink-0">
            جای خالی {toPersianDigits(i + 1)}:
          </span>
          <Input
            value={rows[i] || ''}
            onChange={(e) => setRow(i, e.target.value)}
            disabled={disabled}
            placeholder="پاسخ خود را بنویسید"
            aria-label={`جای خالی ${toPersianDigits(i + 1)}`}
          />
        </div>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  disabled,
  long,
}: {
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
  long: boolean;
}) {
  const text = typeof value === 'string' ? value : '';
  if (long) {
    return (
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder="پاسخ تشریحی خود را بنویسید"
      />
    );
  }
  return (
    <Input
      value={text}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="پاسخ خود را بنویسید"
    />
  );
}

function MatchingInput({
  pairs,
  value,
  onChange,
  disabled,
}: {
  pairs: { left: string; right: string }[];
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  const map =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string | string[] | boolean>)
      : {};
  // Right column is the fixed choice pool (shuffled display keeps canonical
  // mapping server-side; the student matches by visible text).
  const rightPool = useMemo(() => pairs.map((p) => p.right), [pairs]);
  const setRow = (left: string, right: string) => {
    onChange({ ...map, [left]: right });
  };
  return (
    <div className="space-y-2.5">
      {pairs.map((pair, i) => {
        const current = typeof map[pair.left] === 'string' ? (map[pair.left] as string) : '';
        return (
          <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="glx-inset text-[var(--color-text-primary)] px-3 py-2 rounded-xl font-bold text-caption flex-1">
              {pair.left}
            </span>
            <span className="text-[var(--color-text-tertiary)] font-black text-center">➔</span>
            {disabled ? (
              <span className="glx-inset px-3 py-2 rounded-xl font-bold text-caption flex-1 text-[var(--color-text-secondary)]">
                {current || '—'}
              </span>
            ) : (
              <Dropdown
                value={current}
                onChange={(next) => setRow(pair.left, next)}
                options={rightPool.map((right) => ({ value: right, label: right }))}
                placeholder="انتخاب کنید…"
                ariaLabel={`معادل ${pair.left}`}
                compact
                className="flex-1"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderingInput({
  items,
  value,
  onChange,
  disabled,
}: {
  items: string[];
  value: StudentAnswerValue;
  onChange: (next: StudentAnswerValue) => void;
  disabled: boolean;
}) {
  // Local order state, seeded from the display items; every move commits.
  // A pristine list commits its initial sequence once — an untouched order is
  // still an answer (grading compares sequences), and without this no answer
  // row exists until the first move. The ref guards re-runs (StrictMode,
  // parent re-renders); later moves commit explicitly.
  const current: string[] = Array.isArray(value) && value.length > 0 ? value.map(String) : [...items];
  const committedInitial = useRef(false);
  useEffect(() => {
    if (!disabled && !committedInitial.current && !(Array.isArray(value) && value.length > 0)) {
      committedInitial.current = true;
      if (items.length > 0) onChange([...items]);
    }
  });
  const move = (index: number, dir: -1 | 1) => {
    const next = [...current];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-micro text-[var(--color-text-secondary)] font-bold">
        با دکمه‌ها ترتیب درست را بچینید (بالا = اول):
      </p>
      {current.map((item, i) => (
        <div key={`${item}-${i}`} className="flex items-center gap-2 pane rounded-xl px-3 py-2">
          <span className="text-micro font-black text-[var(--color-text-secondary)] shrink-0">
            {toPersianDigits(i + 1)}
          </span>
          <span className="flex-1 text-caption font-bold text-[var(--color-text-primary)]">{item}</span>
          <IconButton
            label="انتقال به بالا"
            size="xs"
            radius="lg"
            tone="secondary"
            surface="bright"
            onClick={() => move(i, -1)}
            disabled={disabled || i === 0}
            className="px-2 py-1 btn-glass btn-glass--quiet text-micro font-black disabled:opacity-40"
          >
            ▲
          </IconButton>
          <IconButton
            label="انتقال به پایین"
            size="xs"
            radius="lg"
            tone="secondary"
            surface="bright"
            onClick={() => move(i, 1)}
            disabled={disabled || i === current.length - 1}
            className="px-2 py-1 btn-glass btn-glass--quiet text-micro font-black disabled:opacity-40"
          >
            ▼
          </IconButton>
        </div>
      ))}
    </div>
  );
}

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

function AnswerBody({
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
        <h3 className="font-black text-[var(--color-text-primary)] text-label">
          سوال {toPersianDigits(index + 1)}: {question.title}
        </h3>
        <span className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 rounded-xl px-3 py-1 text-caption font-black">
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
