/**
 * Ordering answer-key builder — ordering items editor. * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {TextLink} from '../../../ui';
import type {Question, QuestionType} from '../../../types';

export type OrderingProps = {
  formType: QuestionType;
  formOrderingItems: NonNullable<Question['orderingItems']>;
  setFormOrderingItems: React.Dispatch<React.SetStateAction<NonNullable<Question['orderingItems']>>>;
};

export function OrderingBuilder({
  formType, formOrderingItems, setFormOrderingItems,
}: OrderingProps) {
  return (
    <>
        {/* Ordering lists builder */}
        {formType === 'ordering' && (
          <div className="relative pane p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-micro text-[var(--color-text-primary)]">
                سازنده ترتیب قرارگیری گام‌ها (قدیم به جدید)
              </span>
              <button
                type="button"
                onClick={() => setFormOrderingItems([...formOrderingItems, ''])}
                className="px-2 py-0.5 btn-glass btn-glass--primary rounded text-micro"
              >
                + گام جدید
              </button>
            </div>

            <div className="space-y-2">
              {formOrderingItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center pane p-2 rounded-lg">
                  <span className="text-label-muted w-12 shrink-0">
                    رتبه {idx + 1}:
                  </span>
                  <input
                    type="text"
                    required
                    value={item}
                    onChange={(e) => {
                      const updated = [...formOrderingItems];
                      updated[idx] = e.target.value;
                      setFormOrderingItems(updated);
                    }}
                    className="w-full glx field px-2 py-1.5 rounded-md text-micro"
                  />
                  {formOrderingItems.length > 2 && (
                    <TextLink
                      tone="danger"
                      bold
                      hover="none"
                      onClick={() =>
                        setFormOrderingItems(formOrderingItems.filter((_, i) => i !== idx))
                      }
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
