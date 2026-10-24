/**
 * Parts (cloze/reading) builder — cloze / reading-comprehension part rows. * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {TextLink} from '../../../ui';
import {ResolvedImage} from '../../../components/QuestionImage';
import type {Question, QuestionType} from '../../../types';
import type {ImageUploadEvent} from './types';

// CQ-1 (strict) fix: the hook always provides an array (useState initializer),
// so the builder takes the NonNullable form — the old `Question['parts']`
// (array | undefined) leaked nullability into every row callback.
export type PartsProps = {
  formType: QuestionType;
  formParts: NonNullable<Question['parts']>;
  setFormParts: React.Dispatch<React.SetStateAction<NonNullable<Question['parts']>>>;
  addPartRow: () => void;
  removePartRow: (index: number) => void;
  handleImageUpload: (e: ImageUploadEvent, target: 'main' | { optIndex: number } | { partIndex: number }) => void;
};

export function PartsBuilder({
  formType, formParts, setFormParts, addPartRow, removePartRow, handleImageUpload,
}: PartsProps) {
  return (
    <>
        {/* Reading comprehension & Cloze parts dynamic details */}
        {(formType === 'reading_comprehension' || formType === 'cloze') && (
          <div className="pane p-4.5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-[var(--color-text-primary)] text-micro">
                بخش‌ها و زیرسوالات تابعه ({formParts.length} مینی‌سوال)
              </span>
              <button
                type="button"
                onClick={addPartRow}
                className="px-2.5 py-1 btn-glass btn-glass--primary rounded text-micro"
              >
                + افزودن زیرسوال تابعه
              </button>
            </div>

            <div className="space-y-3">
              {formParts.map((part, idx) => (
                <div key={part.id} className="pane p-3 rounded-xl relative space-y-2">
                  <TextLink
                    tone="danger"
                    bold
                    hover="none"
                    onClick={() => removePartRow(idx)}
                    className="absolute top-2 left-2"
                  >
                    &times;
                  </TextLink>
                  <span className="glx-inset rounded px-1.5 py-0.5 text-micro text-[var(--color-text-secondary)] block w-20 text-center">
                    بخش شماره {idx + 1}
                  </span>

                  <div className="space-y-1">
                    <span className="text-micro text-[var(--color-text-tertiary)] block">
                      صورت مینی‌سوال:
                    </span>
                    <input
                      type="text"
                      required
                      value={part.text}
                      onChange={(e) => {
                        const updated = [...formParts];
                        // FE-9 fix: immutable element replacement.
                        updated[idx] = { ...updated[idx], text: e.target.value };
                        setFormParts(updated);
                      }}
                      className="w-full glx field px-2 py-1 rounded text-micro"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-micro text-[var(--color-text-tertiary)] block">
                      پاسخ صحیح مینی سوال:
                    </span>
                    <input
                      type="text"
                      required
                      value={String(part.correctAnswer || '')}
                      onChange={(e) => {
                        const updated = [...formParts];
                        // FE-9 fix: immutable element replacement.
                        updated[idx] = { ...updated[idx], correctAnswer: e.target.value };
                        setFormParts(updated);
                      }}
                      placeholder="گزینه یا عبارت کلید مینی‌سوال"
                      className="w-full glx field px-2 py-1 rounded text-micro font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-micro text-[var(--color-text-tertiary)] block">
                      تصویر مینی‌سوال (اختیاری):
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="px-2 py-1 btn-glass btn-glass--quiet border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] rounded-md text-micro cursor-pointer shrink-0">
                        <span>الحاق تصویر</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, { partIndex: idx })}
                        />
                      </label>
                      {part.imageUrl ? (
                        <div className="flex items-center gap-1.5">
                          <ResolvedImage
                            value={part.imageUrl}
                            alt="مینی‌سوال"
                            imgClassName="w-6 h-6 rounded object-cover border"
                          />
                          <TextLink
                            size="sm"
                            tone="danger"
                            hover="none"
                            onClick={() => {
                              const updated = [...formParts];
                              updated[idx] = { ...updated[idx], imageUrl: undefined };
                              setFormParts(updated);
                            }}
                          >
                            حذف
                          </TextLink>
                        </div>
                      ) : (
                        <span className="text-micro text-[var(--color-text-tertiary)] italic">
                          عکسی نیست
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </>
  );
}
