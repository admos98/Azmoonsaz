/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Edit-drawer row controls for the exam preview editor.
 *
 * Extracted verbatim from src/pages/teacher/ExamPreview.tsx. Pure
 * option/parts/rubric row operations on the drawer's editingQuestion —
 * the page keeps the drawer state itself and passes value + setter.
 */
import { Question, QuestionOption, QuestionPart, RubricCriterion } from '../../types';
import { toPersianDigits } from '../../utils/persian';

export function usePreviewDrawerHandlers(
  editingQuestion: Partial<Question> | null,
  setEditingQuestion: (q: Partial<Question> | null) => void,
) {
    // Option row controls in edit question drawer
    const updateOptionTextInDrawer = (optId: string, text: string) => {
      if (!editingQuestion || !editingQuestion.options) return;
      const nextOpts = editingQuestion.options.map((o) => (o.id === optId ? { ...o, text } : o));
      setEditingQuestion({ ...editingQuestion, options: nextOpts });
    };
  
    const toggleOptionCorrectInDrawer = (optId: string) => {
      if (!editingQuestion || !editingQuestion.options) return;
      const isSingle = ['single_choice', 'image_based'].includes(editingQuestion.type || '');
  
      let nextOpts: QuestionOption[];
      if (isSingle) {
        nextOpts = editingQuestion.options.map((o) => ({
          ...o,
          isCorrect: o.id === optId,
        }));
        setEditingQuestion({
          ...editingQuestion,
          options: nextOpts,
          correctAnswer: optId,
        });
      } else {
        nextOpts = editingQuestion.options.map((o) =>
          o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o,
        );
        const multipleCorrectKeys = nextOpts.filter((o) => o.isCorrect).map((o) => o.id);
        setEditingQuestion({
          ...editingQuestion,
          options: nextOpts,
          correctAnswer: multipleCorrectKeys,
        });
      }
    };
  
    const addNewOptionInDrawer = () => {
      if (!editingQuestion) return;
      const currentOpts = editingQuestion.options || [];
      const newOptId = `o-rand-${Date.now()}`;
      const nextOpts: QuestionOption[] = [
        ...currentOpts,
        {
          id: newOptId,
          text: `گزینه تستی شماره ${toPersianDigits(currentOpts.length + 1)}`,
          isCorrect: false,
        },
      ];
      setEditingQuestion({ ...editingQuestion, options: nextOpts });
    };
  
    const removeOptionInDrawer = (optId: string) => {
      if (!editingQuestion || !editingQuestion.options) return;
      const nextOpts = editingQuestion.options.filter((o) => o.id !== optId);
      setEditingQuestion({ ...editingQuestion, options: nextOpts });
    };
  
    // Subquestions parts control list inside drawer
    const addNewSubquestionPartInDrawer = () => {
      if (!editingQuestion) return;
      const currentParts = editingQuestion.parts || [];
      const newPart: QuestionPart = {
        id: `p-part-${Date.now()}`,
        text: 'زیرسوال درک مطلب جدید',
        type: 'single_choice',
        options: [
          { id: 'po1', text: 'گزینه الف زیرسوال', isCorrect: true },
          { id: 'po2', text: 'گزینه ب زیرسوال', isCorrect: false },
        ],
        correctAnswer: 'po1',
      };
      setEditingQuestion({
        ...editingQuestion,
        parts: [...currentParts, newPart],
      });
    };
  
    const removeSubquestionPartInDrawer = (partId: string) => {
      if (!editingQuestion || !editingQuestion.parts) return;
      setEditingQuestion({
        ...editingQuestion,
        parts: editingQuestion.parts.filter((p) => p.id !== partId),
      });
    };
  
    const updateSubquestionTextInDrawer = (partId: string, text: string) => {
      if (!editingQuestion || !editingQuestion.parts) return;
      setEditingQuestion({
        ...editingQuestion,
        parts: editingQuestion.parts.map((p) => (p.id === partId ? { ...p, text } : p)),
      });
    };
  
    // Rubrics Criterion checklist inside edit drawer (for Descriptive long_answer)
    const addNewRubricInDrawer = () => {
      if (!editingQuestion) return;
      const currentRubrics = editingQuestion.rubrics || [];
      const newRubric: RubricCriterion = {
        id: `rub-${Date.now()}`,
        title: 'معیار ارزیابی علمی',
        description: 'شرح نحوه تصحیح و تخصیص بارم این معیار',
        maxPoints: 1.0,
      };
      setEditingQuestion({
        ...editingQuestion,
        rubrics: [...currentRubrics, newRubric],
      });
    };
  
    const removeRubricInDrawer = (rubId: string) => {
      if (!editingQuestion || !editingQuestion.rubrics) return;
      setEditingQuestion({
        ...editingQuestion,
        rubrics: editingQuestion.rubrics.filter((r) => r.id !== rubId),
      });
    };
  
    const updateRubricInDrawer = (rubId: string, fields: Partial<RubricCriterion>) => {
      if (!editingQuestion || !editingQuestion.rubrics) return;
      setEditingQuestion({
        ...editingQuestion,
        rubrics: editingQuestion.rubrics.map((r) => (r.id === rubId ? { ...r, ...fields } : r)),
      });
    };

  return {
    updateOptionTextInDrawer,
    toggleOptionCorrectInDrawer,
    addNewOptionInDrawer,
    removeOptionInDrawer,
    addNewSubquestionPartInDrawer,
    removeSubquestionPartInDrawer,
    updateSubquestionTextInDrawer,
    addNewRubricInDrawer,
    removeRubricInDrawer,
    updateRubricInDrawer,
  };
}
