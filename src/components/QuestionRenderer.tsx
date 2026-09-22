/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, Award, Info } from 'lucide-react';
import { Question, QuestionType, QuestionPart, RubricCriterion } from '../types';

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
  const toPersianDigits = (str: string | number | undefined): string => {
    if (str === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

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
    return 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-amber-150';
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
      className="glx p-5 md:p-6 rounded-2xl border space-y-5 text-right font-sans"
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
              className={`px-2 py-0.5 rounded-full border text-micro font-bold ${getDifficultyColor(question.difficulty)}`}
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
            <img
              src={question.imageUrl}
              alt="ضمیمه سوال"
              referrerPolicy="no-referrer"
              className="rounded-xl border max-h-64 object-contain max-w-full glx"
            />
            <span className="absolute bottom-2 right-2 bg-black/30 text-white rounded-md px-2 py-0.5 text-micro font-mono">
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
                      ? 'bg-[var(--color-success-soft)]/80 border-[var(--color-success)]/30 text-[var(--color-success)] font-medium shadow-2xs'
                      : 'glx border text-[var(--color-text-secondary)] hover:border-[var(--color-glass-light-stroke)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-bold text-micro ${
                        showCorrectAnswers && isCorrect
                          ? 'bg-[var(--color-success)] text-white'
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
                          <img
                            src={opt.imageUrl}
                            alt={`تصویر گزینه ${letters[index] || index}`}
                            referrerPolicy="no-referrer"
                            className="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 object-contain w-full  bg-[var(--color-surface)] shadow-3xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {showCorrectAnswers && isCorrect && (
                    <div className="mr-8 mt-2 flex items-center gap-1 text-micro font-bold text-[var(--color-success)]">
                      <Check className="w-3.5 h-3.5" />
                      <span>گزینه پاسخ صحیح</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* 2. True False */}
      {question.type === 'true_false' && (
        <div className="flex gap-4 mt-3">
          {[
            { label: 'درست / صحیح', val: true },
            { label: 'نادرست / غلط', val: false },
          ].map((item) => {
            const isSelected = question.correctAnswer === item.val;
            return (
              <div
                key={String(item.val)}
                className={`flex-1 p-3.5 rounded-xl border text-center font-bold text-caption flex items-center justify-center gap-2 ${
                  showCorrectAnswers && isSelected
                    ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/30 text-[var(--color-success)] shadow-3xs'
                    : 'glx border text-[var(--color-text-secondary)]'
                }`}
              >
                <span>{item.label}</span>
                {showCorrectAnswers && isSelected && (
                  <span className="bg-[var(--color-success)] text-white p-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Fill Blank */}
      {question.type === 'fill_blank' && (
        <div className="space-y-3 mt-3">
          {showCorrectAnswers && question.correctFillBlanks && (
            <div className="bg-[var(--color-success-soft)]/60 border border-[var(--color-success)]/20 rounded-xl p-4 text-caption text-[var(--color-success)]">
              <span className="block font-bold mb-2">
                کلید واژه‌های صحیح برای پر کردن جاهای خالی:
              </span>
              <div className="flex flex-wrap gap-2">
                {question.correctFillBlanks.map((ans, idx) => (
                  <span
                    key={idx}
                    className="glx border border-[var(--color-success)]/20 px-3 py-1.5 rounded-lg font-mono font-bold text-[var(--color-success)]"
                  >
                    جای خالی شماره {toPersianDigits(idx + 1)}: «{ans}»
                  </span>
                ))}
              </div>
            </div>
          )}
          {!showCorrectAnswers && (
            <div className="p-4 glx rounded-xl border">
              <p className="text-[var(--color-text-tertiary)] text-caption italic">
                هنرجو یا دانش‌آموز کلمات مناسب را در فیلد پاسخ تابعه تایپ می‌کند.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. Short Answer */}
      {question.type === 'short_answer' && (
        <div className="space-y-3 mt-3">
          {showCorrectAnswers && question.correctAnswer && (
            <div className="bg-[var(--color-success-soft)]/60 border border-[var(--color-success)]/20 rounded-xl p-4 text-caption text-[var(--color-success)]">
              <span className="block font-bold mb-1.5">پاسخ کوتاه مورد قبول:</span>
              <p className="font-mono  bg-[var(--color-surface)] px-3 py-2 border border-[var(--color-success)]/10 rounded-lg">
                {String(question.correctAnswer)}
              </p>
            </div>
          )}
          {question.explanation && (
            <div className="glx rounded-xl p-3 border text-[var(--color-text-secondary)] text-micro leading-relaxed">
              <span className="font-bold text-[var(--color-text-primary)] block mb-1">
                توضیح دبیر / راهکار رسیدن به جواب:
              </span>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Long Answer / Descriptive (rubrics, manual corrections visual alert) */}
      {question.type === 'long_answer' && (
        <div className="space-y-3 mt-3">
          {/* Rubrics Criteria representation */}
          {question.rubrics && question.rubrics.length > 0 && (
            <div className="bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/10 rounded-xl p-4 space-y-2 text-caption">
              <span className="block font-bold text-[var(--color-danger)]/80 mb-1.5">
                معیارهای تصحیح و توزیع بارم پاسخ تشریحی:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.rubrics.map((rub: RubricCriterion) => (
                  <div
                    key={rub.id}
                    className="p-3 glx border border-[var(--color-danger)]/20/60 rounded-xl"
                  >
                    <div className="flex justify-between items-center pb-1.5 border-b border-[var(--color-danger)]/20 mb-1.5">
                      <strong className="text-[var(--color-danger)] font-bold">{rub.title}</strong>
                      <span className="bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)]/80 rounded-md px-1.5 py-0.5 text-micro font-extrabold">
                        {toPersianDigits(rub.maxPoints)} نمره
                      </span>
                    </div>
                    <p className="text-micro text-[var(--color-text-tertiary)] leading-relaxed">
                      {rub.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Answer */}
          {question.sampleAnswer && (
            <div className="bg-[var(--color-success-soft)]/50 border border-[var(--color-success)]/15 rounded-xl p-4 text-caption text-[var(--color-success)]">
              <h5 className="font-bold mb-1.5">پاسخ نمونه / مدل استاندارد پاسخ تشریحی:</h5>
              <p className="glx p-3 rounded-lg border border-[var(--color-success)]/10 whitespace-pre-wrap leading-relaxed text-[var(--color-text-secondary)]">
                {question.sampleAnswer}
              </p>
            </div>
          )}

          {/* Optional Teachers Grading Guide */}
          {question.gradingGuide && (
            <div className="bg-[var(--color-accent-soft)]/30 border border-[var(--color-accent)]/20 rounded-xl p-4 text-caption text-[var(--color-text-primary)]">
              <span className="font-bold text-[var(--color-accent)] block mb-1">
                راهنمای تصحیح برای معلم:
              </span>
              <p>{question.gradingGuide}</p>
            </div>
          )}

          {/* STRICT REQUIREMENT FOR IN_UI ALERT */}
          <div className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 rounded-xl p-3.5 text-caption text-[var(--color-warning)] flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">ملاحظه مهم تصحیح پاسخ‌برگ تشریحی:</p>
              <p className="text-micro leading-relaxed text-[var(--color-warning)]/80">
                تصحیح سوالات تشریحی به صورت دستی انجام می‌شود. در آینده می‌توان پیشنهاد نمره با هوش
                مصنوعی اضافه کرد.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. Matching Pair lists */}
      {question.type === 'matching' && question.matchingPairs && (
        <div className="glx rounded-xl p-4 border mt-3 text-caption">
          <p className="font-bold text-[var(--color-text-primary)] text-micro mb-2 border-b border-[var(--color-glass-light-stroke)] pb-1.5">
            نگاشت وصل‌کردنی صحیح:
          </p>
          <div className="space-y-2">
            {question.matchingPairs.map((pair, pIdx) => (
              <div
                key={pIdx}
                className="flex gap-2.5 items-center justify-between glx px-3 py-2 rounded-lg border border-[var(--color-glass-light-stroke)]/70"
              >
                <span className="glx-inset text-[var(--color-text-primary)] px-3 py-1.5 rounded-md font-bold text-center flex-1">
                  {pair.right}
                </span>
                <span className="text-[var(--color-accent)] font-black">➔</span>
                <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-soft)] px-3 py-1.5 rounded-md font-bold text-center flex-1">
                  {pair.left}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Ordering ordered elements listing */}
      {question.type === 'ordering' && question.orderingItems && (
        <div className="glx rounded-xl p-4 border mt-3 text-caption">
          <p className="font-bold text-[var(--color-accent)] mb-2.5">
            ترتیب قرارگیری پاسخ‌ها از راست به چپ:
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {question.orderingItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="glx border text-[var(--color-text-primary)] px-3.5 py-2 font-bold rounded-xl">
                  {idx + 1}. {item}
                </span>
                {idx < (question.orderingItems?.length || 0) - 1 && (
                  <span className="text-[var(--color-text-tertiary)] font-extrabold text-caption">
                    ➔
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Reading Comprehension (passage header, optional passage style image, and child subquestions parts list!) */}
      {question.type === 'reading_comprehension' && (
        <div className="space-y-4 mt-3">
          {/* Main Passage box */}
          <div
            className="bg-[var(--color-accent-soft)]/40 border border-[var(--color-accent)]/20/70 rounded-2xl p-4.5 space-y-3"
            id="passage-container"
          >
            <span className="bg-[var(--color-accent)] text-white rounded-lg px-2.5 py-0.5 text-micro font-bold inline-block">
              متن درک مطلب (Passage)
            </span>
            <p className="text-caption text-[var(--color-text-primary)] leading-relaxed leading-[1.8] font-medium pre-wrap">
              {question.text}
            </p>

            {/* Optional Passage Photo support */}
            {question.imageUrl && (
              <div className="mt-2 text-right">
                <img
                  src={question.imageUrl}
                  alt="پیوست درک مطلب"
                  referrerPolicy="no-referrer"
                  className="rounded-xl border border-[var(--color-glass-light-stroke)] max-h-48 object-contain  bg-[var(--color-surface)] shadow-3xs"
                />
              </div>
            )}
          </div>

          {/* Under subquestions parts listing! */}
          {question.parts && question.parts.length > 0 && (
            <div className="space-y-3 mt-4" id="comprehension-parts">
              <span className="block font-bold text-[var(--color-text-primary)] text-caption border-r-2 border-[var(--color-accent)]/100 pr-2">
                زیرسوالات درک مطلب:
              </span>

              {question.parts.map((part: QuestionPart, idx: number) => {
                const partLetters = ['الف', 'ب', 'پ', 'ت', 'ث'];
                return (
                  <div key={part.id} className="glx border rounded-xl p-4 space-y-3">
                    {/* Subquestion prompt */}
                    <div className="flex items-start justify-between gap-2.5">
                      <h6 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                        <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] w-5 h-5 rounded-full flex items-center justify-center text-micro font-extrabold">
                          {partLetters[idx] || toPersianDigits(idx + 1)}
                        </span>
                        <span>{part.text}</span>
                      </h6>
                      {part.correctAnswer && showCorrectAnswers && (
                        <span className="bg-[var(--color-success-soft)] text-[var(--color-success)] text-micro font-bold px-2.5 py-0.5 rounded-full border border-[var(--color-success)]/10">
                          کلید: {String(part.correctAnswer)}
                        </span>
                      )}
                    </div>

                    {/* Part options if any exists */}
                    {part.options && part.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-caption mr-5">
                        {part.options.map((opt, oIdx) => {
                          const isCorrect = opt.isCorrect || part.correctAnswer === opt.id;
                          return (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-lg border ${
                                showCorrectAnswers && isCorrect
                                  ? 'bg-[var(--color-success-soft)]/60 border-[var(--color-success)]/20 text-[var(--color-success)] font-bold'
                                  : 'glx border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
                              }`}
                            >
                              {oIdx + 1}. {opt.text}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 9. Cloze Test with inline blank positions */}
      {question.type === 'cloze' && (
        <div className="space-y-4 mt-3">
          <div
            className="bg-[var(--color-info-soft)]/30/40 border border-[var(--color-info)]/20/70 p-4.5 rounded-2xl text-caption text-[var(--color-text-primary)] leading-loose leading-[1.8]"
            id="cloze-passage"
          >
            <span className="bg-[var(--color-info-soft)]/80 text-white rounded-lg px-2 py-0.5 text-micro font-bold mb-3 inline-block">
              متن کلوز تست (Cloze Passage)
            </span>
            <p className="font-medium whitespace-pre-wrap">{question.text}</p>
          </div>

          {/* Mini parts option indicators per blank position */}
          {question.parts && question.parts.length > 0 && (
            <div className="space-y-3" id="cloze-blank-keys">
              <span className="block font-bold text-[var(--color-text-primary)] text-caption border-r-2 border-[var(--color-info)]/20 pr-2">
                پاسخ‌های گزینه‌ای نقاط خالی متن:
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.parts.map((p, pIdx) => {
                  return (
                    <div key={p.id} className="p-3 glx border rounded-xl space-y-2">
                      <strong className="text-[var(--color-info)] font-bold text-micro block text-right">
                        محل جای خالی شماره {toPersianDigits(pIdx + 1)}
                      </strong>
                      <div className="flex flex-wrap gap-1.5 justify-content-start text-micro">
                        {p.options?.map((opt) => {
                          const isCorrect = opt.isCorrect || p.correctAnswer === opt.id;
                          return (
                            <span
                              key={opt.id}
                              className={`px-2.5 py-1 rounded-md border text-center ${
                                isCorrect && showCorrectAnswers
                                  ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/30 text-[var(--color-success)] font-bold font-mono'
                                  : 'glx border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
                              }`}
                            >
                              {opt.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
