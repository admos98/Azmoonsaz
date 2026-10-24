/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Add/edit drawer form state for the question bank.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx — every default,
 * setter, and handler below is byte-identical to the page version. Drawer
 * open/save orchestration (openCreateDrawer, openEditDrawer,
 * handleSaveQuestion) stays in the page and consumes these setters.
 */
import React, { useEffect, useRef, useState } from 'react';
import { QuestionType, QuestionPart, RubricCriterion } from '../../types';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { uploadQuestionImageFile, ImageUploadError } from '../../services/imageStoreClient';

export function useQuestionForm(
  showAddEditDrawer: boolean,
  setShowAddEditDrawer: (v: boolean) => void,
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void,
) {
    const [formGrade, setFormGrade] = useState('هفتم');
    const [formSubject, setFormSubject] = useState('علوم تجربی');
    const [formSection, setFormSection] = useState('فصل اول');
    const [formType, setFormType] = useState<QuestionType>('single_choice');
    const [formDifficulty, setFormDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [formPoints, setFormPoints] = useState<number>(2);
    const [formText, setFormText] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formTagsString, setFormTagsString] = useState('پیش_فرض');
    const [formExplanation, setFormExplanation] = useState('');
    const [formSampleAnswer, setFormSampleAnswer] = useState('');
    const [formImageUrl, setFormImageUrl] = useState('');
  
    // Choice Options builder state
    const [formOptions, setFormOptions] = useState<
      Array<{ id: string; text: string; isCorrect: boolean; imageUrl?: string }>
    >([
      { id: 'o1', text: 'گزینه الف', isCorrect: true, imageUrl: '' },
      { id: 'o2', text: 'گزینه ب', isCorrect: false, imageUrl: '' },
      { id: 'o3', text: 'گزینه ج', isCorrect: false, imageUrl: '' },
      { id: 'o4', text: 'گزینه د', isCorrect: false, imageUrl: '' },
    ]);
  
    // True/False correct state
    const [formCorrectTrueFalse, setFormCorrectTrueFalse] = useState<boolean>(true);
  
    // Fill Blanks key words
    const [formFillBlanks, setFormFillBlanks] = useState<string[]>(['']);
  
    // Matchings pairs state
    const [formMatchingPairs, setFormMatchingPairs] = useState<
      Array<{ left: string; right: string }>
    >([{ left: 'سمت چپ ۱', right: 'سمت راست ۱' }]);
  
    // Ordering list state
    const [formOrderingItems, setFormOrderingItems] = useState<string[]>(['مرحله نخست', 'مرحله دوم']);
  
    // Rubrics Criterion checklist
    const [formRubrics, setFormRubrics] = useState<RubricCriterion[]>([
      {
        id: 'r1',
        title: 'به شیوایی مفهوم پرداخته باشد',
        description: 'نگارش بدون غلط دستوری',
        maxPoints: 1.5,
      },
    ]);
  
    // Parts / subquestions state (for Reading Comprehension & Cloze Test)
    const [formParts, setFormParts] = useState<QuestionPart[]>([
      {
        id: 'part-1',
        text: 'مینی سوال الف',
        type: 'single_choice',
        options: [
          { id: 'p1-o1', text: 'گزینه صحیح', isCorrect: true },
          { id: 'p1-o2', text: 'گزینه فرعی', isCorrect: false },
        ],
        correctAnswer: 'p1-o1',
      },
    ]);
  
    const questionFormSnapshot = JSON.stringify([
      formGrade,
      formSubject,
      formSection,
      formType,
      formDifficulty,
      formPoints,
      formText,
      formTitle,
      formTagsString,
      formExplanation,
      formSampleAnswer,
      formImageUrl,
      formOptions,
      formCorrectTrueFalse,
      formFillBlanks,
      formMatchingPairs,
      formOrderingItems,
      formRubrics,
      formParts,
    ]);
    const [savedQuestionFormSnapshot, setSavedQuestionFormSnapshot] = useState(questionFormSnapshot);
    const drawerWasOpenRef = useRef(false);
    useEffect(() => {
      if (showAddEditDrawer && !drawerWasOpenRef.current) {
        setSavedQuestionFormSnapshot(questionFormSnapshot);
      }
      drawerWasOpenRef.current = showAddEditDrawer;
    }, [showAddEditDrawer, questionFormSnapshot]);
    const { guarded: guardQuestionDraft, dialogProps: questionDraftDialog } = useUnsavedChanges(
      showAddEditDrawer && questionFormSnapshot !== savedQuestionFormSnapshot,
    );
    const closeQuestionEditor = () => guardQuestionDraft(() => setShowAddEditDrawer(false));
  
    // Image upload pipeline: shrink in browser → PUT bytes DIRECT to the
    // store (never through Vercel) → persist ONLY the opaque storage key.
    // Legacy rows load untouched (grandfathered); fresh pixels enter only
    // through this pipeline (server rejects data:/https: on save).
    const handleImageUpload = async (
      e: React.ChangeEvent<HTMLInputElement>,
      target: 'main' | { optIndex: number } | { partIndex: number },
    ) => {
      const file = e.target.files?.[0];
      // Reset so the same file can be re-chosen after an error.
      e.target.value = '';
      if (!file) return;
      try {
        const key = await uploadQuestionImageFile(file);
        if (target === 'main') {
          setFormImageUrl(key);
        } else if ('optIndex' in target) {
          const updated = [...formOptions];
          if (!updated[target.optIndex]) return;
          // FE-9 fix: replace the element instead of mutating the prior-state
          // object through the shallow array copy.
          updated[target.optIndex] = { ...updated[target.optIndex], imageUrl: key };
          setFormOptions(updated);
        } else if ('partIndex' in target) {
          const updated = [...formParts];
          if (!updated[target.partIndex]) return;
          updated[target.partIndex] = { ...updated[target.partIndex], imageUrl: key };
          setFormParts(updated);
        }
      } catch (err) {
        showToast(
          err instanceof ImageUploadError ? err.message : 'بارگذاری تصویر ممکن نشد. دوباره تلاش کنید.',
          'error',
        );
      }
    };
  
    // Quick action options modifications
    const addOptionRow = () => {
      const nextChar = formOptions.length + 1;
      setFormOptions([
        ...formOptions,
        {
          id: `o-new-${Date.now()}`,
          text: `گزینه شماره ${nextChar}`,
          isCorrect: false,
          imageUrl: '',
        },
      ]);
    };
  
    const removeOptionRow = (idx: number) => {
      if (formOptions.length <= 2) {
        showToast('سوال چندگزینه‌ای حداقل دو گزینه لازم دارد.', 'warning');
        return;
      }
      setFormOptions(formOptions.filter((_, i) => i !== idx));
    };
  
    const handleOptionCorrectChange = (index: number) => {
      if (formType === 'single_choice' || formType === 'image_based') {
        setFormOptions(
          formOptions.map((opt, i) => ({
            ...opt,
            isCorrect: i === index,
          })),
        );
      } else {
        // Multiple correct allows toggling independently
        const updated = [...formOptions];
        // FE-9 fix: immutable element replacement (was in-place mutation of
        // the previous render's option object).
        updated[index] = { ...updated[index], isCorrect: !updated[index].isCorrect };
        setFormOptions(updated);
      }
    };
  
    // Rubrics Criteria handlers
    const addRubricRow = () => {
      setFormRubrics([
        ...formRubrics,
        {
          id: `r-${Date.now()}`,
          title: 'معیار نمره‌دهی جدید',
          description: 'شرح ملاک ارزیابی دبیر',
          maxPoints: 1.0,
        },
      ]);
    };
  
    const removeRubricRow = (id: string) => {
      setFormRubrics(formRubrics.filter((r) => r.id !== id));
    };
  
    // Subquestion parts handlers
    const addPartRow = () => {
      setFormParts([
        ...formParts,
        {
          id: `part-${Date.now()}`,
          text: 'زیرسوال جدید',
          type: 'single_choice',
          options: [{ id: 'po1', text: 'گزینه اول', isCorrect: true }],
        },
      ]);
    };
  
    const removePartRow = (idx: number) => {
      setFormParts(formParts.filter((_, i) => i !== idx));
    };
  
    // Form Reset Trigger
    const resetFormValues = () => {
      setFormGrade('هفتم');
      setFormSubject('علوم تجربی');
      setFormSection('فصل اول');
      setFormType('single_choice');
      setFormDifficulty('medium');
      setFormPoints(2);
      setFormText('');
      setFormTitle('');
      setFormTagsString('کنکوری, نهایی'); // persian-ok — tags separator is Latin ',' (split/join)
      setFormExplanation('');
      setFormSampleAnswer('');
      setFormImageUrl('');
      setFormOptions([
        { id: 'o1', text: 'گزینه الف', isCorrect: true, imageUrl: '' },
        { id: 'o2', text: 'گزینه ب', isCorrect: false, imageUrl: '' },
        { id: 'o3', text: 'گزینه ج', isCorrect: false, imageUrl: '' },
        { id: 'o4', text: 'گزینه د', isCorrect: false, imageUrl: '' },
      ]);
      setFormCorrectTrueFalse(true);
      setFormFillBlanks(['']);
      setFormMatchingPairs([{ left: '', right: '' }]);
      setFormOrderingItems(['اول', 'دوم']);
      setFormRubrics([
        { id: 'r1', title: 'صحت روابط علمی', description: 'توضیح کافی معیار', maxPoints: 1.5 },
      ]);
      setFormParts([
        {
          id: 'part-1',
          text: 'زیر بهر مینی سوال',
          type: 'single_choice',
          options: [{ id: 'po1', text: 'بخش اول', isCorrect: true }],
        },
      ]);
    };

  return { formGrade, setFormGrade, formSubject, setFormSubject, formSection, setFormSection, formType, setFormType, formDifficulty, setFormDifficulty, formPoints, setFormPoints, formText, setFormText, formTitle, setFormTitle, formTagsString, setFormTagsString, formExplanation, setFormExplanation, formSampleAnswer, setFormSampleAnswer, formImageUrl, setFormImageUrl, formOptions, setFormOptions, formCorrectTrueFalse, setFormCorrectTrueFalse, formFillBlanks, setFormFillBlanks, formMatchingPairs, setFormMatchingPairs, formOrderingItems, setFormOrderingItems, formRubrics, setFormRubrics, formParts, setFormParts, questionFormSnapshot, guardQuestionDraft, questionDraftDialog, closeQuestionEditor, handleImageUpload, addOptionRow, removeOptionRow, handleOptionCorrectChange, addRubricRow, removeRubricRow, addPartRow, removePartRow, resetFormValues };
}
