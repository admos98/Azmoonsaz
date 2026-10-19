/**
 * Long-answer rubric builder — sample answer + rubric rows for long_answer. * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {Info} from 'lucide-react';
import {Textarea, TextLink} from '../../../ui';
import type {Question, QuestionType} from '../../../types';

export type LongAnswerProps = {
  formType: QuestionType;
  formSampleAnswer: string;
  setFormSampleAnswer: React.Dispatch<React.SetStateAction<string>>;
  formRubrics: NonNullable<Question['rubrics']>;
  setFormRubrics: React.Dispatch<React.SetStateAction<NonNullable<Question['rubrics']>>>;
  addRubricRow: () => void;
  removeRubricRow: (id: string) => void;
};

export function LongAnswerBuilder({
  formType, formSampleAnswer, setFormSampleAnswer, formRubrics, setFormRubrics,
  addRubricRow, removeRubricRow,
}: LongAnswerProps) {
  return (
    <>
        {/* Descriptive elements, criteria & rubrics (Long Answer) */}
        {formType === 'long_answer' && (
          <div className="space-y-4">
            {/* Sample answer */}
            <Textarea
              label="پاسخ تشریحی استاندارد نمونه (برای تصحیح و مقایسه هوشمند):"
              size="sm"
              rows={3}
              value={formSampleAnswer}
              onChange={(e) => setFormSampleAnswer(e.target.value)}
              placeholder="نمونه پاسخ ایده‌آل بنویسید..."
            />

            {/* Rubric Criteria dynamic builder */}
            <div className="bg-[var(--color-danger-soft)]/40/50 p-4 rounded-2xl border border-[var(--color-danger)]/10 space-y-3">
              <div className="flex justify-between items-center border-b border-[var(--color-danger)]/10 pb-2">
                <span className="text-[var(--color-danger)] text-micro">
                  معیارهای خرد بارم‌بندی پاسخ تشریحی (Rubrics Builder)
                </span>
                <button
                  type="button"
                  onClick={addRubricRow}
                  className="px-3 py-1 btn-glass btn-glass--danger rounded-lg text-micro transition-all cursor-pointer"
                >
                  + معیار جدید
                </button>
              </div>

              <div className="space-y-2">
                {formRubrics.map((rub) => (
                  <div
                    key={rub.id}
                    className="pane p-3 rounded-xl border-[var(--color-danger)]/10 space-y-2 relative"
                  >
                    <TextLink
                      tone="danger"
                      bold
                      hover="none"
                      onClick={() => removeRubricRow(rub.id)}
                      className="absolute top-2 left-2 text-label"
                    >
                      &times;
                    </TextLink>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <span className="text-micro text-[var(--color-text-tertiary)] block">
                          عنوان معیار:
                        </span>
                        <input
                          type="text"
                          required
                          value={rub.title}
                          onChange={(e) => {
                            const updated = formRubrics.map((r) =>
                              r.id === rub.id ? { ...r, title: e.target.value } : r,
                            );
                            setFormRubrics(updated);
                          }}
                          className="w-full glx field px-2 py-1 rounded text-micro"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-micro text-[var(--color-text-tertiary)] block">
                          سقف نمره:
                        </span>
                        <input
                          type="number"
                          required
                          step={0.25}
                          value={rub.maxPoints}
                          onChange={(e) => {
                            const updated = formRubrics.map((r) =>
                              r.id === rub.id ? { ...r, maxPoints: Number(e.target.value) } : r,
                            );
                            setFormRubrics(updated);
                          }}
                          className="w-full glx field p-1 text-center rounded text-micro"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-micro text-[var(--color-text-tertiary)] block">
                        توضیح ملاک نمره‌دهی:
                      </span>
                      <input
                        type="text"
                        value={rub.description}
                        onChange={(e) => {
                          const updated = formRubrics.map((r) =>
                            r.id === rub.id ? { ...r, description: e.target.value } : r,
                          );
                          setFormRubrics(updated);
                        }}
                        placeholder="ملاک نیم‌نمره چیست..."
                        className="w-full glx field px-2 py-1 rounded text-micro text-[var(--color-text-secondary)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manual correct warning representation in drawer */}
            <div className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20.5 rounded-xl p-3 text-micro text-[var(--color-warning)]/80 flex items-start gap-1.5 leading-relaxed">
              <Info className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
              <div>
                <strong>توجه تصحیح آزمون:</strong>
                <p>
                  تصحیح سوالات تشریحی به صورت دستی انجام می‌شود. در آینده می‌توان پیشنهاد نمره
                  با هوش مصنوعی اضافه کرد.
                </p>
              </div>
            </div>
          </div>
        )}

    </>
  );
}
