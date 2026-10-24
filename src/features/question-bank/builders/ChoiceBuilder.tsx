/**
 * Choice answer-key builder — choice-family options editor (single_choice, multiple_choice, image_based). * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {Trash} from 'lucide-react';
import {IconButton, TextLink} from '../../../ui';
import {ResolvedImage} from '../../../components/QuestionImage';
import {toPersianDigits} from '../../../utils/persian';
import type {QuestionType} from '../../../types';
import type {FormOption, ImageUploadEvent} from './types';

export type ChoiceProps = {
  formType: QuestionType;
  formOptions: FormOption[];
  setFormOptions: React.Dispatch<React.SetStateAction<FormOption[]>>;
  addOptionRow: () => void;
  removeOptionRow: (index: number) => void;
  handleOptionCorrectChange: (index: number) => void;
  handleImageUpload: (e: ImageUploadEvent, target: 'main' | { optIndex: number } | { partIndex: number }) => void;
};

export function ChoiceBuilder({
  formType, formOptions, setFormOptions, addOptionRow, removeOptionRow,
  handleOptionCorrectChange, handleImageUpload,
}: ChoiceProps) {
  return (
    <>
        {/* Choice builder (single_choice, multiple_choice, image_based) */}
        {(formType === 'single_choice' ||
          formType === 'multiple_choice' ||
          formType === 'image_based') && (
          <div className="pane p-4.5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--color-glass-light-stroke)] pb-2 mb-1">
              <span className="text-[var(--color-text-primary)] text-micro">
                سازنده گزینه‌های آزمون (تعداد کلید گزینه‌ها)
              </span>
              <button
                type="button"
                onClick={addOptionRow}
                className="px-2.5 py-1 btn-glass btn-glass--primary rounded-lg text-micro cursor-pointer"
              >
                + افزودن گزینه نو
              </button>
            </div>

            <div className="space-y-3">
              {formOptions.map((opt, oIdx) => (
                <div key={opt.id} className="pane p-3 rounded-xl space-y-2 text-right">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Is correct tick check */}
                    <label className="flex items-center gap-1 text-micro text-[var(--color-text-secondary)] cursor-pointer">
                      <input
                        type={formType === 'multiple_choice' ? 'checkbox' : 'radio'}
                        name="drawer-opt-correct"
                        checked={opt.isCorrect}
                        onChange={() => handleOptionCorrectChange(oIdx)}
                        className="w-4 h-4 text-[var(--color-success)] border-[var(--color-glass-light-stroke)] cursor-pointer accent-[var(--color-success)]"
                      />
                      <span
                        className={
                          opt.isCorrect ? 'text-[var(--color-success)] font-black' : ''
                        }
                      >
                        پاسخ صحیح
                      </span>
                    </label>

                    {/* Remove opt */}
                    <IconButton
                      label={`حذف گزینه شماره ${toPersianDigits(oIdx + 1)}`}
                      title="حذف گزینه"
                      size="xs"
                      radius="lg"
                      tone="danger"
                      surface="wash"
                      motion={false}
                      onClick={() => removeOptionRow(oIdx)}
                      className="mr-auto"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Option text */}
                    <div className="space-y-1">
                      <span className="text-micro text-[var(--color-text-tertiary)] block">
                        متن گزینه:
                      </span>
                      <input
                        type="text"
                        required
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...formOptions];
                          // FE-9 fix: immutable element replacement.
                          updated[oIdx] = { ...updated[oIdx], text: e.target.value };
                          setFormOptions(updated);
                        }}
                        placeholder={`عبارت گزینه ${oIdx + 1}`}
                        className="w-full glx field border px-3.5 py-1.5 rounded-lg text-micro"
                      />
                    </div>

                    {/* Option image */}
                    <div className="space-y-1">
                      <span className="text-micro text-[var(--color-text-tertiary)] block">
                        پیوست عکس گزینه (الزامی برای سوال تصویری):
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="px-2 py-1 btn-glass btn-glass--quiet border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] rounded-md text-micro cursor-pointer shrink-0">
                          <span>الحاق تصویر</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, { optIndex: oIdx })}
                          />
                        </label>
                        {opt.imageUrl ? (
                          <div className="flex items-center gap-1.5">
                            <ResolvedImage
                              value={opt.imageUrl}
                              alt="گزینه"
                              imgClassName="w-6 h-6 rounded object-cover border"
                            />
                            <TextLink
                              size="sm"
                              tone="danger"
                              hover="none"
                              onClick={() => {
                                const updated = [...formOptions];
                                // FE-9 fix: immutable element replacement.
                                updated[oIdx] = { ...updated[oIdx], imageUrl: '' };
                                setFormOptions(updated);
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
                </div>
              ))}
            </div>
          </div>
        )}

    </>
  );
}
