/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { toPersianDigits } from '../../utils/persian';
import { ResolvedImage } from '../QuestionImage';
import { PillButton, IconButton, Input, Textarea, Dropdown } from '../../ui';
import type { StudentAnswerValue, StudentQuestion } from './types';

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
const selectedCls =
  'border-[var(--color-accent)]/100 bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs font-black ';
const btnLayoutCls =
  'w-full rounded-2xl border p-4 text-right text-caption transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ';

export function QuestionImage({ url, alt }: { url?: string; alt: string }) {
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

export function SingleChoiceInput({
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

export function MultipleChoiceInput({
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

export function TrueFalseInput({
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

export function FillBlankInput({
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
          <span className="text-micro text-[var(--color-text-secondary)] shrink-0">
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

export function TextInput({
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

export function MatchingInput({
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

export function OrderingInput({
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
      <p className="text-micro text-[var(--color-text-secondary)]">
        با دکمه‌ها ترتیب درست را بچینید (بالا = اول):
      </p>
      {current.map((item, i) => (
        <div key={`${item}-${i}`} className="flex items-center gap-2 pane rounded-xl px-3 py-2">
          <span className="text-micro text-[var(--color-text-secondary)] shrink-0">
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
            className="px-2 py-1 btn-glass btn-glass--quiet text-micro disabled:opacity-40"
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
            className="px-2 py-1 btn-glass btn-glass--quiet text-micro disabled:opacity-40"
          >
            ▼
          </IconButton>
        </div>
      ))}
    </div>
  );
}
