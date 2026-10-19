/**
 * QuestionTypeBuilders — dispatcher over the type-specific builder families.
 * The page mounts this once inside the answer-key drawer; each family lives
 * in its own file and receives the useQuestionForm values it needs. The
 * conditioning (which family renders for which type) lives INSIDE each
 * family builder — this layer only forwards props, so no knowledge of the
 * type taxonomy leaks here.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import type { Question } from '../../../types';
import type { FormOption, ImageUploadEvent } from './types';
import { ChoiceBuilder } from './ChoiceBuilder';
import { TrueFalseBuilder } from './TrueFalseBuilder';
import { FillBlankBuilder } from './FillBlankBuilder';
import { MatchingBuilder } from './MatchingBuilder';
import { OrderingBuilder } from './OrderingBuilder';
import { LongAnswerBuilder } from './LongAnswerBuilder';
import { PartsBuilder } from './PartsBuilder';

export type QuestionTypeBuildersProps = {
  formType: Question['type'];
  formOptions: FormOption[];
  setFormOptions: React.Dispatch<React.SetStateAction<FormOption[]>>;
  addOptionRow: () => void;
  removeOptionRow: (index: number) => void;
  handleOptionCorrectChange: (index: number) => void;
  formCorrectTrueFalse: boolean;
  setFormCorrectTrueFalse: React.Dispatch<React.SetStateAction<boolean>>;
  formFillBlanks: string[];
  setFormFillBlanks: React.Dispatch<React.SetStateAction<string[]>>;
  formMatchingPairs: NonNullable<Question['matchingPairs']>;
  setFormMatchingPairs: React.Dispatch<React.SetStateAction<NonNullable<Question['matchingPairs']>>>;
  formOrderingItems: NonNullable<Question['orderingItems']>;
  setFormOrderingItems: React.Dispatch<React.SetStateAction<NonNullable<Question['orderingItems']>>>;
  formRubrics: NonNullable<Question['rubrics']>;
  setFormRubrics: React.Dispatch<React.SetStateAction<NonNullable<Question['rubrics']>>>;
  addRubricRow: () => void;
  removeRubricRow: (id: string) => void;
  formSampleAnswer: string;
  setFormSampleAnswer: React.Dispatch<React.SetStateAction<string>>;
  formParts: Question['parts'];
  setFormParts: React.Dispatch<React.SetStateAction<Question['parts']>>;
  addPartRow: () => void;
  removePartRow: (index: number) => void;
  handleImageUpload: (e: ImageUploadEvent, target: 'main' | { optIndex: number } | { partIndex: number }) => void;
};

export function QuestionTypeBuilders(props: QuestionTypeBuildersProps) {
  return (
    <>
      <ChoiceBuilder
        formType={props.formType}
        formOptions={props.formOptions}
        setFormOptions={props.setFormOptions}
        addOptionRow={props.addOptionRow}
        removeOptionRow={props.removeOptionRow}
        handleOptionCorrectChange={props.handleOptionCorrectChange}
        handleImageUpload={props.handleImageUpload}
      />
      <TrueFalseBuilder
        formType={props.formType}
        formCorrectTrueFalse={props.formCorrectTrueFalse}
        setFormCorrectTrueFalse={props.setFormCorrectTrueFalse}
      />
      <FillBlankBuilder
        formType={props.formType}
        formFillBlanks={props.formFillBlanks}
        setFormFillBlanks={props.setFormFillBlanks}
      />
      <MatchingBuilder
        formType={props.formType}
        formMatchingPairs={props.formMatchingPairs}
        setFormMatchingPairs={props.setFormMatchingPairs}
      />
      <OrderingBuilder
        formType={props.formType}
        formOrderingItems={props.formOrderingItems}
        setFormOrderingItems={props.setFormOrderingItems}
      />
      <LongAnswerBuilder
        formType={props.formType}
        formSampleAnswer={props.formSampleAnswer}
        setFormSampleAnswer={props.setFormSampleAnswer}
        formRubrics={props.formRubrics}
        setFormRubrics={props.setFormRubrics}
        addRubricRow={props.addRubricRow}
        removeRubricRow={props.removeRubricRow}
      />
      <PartsBuilder
        formType={props.formType}
        formParts={props.formParts}
        setFormParts={props.setFormParts}
        addPartRow={props.addPartRow}
        removePartRow={props.removePartRow}
        handleImageUpload={props.handleImageUpload}
      />
    </>
  );
}
