/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Check, Info } from 'lucide-react';
import { Question, QuestionPart, RubricCriterion } from '../types';
import { toPersianDigits } from '../utils/persian';
import { ResolvedImage } from './QuestionImage';

/**
 * Per-type answer-key sections (2-9) of the preview renderer: true/false,
 * fill-blank, short answer, long answer (rubrics/sample/guide), matching,
 * ordering, reading comprehension and cloze — extracted verbatim from
 * QuestionRenderer, which keeps the shell, header specs, choice layouts and
 * the tags footer.
 */
export function AnswerKeySections({
  question,
  showCorrectAnswers,
}: {
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
  showCorrectAnswers: boolean;
}) {
  return (
    <>

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
                    ? 'btn-glass btn-glass--success'
                    : 'btn-glass btn-glass--bare'
                }`}
              >
                <span>{item.label}</span>
                {showCorrectAnswers && isSelected && (
                  <span className="bg-[var(--color-success-solid)] text-[var(--color-text-on-solid)] p-0.5 rounded-full">
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
                    className="glx field border border-[var(--color-success)]/20 px-3 py-1.5 rounded-lg font-mono font-bold text-[var(--color-success)]"
                  >
                    جای خالی شماره {toPersianDigits(idx + 1)}: «{ans}»
                  </span>
                ))}
              </div>
            </div>
          )}
          {!showCorrectAnswers && (
            <div className="p-4 pane rounded-xl">
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
            <div className="pane rounded-xl p-3 text-[var(--color-text-secondary)] text-micro leading-relaxed">
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
                  <div key={rub.id} className="p-3 pane border-[var(--color-danger)]/20 rounded-xl">
                    <div className="flex justify-between items-center pb-1.5 border-b border-[var(--color-danger)]/20 mb-1.5">
                      <strong className="text-[var(--color-danger)] font-bold">{rub.title}</strong>
                      <span className="bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)]/80 rounded-md px-1.5 py-0.5 text-micro">
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
              <p className="pane p-3 rounded-lg border-[var(--color-success)]/10 whitespace-pre-wrap leading-relaxed text-[var(--color-text-secondary)]">
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
        <div className="pane rounded-xl p-4 mt-3 text-caption">
          <p className="text-[var(--color-text-primary)] text-micro mb-2 border-b border-[var(--color-glass-light-stroke)] pb-1.5">
            نگاشت وصل‌کردنی صحیح:
          </p>
          <div className="space-y-2">
            {question.matchingPairs.map((pair, pIdx) => (
              <div
                key={pIdx}
                className="flex gap-2.5 items-center justify-between pane px-3 py-2 rounded-lg border-[var(--color-glass-light-stroke)]/70"
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
        <div className="pane rounded-xl p-4 mt-3 text-caption">
          <p className="font-bold text-[var(--color-accent)] mb-2.5">
            ترتیب قرارگیری پاسخ‌ها از راست به چپ:
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {question.orderingItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="glx field border text-[var(--color-text-primary)] px-3.5 py-2 font-bold rounded-xl">
                  {idx + 1}. {item}
                </span>
                {idx < (question.orderingItems?.length || 0) - 1 && (
                  <span className="text-label-muted text-[var(--color-text-secondary)]">
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
            className="bg-[var(--color-accent-soft)]/40 border border-[var(--color-accent)]/20 rounded-2xl p-4.5 space-y-3"
            id="passage-container"
          >
            <span className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] rounded-lg px-2.5 py-0.5 text-micro inline-block">
              متن درک مطلب (Passage)
            </span>
            <p className="text-caption text-[var(--color-text-primary)] leading-[1.8] font-medium pre-wrap">
              {question.text}
            </p>

            {/* Optional Passage Photo support */}
            {question.imageUrl && (
              <div className="mt-2 text-right">
                <ResolvedImage
                  value={question.imageUrl}
                  alt="پیوست درک مطلب"
                  className="rounded-xl border border-[var(--color-glass-light-stroke)] max-h-48 bg-[var(--color-surface)]"
                  imgClassName="rounded-xl border border-[var(--color-glass-light-stroke)] max-h-48 object-contain bg-[var(--color-surface)] shadow-3xs"
                />
              </div>
            )}
          </div>

          {/* Under subquestions parts listing! */}
          {question.parts && question.parts.length > 0 && (
            <div className="space-y-3 mt-4" id="comprehension-parts">
              <span className="block font-bold text-[var(--color-text-primary)] text-caption border-r-2 border-[var(--color-accent)] pr-2">
                زیرسوالات درک مطلب:
              </span>

              {question.parts.map((part: QuestionPart, idx: number) => {
                const partLetters = ['الف', 'ب', 'پ', 'ت', 'ث'];
                return (
                  <div key={part.id} className="pane rounded-xl p-4 space-y-3">
                    {/* Subquestion prompt */}
                    <div className="flex items-start justify-between gap-2.5">
                      <h6 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                        <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] w-5 h-5 rounded-full flex items-center justify-center text-micro">
                          {partLetters[idx] || toPersianDigits(idx + 1)}
                        </span>
                        <span>{part.text}</span>
                      </h6>
                      {part.correctAnswer && showCorrectAnswers && (
                        <span className="bg-[var(--color-success-soft)] text-[var(--color-success)] text-micro px-2.5 py-0.5 rounded-full border border-[var(--color-success)]/10">
                          کلید: {String(part.correctAnswer)}
                        </span>
                      )}
                    </div>

                    {/* Part image if any exists */}
                    {part.imageUrl && (
                      <div className="mr-5">
                        <ResolvedImage
                          value={part.imageUrl}
                          alt="پیوست مینی‌سوال"
                          className="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 bg-[var(--color-surface)]"
                          imgClassName="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 object-contain bg-[var(--color-surface)]"
                        />
                      </div>
                    )}

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
                                  ? 'btn-glass btn-glass--success font-bold'
                                  : 'btn-glass btn-glass--bare'
                              }`}
                            >
                              {oIdx + 1}. {opt.text}
                              {opt.imageUrl && (
                                <div className="mt-1.5">
                                  <ResolvedImage
                                    value={opt.imageUrl}
                                    alt={`تصویر گزینه ${oIdx + 1}`}
                                    className="rounded-md border border-[var(--color-glass-light-stroke)] max-h-24 bg-[var(--color-surface)]"
                                    imgClassName="rounded-md border border-[var(--color-glass-light-stroke)] max-h-24 object-contain bg-[var(--color-surface)]"
                                  />
                                </div>
                              )}
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
            className="bg-[var(--color-info-soft)]/30 border border-[var(--color-info)]/20 p-4.5 rounded-2xl text-caption text-[var(--color-text-primary)] leading-[1.8]"
            id="cloze-passage"
          >
            <span className="bg-[var(--color-info-soft)]/80 text-[var(--color-text-on-solid)] rounded-lg px-2 py-0.5 text-micro mb-3 inline-block">
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
                    <div key={p.id} className="p-3 pane rounded-xl space-y-2">
                      <strong className="text-[var(--color-info)] text-micro block text-right">
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
                                  ? 'btn-glass btn-glass--success font-bold font-mono'
                                  : 'btn-glass btn-glass--bare'
                              }`}
                            >
                              {opt.text}
                              {opt.imageUrl && (
                                <span className="block mt-1">
                                  <ResolvedImage
                                    value={opt.imageUrl}
                                    alt="تصویر گزینه"
                                    className="rounded-md border border-[var(--color-glass-light-stroke)] max-h-20 bg-[var(--color-surface)]"
                                    imgClassName="rounded-md border border-[var(--color-glass-light-stroke)] max-h-20 object-contain bg-[var(--color-surface)]"
                                  />
                                </span>
                              )}
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

    </>
  );
}
