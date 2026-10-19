/**
 * Fill-blank answer-key builder — fill_blank answers editor. * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {TextLink} from '../../../ui';
import type {QuestionType} from '../../../types';
import type {} from './types';

export type FillBlankProps = {
  formType: QuestionType;
  formFillBlanks: string[];
  setFormFillBlanks: React.Dispatch<React.SetStateAction<string[]>>;
};

export function FillBlankBuilder({
  formType, formFillBlanks, setFormFillBlanks,
}: FillBlankProps) {
  return (
    <>
        {/* Fill blank builder */}
        {formType === 'fill_blank' && (
          <div className="relative pane p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center mb-1 pane p-2 rounded-lg">
              <strong className="text-[var(--color-text-primary)] text-micro">
                کلید واژه‌های صحیح برای جاهای خالی:
              </strong>
              <button
                type="button"
                onClick={() => setFormFillBlanks([...formFillBlanks, ''])}
                className="px-2 py-0.5 btn-glass btn-glass--primary rounded text-micro"
              >
                + الحاق محل جدید
              </button>
            </div>

            <div className="space-y-2">
              {formFillBlanks.map((fb, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-label-muted w-12 shrink-0">
                    جای خالی {idx + 1}:
                  </span>
                  <input
                    type="text"
                    required
                    value={fb}
                    onChange={(e) => {
                      const updated = [...formFillBlanks];
                      updated[idx] = e.target.value;
                      setFormFillBlanks(updated);
                    }}
                    placeholder="کلمه کلید صحیح"
                    className="w-full glx field border px-2.5 py-1.5 rounded-md text-micro"
                  />
                  {formFillBlanks.length > 1 && (
                    <TextLink
                      tone="danger"
                      bold
                      hover="none"
                      onClick={() =>
                        setFormFillBlanks(formFillBlanks.filter((_, i) => i !== idx))
                      }
                      className="p-1 text-label"
                    >
                      &times;
                    </TextLink>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

    </>
  );
}
