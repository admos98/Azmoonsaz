/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Exam, Question } from '../../types';
import { createDraftQuestionId } from './questionDraft';
import { usePreviewDrawerHandlers } from './usePreviewDrawerHandlers';

/**
 * Edit-drawer flow for the exam preview page: editingQuestion state, add/
 * edit triggers, the drawer save handler, and the narrowed drawerQuestion
 * alias. Extracted verbatim from src/pages/teacher/ExamPreview.tsx — the
 * page owns the localExam state and threads the value + setter in.
 */
export function useEditDrawerFlow(
  localExam: Exam,
  setLocalExam: Dispatch<SetStateAction<Exam>>,
) {
 // Active question being edited in drawer/modal (null means closed)
 const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
 const drawerTriggerRef = useRef<HTMLElement | null>(null);
 const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
 const [targetSectionIdForNew, setTargetSectionIdForNew] = useState<string>('');

 // Open Edit Dialog Drawer for existing question, or create new question representation
 const triggerEditQuestion = (q: Question, trigger?: HTMLElement) => {
 drawerTriggerRef.current = trigger ?? null;
 setEditingQuestion({ ...q });
 setIsAddingNew(false);
 };

 const triggerAddManualQuestion = (sectionId: string, trigger?: HTMLElement) => {
 drawerTriggerRef.current = trigger ?? null;
 setTargetSectionIdForNew(sectionId);
 setEditingQuestion({
 id: createDraftQuestionId('q-man'),
 title: 'عنوان سوال جدید',
 text: 'صورت سوال را در اینجا یادداشت کنید.',
 type: 'single_choice',
 points: 2,
 category: localExam.subject,
 grade: localExam.grade,
 options: [
 { id: 'o1', text: 'گزینه اول تستی', isCorrect: true },
 { id: 'o2', text: 'گزینه دوم تستی', isCorrect: false },
 { id: 'o3', text: 'گزینه سوم تستی', isCorrect: false },
 { id: 'o4', text: 'گزینه چهارم تستی', isCorrect: false },
 ],
 rubrics: [],
 parts: [],
 });
 setIsAddingNew(true);
 };

 // Handle drawer update changes safely
 const handleSaveDrawerQuestion = () => {
 if (!editingQuestion || !editingQuestion.id) return;

 const validatedQ: Question = {
 id: editingQuestion.id,
 type: editingQuestion.type || 'single_choice',
 title: editingQuestion.title || 'سوال تازه',
 text: editingQuestion.text || 'بدون متن',
 points: Number(editingQuestion.points) || 0,
 category: editingQuestion.category || localExam.subject,
 grade: editingQuestion.grade || localExam.grade,
 options: editingQuestion.options,
 matchingPairs: editingQuestion.matchingPairs,
 orderingItems: editingQuestion.orderingItems,
 correctFillBlanks: editingQuestion.correctFillBlanks,
 correctAnswer: editingQuestion.correctAnswer,
 imageUrl: editingQuestion.imageUrl,
 parts: editingQuestion.parts,
 rubrics: editingQuestion.rubrics,
 createdAt: editingQuestion.createdAt || new Date().toISOString(),
 };

 if (isAddingNew) {
 // Append questioning to dynamic container list
 const updatedQuestions = [...localExam.questions, validatedQ];
 const updatedSections = localExam.sections.map((sec) => {
 if (sec.id === targetSectionIdForNew) {
 return {
 ...sec,
 questionIds: [...sec.questionIds, validatedQ.id],
 };
 }
 return sec;
 });

 setLocalExam({
 ...localExam,
 questions: updatedQuestions,
 sections: updatedSections,
 });
 } else {
 const updatedQuestions = localExam.questions.map((q) =>
 q.id === validatedQ.id ? validatedQ : q,
 );
 setLocalExam({
 ...localExam,
 questions: updatedQuestions,
 });
 }

 setEditingQuestion(null);
 };

 // Edit-drawer row controls live in the exam-preview feature (extracted
 // verbatim from this page).
 const {
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
 } = usePreviewDrawerHandlers(editingQuestion, setEditingQuestion);

 // CQ-1 (strict) fix: narrowed view alias for the question drawer. The drawer
 // Modal must stay mounted for its exit animation, so `isOpen` cannot narrow
 // editingQuestion for the type checker; every read below sits inside the
 // open drawer, and while it is closed this alias is an empty object that
 // nothing renders. Runtime behavior is unchanged ({...{}} spreads harmlessly).
 const drawerQuestion: Partial<Question> = editingQuestion ?? {};

  return {
    editingQuestion,
    setEditingQuestion,
    drawerTriggerRef,
    isAddingNew,
    triggerEditQuestion,
    triggerAddManualQuestion,
    handleSaveDrawerQuestion,
    drawerQuestion,
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
