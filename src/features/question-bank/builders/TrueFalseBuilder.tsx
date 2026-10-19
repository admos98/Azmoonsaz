/**
 * True/False answer-key builder — true_false picker. * Extracted verbatim from the page (de-indented one level); JSX logic untouched. *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import type {QuestionType} from '../../../types';

export type TrueFalseProps = {
  formType: QuestionType;
  formCorrectTrueFalse: boolean;
  setFormCorrectTrueFalse: React.Dispatch<React.SetStateAction<boolean>>;
};

export function TrueFalseBuilder({
  formType, formCorrectTrueFalse, setFormCorrectTrueFalse,
}: TrueFalseProps) {
  return (
    <>
        {/* True / False picker builder */}
        {formType === 'true_false' && (
          <div className="relative pane p-4 rounded-xl space-y-2">
            <span className="text-[var(--color-text-secondary)] text-micro block">
              انتخاب گزینه پاسخ درست:
            </span>
            <div className="flex gap-4">
              <label
                className={`flex-1 p-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                  formCorrectTrueFalse === true
                    ? 'btn-glass btn-glass--success'
                    : 'btn-glass btn-glass--bare'
                }`}
              >
                <input
                  type="radio"
                  name="drawer-tf-key"
                  checked={formCorrectTrueFalse === true}
                  onChange={() => setFormCorrectTrueFalse(true)}
                  className="hidden"
                />
                <span>صحیح / درست</span>
              </label>

              <label
                className={`flex-1 p-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                  formCorrectTrueFalse === false
                    ? 'btn-glass btn-glass--success'
                    : 'btn-glass btn-glass--bare'
                }`}
              >
                <input
                  type="radio"
                  name="drawer-tf-key"
                  checked={formCorrectTrueFalse === false}
                  onChange={() => setFormCorrectTrueFalse(false)}
                  className="hidden"
                />
                <span>غلط / نادرست</span>
              </label>
            </div>
          </div>
        )}

    </>
  );
}
