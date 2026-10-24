/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Exam, Question } from '../../types';
import { createDraftQuestionId } from './questionDraft';

/**
 * Replace-question flow for the exam preview page: bank filter state, the
 * filtered bank pipeline, and the swap handler.
 *
 * Extracted verbatim from src/pages/teacher/ExamPreview.tsx — the page
 * owns the localExam state and threads the value + setter in.
 */
export function useReplaceQuestionFlow(
  localExam: Exam,
  setLocalExam: Dispatch<SetStateAction<Exam>>,
  bankQuestions: Question[],
) {
 // Search/Filter matching compatibility on replacing (null means closed)
 const [replacingQuestionId, setReplacingQuestionId] = useState<string | null>(null);
 const [replacingSectionId, setReplacingSectionId] = useState<string | null>(null);
 const [replaceFilterGrade, setReplaceFilterGrade] = useState<string>('all');
 const [replaceFilterSubject, setReplaceFilterSubject] = useState<string>('all');
 const [replaceFilterType, setReplaceFilterType] = useState<string>('all');
 const [replaceFilterDifficulty, setReplaceFilterDifficulty] = useState<string>('all');
 const [replaceSearchQuery, setReplaceSearchQuery] = useState<string>('');

 // Open Replace Question Dialogue box
 const triggerReplaceQuestion = (questionId: string, sectionId: string) => {
 setReplacingQuestionId(questionId);
 setReplacingSectionId(sectionId);
 setReplaceFilterGrade(localExam.grade || 'all');
 setReplaceFilterSubject(localExam.subject || 'all');
 setReplaceFilterType('all');
 setReplaceFilterDifficulty('all');
 setReplaceSearchQuery('');
 };

 const handleExecuteReplacement = (selectedBankQ: Question) => {
 if (!replacingQuestionId || !replacingSectionId) return;

 // Build replacement
 const randId = createDraftQuestionId('q-rep');
 const clonedQ: Question = { ...selectedBankQ, id: randId };

 // Update in questions array
 const updatedQuestions = localExam.questions.map((q) =>
 q.id === replacingQuestionId ? clonedQ : q,
 );

 // Update in section arrays list
 const updatedSections = localExam.sections.map((sec) => {
 if (sec.id === replacingSectionId) {
 return {
 ...sec,
 questionIds: sec.questionIds.map((qid) => (qid === replacingQuestionId ? randId : qid)),
 };
 }
 return sec;
 });

 setLocalExam({
 ...localExam,
 questions: updatedQuestions,
 sections: updatedSections,
 });

 setReplacingQuestionId(null);
 setReplacingSectionId(null);
 };

 // Replacement search filter pipeline
 const filteredBankQuestions = bankQuestions.filter((bq) => {
 // Exclude physical matches already assigned in exam to avoid duplication
 if (localExam.questions.some((eq) => eq.text === bq.text)) return false;

 const matchQuery =
 !replaceSearchQuery ||
 bq.title.toLowerCase().includes(replaceSearchQuery.toLowerCase()) ||
 bq.text.toLowerCase().includes(replaceSearchQuery.toLowerCase());

 const matchGrade = replaceFilterGrade === 'all' || bq.grade === replaceFilterGrade;
 const matchSubject =
 replaceFilterSubject === 'all' ||
 bq.category.includes(replaceFilterSubject) ||
 bq.category === replaceFilterSubject;
 const matchType = replaceFilterType === 'all' || bq.type === replaceFilterType;
 const matchDiff =
 replaceFilterDifficulty === 'all' || bq.difficulty === replaceFilterDifficulty;

 return matchQuery && matchGrade && matchSubject && matchType && matchDiff;
 });

  return {
    replacingQuestionId,
    setReplacingQuestionId,
    replaceFilterGrade,
    setReplaceFilterGrade,
    replaceFilterSubject,
    setReplaceFilterSubject,
    replaceFilterType,
    setReplaceFilterType,
    replaceFilterDifficulty,
    setReplaceFilterDifficulty,
    replaceSearchQuery,
    setReplaceSearchQuery,
    triggerReplaceQuestion,
    handleExecuteReplacement,
    filteredBankQuestions,
  };
}
