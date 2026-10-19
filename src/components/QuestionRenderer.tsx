/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Award, Check } from 'lucide-react';
import { Question, QuestionType } from '../types';
import { toPersianDigits } from '../utils/persian';
import { ResolvedImage } from './QuestionImage';
import { AnswerKeySections } from './answerKeySections';

interface QuestionRendererProps {
  question: Partial<Question> & {
    id: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    section?: string;
    explanation?: string;
    gradingGuide?: string;
    sampleAnswer?: string;
    correctAnswerText?: string;
  };
  showCorrectAnswers?: boolean; // Highlight correct options/keys for teacher preview
  onAnswerChange?: (questionId: string, answer: string | string[] | Record<string, string>) => void;
  currentAnswer?: string | string[] | Record<string, string>;
}

export default function QuestionRenderer({
  question,
  showCorrectAnswers = true,
}: QuestionRendererProps) {
  const getDifficultyLabel = (diff: string | undefined): string => {
    if (diff === 'easy') return 'آسان';
    if (diff === 'medium') return 'متوسط';
    if (diff === 'hard') return 'سخت';
    return 'متوسط';
  };

  const getDifficultyColor = (diff: string | undefined): string => {
    if (diff === 'easy')
      return 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15';
    if (diff === 'hard')
      return 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border-[var(--color-danger)]/20';
    return 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/20';
  };

  const getTypeNameInPersian = (type: QuestionType | undefined): string => {
    if (!type) return '';
    const names: Record<QuestionType, string> = {
      single_choice: 'چهارگزینه‌ای تک‌پاسخ',
      multiple_choice: 'چندگزینه‌ای چندپاسخ',
      true_false: 'درست / نادرست',
      matching: 'وصل‌کردنی',
      ordering: 'مرتب‌سازی',
      fill_blank: 'جای خالی',
      short_answer: 'پاسخ کوتاه',
      long_answer: 'تشریحی',
      cloze: 'کلوز تست',
      reading_comprehension: 'درک مطلب',
      image_based: 'سوال تصویری',
    };
    return names[type] || 'طرح عمومی';
  };

  // Check if options have images to switch styles
  const optionsHaveImages = question.options?.some((o) => o.imageUrl);

  return (
    <div
      className="pane p-5 md:p-6 rounded-2xl space-y-5 text-right font-sans"
      dir="rtl"
      id={`render-q-${question.id}`}
    >
      {/* Header Specs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-accent)]/10 pb-3 text-caption">
        <div className="flex items-center gap-2">
          <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-soft)] px-2.5 py-1 rounded-full font-bold">
            {getTypeNameInPersian(question.type)}
          </span>
          {question.grade && (
            <span className="glx-inset text-[var(--color-text-secondary)] px-2 py-1 rounded-md">
              پایه {question.grade}
            </span>
          )}
          {question.category && (
            <span className="glx-inset text-[var(--color-text-secondary)] px-2 py-1 rounded-md font-medium">
              درس {question.category}
            </span>
          )}
          {question.section && (
            <span className="bg-[var(--color-accent-soft)]/30 text-[var(--color-text-tertiary)] px-2 py-1 rounded-md">
              فصل: {question.section}
            </span>
          )}
          {question.difficulty && (
            <span
              className={`px-2 py-0.5 rounded-full border text-micro ${getDifficultyColor(question.difficulty)}`}
            >
              {getDifficultyLabel(question.difficulty)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[var(--color-warning-soft)]/70 border border-[var(--color-warning)]/20 text-[var(--color-text-secondary)] px-3 py-1 rounded-xl">
          <Award className="w-4 h-4 text-[var(--color-warning-soft)]/500" />
          <span className="font-extrabold text-caption">
            {toPersianDigits(question.points)} نمره
          </span>
        </div>
      </div>

      {/* Main Question Text and Image Block */}
      <div className="space-y-4">
        <div className="text-label font-semibold text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
          {question.text}
        </div>

        {/* Main Image Banner If Available */}
        {question.imageUrl && (
          <div className="mt-2.5 relative group inline-block max-w-full">
            <ResolvedImage
              value={question.imageUrl}
              alt="ضمیمه سوال"
              className="rounded-xl max-h-64 max-w-full pane"
              imgClassName="rounded-xl max-h-64 object-contain max-w-full pane"
            />
            <span className="absolute bottom-2 right-2 bg-black/30 text-[var(--color-text-on-solid)] rounded-md px-2 py-0.5 text-micro font-mono">
              پیوست اصلی تصویر سوال
            </span>
          </div>
        )}
      </div>

      {/* Render layouts according to question type */}

      {/* 1. Choice Questions: single_choice, multiple_choice, image_based */}
      {(question.type === 'single_choice' ||
        question.type === 'multiple_choice' ||
        question.type === 'image_based') &&
        question.options && (
          <div
            className={`mt-3 ${optionsHaveImages ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2'}`}
          >
            {question.options.map((opt, index) => {
              const letters = ['الف', 'ب', 'ج', 'د', 'هـ', 'و'];
              // Is this option correct according to definition?
              const isCorrect =
                opt.isCorrect ||
                (question.type === 'single_choice' && question.correctAnswer === opt.id) ||
                (question.type === 'image_based' && question.correctAnswer === opt.id) ||
                (question.type === 'multiple_choice' &&
                  Array.isArray(question.correctAnswer) &&
                  question.correctAnswer.includes(opt.id));

              return (
                <div
                  key={opt.id}
                  className={`p-3.5 rounded-xl border text-caption flex flex-col justify-between transition-all ${
                    showCorrectAnswers && isCorrect
                      ? 'btn-glass btn-glass--success font-medium'
                      : 'btn-glass btn-glass--bare'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-bold text-micro ${
                        showCorrectAnswers && isCorrect
                          ? 'bg-[var(--color-success-solid)] text-[var(--color-text-on-solid)]'
                          : 'glx-inset text-[var(--color-text-primary)]'
                      }`}
                    >
                      {letters[index] || toPersianDigits(index + 1)}
                    </span>

                    <div className="space-y-2.5 flex-1 text-right">
                      <span className="leading-relaxed">{opt.text}</span>

                      {/* Option-specific Image attachment if exists */}
                      {opt.imageUrl && (
                        <div className="mt-2 block">
                          <ResolvedImage
                            value={opt.imageUrl}
                            alt={`تصویر گزینه ${letters[index] || index}`}
                            className="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 w-full bg-[var(--color-surface)]"
                            imgClassName="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 object-contain w-full bg-[var(--color-surface)] shadow-3xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {showCorrectAnswers && isCorrect && (
                    <div className="mr-8 mt-2 flex items-center gap-1 text-micro text-[var(--color-success)]">
                      <Check className="w-3.5 h-3.5" />
                      <span>گزینه پاسخ صحیح</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      <AnswerKeySections question={question} showCorrectAnswers={showCorrectAnswers} />

      {/* Question Tags block at footer */}
      {question.tags && question.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-glass-light-stroke)] pt-3 text-micro">
          <span className="text-[var(--color-text-tertiary)] font-medium">برچسب‌ها:</span>
          {question.tags.map((tag, idx) => (
            <span
              key={idx}
              className="glx-inset text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full font-bold"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
