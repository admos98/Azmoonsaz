/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Drawer open/save orchestration for the question bank: drawerMode,
 * activeQuestionId, openCreateDrawer, openEditDrawer, handleSaveQuestion.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx — the form bundle
 * produced by useQuestionForm is threaded in as-is and destructured to the
 * same identifiers the page previously closed over.
 */
import React, { useState, type Dispatch, type SetStateAction } from 'react';
import { Question } from '../../types';
import { questionService } from '../../services/api';
import { type SaveState } from '../../components/SaveStatusIndicator';
import type { useTeacherCollections } from '../../contexts/TeacherContext';
import type { useQuestionForm } from './useQuestionForm';
import type { RichQuestion } from './types';

type QuestionFormApi = ReturnType<typeof useQuestionForm>;
type UpsertQuestion = ReturnType<typeof useTeacherCollections>['upsertQuestion'];

export function useQuestionEditor(args: {
  form: QuestionFormApi;
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    action?: { label: string; onClick: () => void },
  ) => void;
  upsertQuestion: UpsertQuestion;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  setLastSavedAt: Dispatch<SetStateAction<Date | null>>;
  setPreviewReady: Dispatch<SetStateAction<boolean>>;
  setShowAddEditDrawer: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    formGrade, setFormGrade,
    formSubject, setFormSubject,
    formSection, setFormSection,
    formType, setFormType,
    formDifficulty, setFormDifficulty,
    formPoints, setFormPoints,
    formText, setFormText,
    formTitle, setFormTitle,
    formTagsString, setFormTagsString,
    formExplanation, setFormExplanation,
    formSampleAnswer, setFormSampleAnswer,
    formImageUrl, setFormImageUrl,
    formOptions, setFormOptions,
    formCorrectTrueFalse, setFormCorrectTrueFalse,
    formFillBlanks, setFormFillBlanks,
    formMatchingPairs, setFormMatchingPairs,
    formOrderingItems, setFormOrderingItems,
    formRubrics, setFormRubrics,
    formParts, setFormParts,
    resetFormValues,
  } = args.form;
  const {
    showToast,
    upsertQuestion,
    setSaveState,
    setLastSavedAt,
    setPreviewReady,
    setShowAddEditDrawer,
  } = args;

  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Create Question Trigger
  const openCreateDrawer = () => {
    setDrawerMode('add');
    resetFormValues();
    setPreviewReady(false);
    setShowAddEditDrawer(true);
  };

  // Edit Question Drawer loader
  const openEditDrawer = (q: RichQuestion) => {
    setDrawerMode('edit');
    setActiveQuestionId(q.id);
    setFormGrade(q.grade);
    setFormSubject(q.category);
    setFormSection(q.section || 'فصل اول');
    setFormType(q.type);
    setFormDifficulty(q.difficulty || 'medium');
    setFormPoints(q.points);
    setFormText(q.text);
    setFormTitle(q.title);
    setFormTagsString(q.tags?.join(', ') || '');
    setFormExplanation(q.explanation || '');
    setFormSampleAnswer(q.sampleAnswer || '');
    setFormImageUrl(q.imageUrl || '');

    // Type specifics
    if (q.options) {
      setFormOptions(
        q.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: !!o.isCorrect,
          imageUrl: o.imageUrl || '',
        })),
      );
    }
    if (q.type === 'true_false') {
      setFormCorrectTrueFalse(q.correctAnswer === true);
    }
    if (q.correctFillBlanks) {
      setFormFillBlanks(q.correctFillBlanks);
    }
    if (q.matchingPairs) {
      setFormMatchingPairs(q.matchingPairs);
    }
    if (q.orderingItems) {
      setFormOrderingItems(q.orderingItems);
    }
    if (q.rubrics) {
      setFormRubrics(q.rubrics);
    }
    if (q.parts) {
      setFormParts(q.parts);
    }

    setPreviewReady(false);
    setShowAddEditDrawer(true);
  };

  // Handle Submit Form (Add or Edit)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formText) {
      showToast('عنوان و متن اصلی سوال الزامی است.', 'warning');
      return;
    }

    // Standardize tags in string separation
    const parsedTags = formTagsString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Build the dynamic correctAnswer key based on type chosen
    let resolvedCorrectAnswer: Question['correctAnswer'] | undefined = undefined;
    if (formType === 'true_false') {
      resolvedCorrectAnswer = formCorrectTrueFalse;
    } else if (formType === 'single_choice' || formType === 'image_based') {
      const correctOpt = formOptions.find((o) => o.isCorrect);
      resolvedCorrectAnswer = correctOpt ? correctOpt.id : formOptions[0]?.id || 'o1';
    } else if (formType === 'multiple_choice') {
      resolvedCorrectAnswer = formOptions.filter((o) => o.isCorrect).map((o) => o.id);
    }

    const modifiedQuestionPayload: Omit<Question, 'id' | 'createdAt'> &
      Pick<RichQuestion, 'explanation' | 'sampleAnswer'> = {
      title: formTitle,
      text: formText,
      type: formType,
      points: Number(formPoints),
      category: formSubject,
      grade: formGrade,
      // metadata that must survive reload — server persists these in body
      // (questionToBody) / answer_key (deriveAnswerKey)
      difficulty: formDifficulty,
      section: formSection || undefined,
      tags: parsedTags,
      completenessStatus: 'complete',
      explanation: formExplanation || undefined,
      sampleAnswer: formType === 'long_answer' ? formSampleAnswer || undefined : undefined,
      imageUrl: formImageUrl || undefined,
      options:
        formType === 'single_choice' || formType === 'multiple_choice' || formType === 'image_based'
          ? formOptions
          : undefined,
      correctAnswer: resolvedCorrectAnswer,
      correctFillBlanks: formType === 'fill_blank' ? formFillBlanks : undefined,
      matchingPairs: formType === 'matching' ? formMatchingPairs : undefined,
      orderingItems: formType === 'ordering' ? formOrderingItems : undefined,
      rubrics: formType === 'long_answer' ? formRubrics : undefined,
      parts: formType === 'cloze' || formType === 'reading_comprehension' ? formParts : undefined,
    };

    setSaveState('saving');
    try {
      if (drawerMode === 'add') {
        // server response now carries difficulty/section/tags/explanation —
        // no client-side enrichment overlay anymore
        const created = await questionService.createQuestion(modifiedQuestionPayload);
        upsertQuestion(created);
      } else {
        if (!activeQuestionId) return;
        const updated = await questionService.updateQuestion(
          activeQuestionId,
          modifiedQuestionPayload,
        );
        upsertQuestion(updated);
      }
      const savedAt = new Date();
      setLastSavedAt(savedAt);
      setSaveState('saved');
      showToast(
        drawerMode === 'add' ? 'سؤال جدید به بانک اضافه شد.' : 'تغییرات سؤال ذخیره شد.',
        'success',
      );
      setShowAddEditDrawer(false);
    } catch (_err) {
      setSaveState('failed');
      showToast('سؤال ذخیره نشد؛ اطلاعات واردشده حفظ شده است.', 'error');
    }
  };

  return { drawerMode, activeQuestionId, openCreateDrawer, openEditDrawer, handleSaveQuestion };
}
