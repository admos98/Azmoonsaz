/**
 * Matching answer-key builder — matching pairs editor. * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {IconButton} from '../../../ui';
import type {Question, QuestionType} from '../../../types';

export type MatchingProps = {
  formType: QuestionType;
  formMatchingPairs: NonNullable<Question['matchingPairs']>;
  setFormMatchingPairs: React.Dispatch<React.SetStateAction<NonNullable<Question['matchingPairs']>>>;
};

export function MatchingBuilder({
  formType, formMatchingPairs, setFormMatchingPairs,
}: MatchingProps) {
  return (
    <>
        {/* Matching matchingPairs builder */}
        {formType === 'matching' && (
          <div className="pane p-4.5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-[var(--color-text-primary)] text-micro">
                پلاس لغات تطبیقی وصل‌کردنی
              </span>
              <button
                type="button"
                onClick={() =>
                  setFormMatchingPairs([...formMatchingPairs, { left: '', right: '' }])
                }
                className="px-2.5 py-1 btn-glass btn-glass--primary rounded-lg text-micro cursor-pointer"
              >
                + درج جفت جدید
              </button>
            </div>

            <div className="space-y-3">
              {formMatchingPairs.map((pair, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3 pane p-3 rounded-xl relative">
                  <IconButton
                    label="حذف این جفت"
                    radius="full"
                    tone="danger"
                    surface="none"
                    motion={false}
                    onClick={() =>
                      setFormMatchingPairs(formMatchingPairs.filter((_, i) => i !== idx))
                    }
                    className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[var(--color-danger-soft)]/40 font-bold flex items-center justify-center"
                  >
                    &times;
                  </IconButton>
                  <div className="space-y-1">
                    <span className="text-micro text-[var(--color-text-tertiary)] block">
                      سطر چپ (هدف):
                    </span>
                    <input
                      type="text"
                      required
                      value={pair.left}
                      onChange={(e) => {
                        const updated = [...formMatchingPairs];
                        updated[idx].left = e.target.value;
                        setFormMatchingPairs(updated);
                      }}
                      className="w-full glx field px-2 py-1.5 rounded-md"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-micro text-[var(--color-text-tertiary)] block">
                      سطر راست (مبدا):
                    </span>
                    <input
                      type="text"
                      required
                      value={pair.right}
                      onChange={(e) => {
                        const updated = [...formMatchingPairs];
                        updated[idx].right = e.target.value;
                        setFormMatchingPairs(updated);
                      }}
                      className="w-full glx field px-2 py-1.5 rounded-md"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

    </>
  );
}
