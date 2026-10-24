/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { HelpCircle, PlusCircle } from 'lucide-react';
import { Exam } from '../../types';
import { ConfirmDialog, PillButton, UnsavedChangesGuard } from '../../ui';
import { useToast } from '../../hooks/useToast';
import { toPersianDigits } from '../../utils/persian';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useTeacherCollections } from '../../contexts/TeacherContext';
import type { StudentAnswerValue } from '../../components/student-questions/types';
import { collectValidationWarnings } from '../../features/exam-preview/validation';
import { useReplaceQuestionFlow } from '../../features/exam-preview/useReplaceQuestionFlow';
import { useEditDrawerFlow } from '../../features/exam-preview/useEditDrawerFlow';
import { PreviewHeader } from './exam-preview/PreviewHeader';
import { WarningsBar } from './exam-preview/WarningsBar';
import { SpecificationsColumn } from './exam-preview/SpecificationsColumn';
import { QuestionCard } from './exam-preview/QuestionCard';
import { ReplaceQuestionModal } from './exam-preview/ReplaceQuestionModal';
import { EditQuestionDrawer } from './exam-preview/EditQuestionDrawer';

interface ExamPreviewProps {
 exam: Exam;
 onBack: () => void;
 onSave?: (updatedExam: Exam) => void;
 onNavigateToSettings?: (updatedExam: Exam) => void;
}

export default function ExamPreview({
 exam,
 onBack,
 onSave,
 onNavigateToSettings,
}: ExamPreviewProps) {
 // Local reactive exam state
 const { showToast, toastElement } = useToast();
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
 const [localExam, setLocalExam] = useState<Exam>({ ...exam });
 const [savedFingerprint, setSavedFingerprint] = useState(() => JSON.stringify(exam));
 const hasUnsavedChanges = JSON.stringify(localExam) !== savedFingerprint;
 const { guarded: confirmDiscard, dialogProps: discardDialog } = useUnsavedChanges(hasUnsavedChanges);
 const handleBack = () => confirmDiscard(onBack);

 // Mode state: 'teacher' (معلم) or 'student' (دانش‌آموز)
 const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');

 // Student response Simulation State (interactive inputs)
 // CQ-12 fix: typed with the shared saved-answer contract (was Record<string, any>).
 const [studentAnswers, setStudentAnswers] = useState<Record<string, StudentAnswerValue>>({});

 // Classes and the question bank ride the shared collections cache.
 const { classGroups, questions: bankQuestions } = useTeacherCollections();

 // 1. Dynamic Validation System — pure derived state
 const warnings = collectValidationWarnings(localExam);

 // Total scores summary
 const totalScore = localExam.questions.reduce((sum, q) => sum + (q.points || 0), 0);
 const totalQuestions = localExam.questions.length;

 // Assigned Classes String Lookup
 const getAssignedClassesString = () => {
 if (!localExam.classGroupIds || localExam.classGroupIds.length === 0)
 return 'به کلاسی تخصیص داده نشده';
 return localExam.classGroupIds
 .map((cid) => classGroups.find((c) => c.id === cid)?.name)
 .filter(Boolean)
 .join(' و ');
 };

 // Move Question up/down inside section allocation index
 const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
 // Find section containing it
 const updatedSections = localExam.sections.map((sec) => {
 if (sec.questionIds.includes(questionId)) {
 const idx = sec.questionIds.indexOf(questionId);
 const newQuestionIds = [...sec.questionIds];
 if (direction === 'up' && idx > 0) {
 // Swap with previous
 const temp = newQuestionIds[idx - 1];
 newQuestionIds[idx - 1] = newQuestionIds[idx];
 newQuestionIds[idx] = temp;
 } else if (direction === 'down' && idx < newQuestionIds.length - 1) {
 // Swap with next
 const temp = newQuestionIds[idx + 1];
 newQuestionIds[idx + 1] = newQuestionIds[idx];
 newQuestionIds[idx] = temp;
 }
 return { ...sec, questionIds: newQuestionIds };
 }
 return sec;
 });

 setLocalExam({
 ...localExam,
 sections: updatedSections,
 });
 };

 // Delete question from section and questions array — gated by the designed
 // ConfirmDialog instead of browser chrome (open + confirm pair below).
 const runDeleteQuestion = (questionId: string) => {
 const updatedSections = localExam.sections.map((sec) => ({
 ...sec,
 questionIds: sec.questionIds.filter((id) => id !== questionId),
 }));

 const updatedQuestions = localExam.questions.filter((q) => q.id !== questionId);

 setLocalExam({
 ...localExam,
 sections: updatedSections,
 questions: updatedQuestions,
 });
 };

 // Replace-question flow (filters + bank pipeline) lives in the
 // exam-preview feature (extracted verbatim from this page).
 const {
 replacingQuestionId, setReplacingQuestionId,
 replaceFilterGrade, setReplaceFilterGrade,
 replaceFilterSubject, setReplaceFilterSubject,
 replaceFilterType, setReplaceFilterType,
 replaceFilterDifficulty, setReplaceFilterDifficulty,
 replaceSearchQuery, setReplaceSearchQuery,
 triggerReplaceQuestion, handleExecuteReplacement, filteredBankQuestions,
 } = useReplaceQuestionFlow(localExam, setLocalExam, bankQuestions);

 // Edit-drawer state/flow lives in the exam-preview feature (extracted
 // verbatim from this page).
 const {
 setEditingQuestion, drawerTriggerRef, isAddingNew,
 triggerEditQuestion, triggerAddManualQuestion, handleSaveDrawerQuestion, drawerQuestion,
 updateOptionTextInDrawer, toggleOptionCorrectInDrawer, addNewOptionInDrawer, removeOptionInDrawer,
 addNewSubquestionPartInDrawer, removeSubquestionPartInDrawer, updateSubquestionTextInDrawer,
 addNewRubricInDrawer, removeRubricInDrawer, updateRubricInDrawer,
 } = useEditDrawerFlow(localExam, setLocalExam);

 // Student answer update simulation helper
 // CQ-12 fix: val is the shared saved-answer contract (was any).
 const handleStudentAnswerChange = (qId: string, val: StudentAnswerValue) => {
 setStudentAnswers({
 ...studentAnswers,
 [qId]: val,
 });
 };

 // CQ-1 (strict) fix: these inputs only ever hold the string branch of the
 // saved-answer contract; every other branch renders as empty text.
 const textAnswerOf = (qId: string): string => {
 const value = studentAnswers[qId];
 return typeof value === 'string' ? value : '';
 };

 return (
 <div
 className="space-y-6 text-right lens p-1 md:p-3 rounded-2xl"
 dir="rtl"
 id="exam-preview-edit-canvas"
 >
 {/* Upper header */}
 <PreviewHeader
 viewMode={viewMode}
 setViewMode={setViewMode}
 handleBack={handleBack}
 />

 {/* Dynamic Validation Alert Warnings bar */}
 {viewMode === 'teacher' && warnings.length > 0 && (
 <WarningsBar warnings={warnings} />
 )}

 {/* Main Body Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 {/* Right side specifications details (1/4 width) */}
 <SpecificationsColumn
 localExam={localExam}
 warnings={warnings}
 totalScore={totalScore}
 totalQuestions={totalQuestions}
 getAssignedClassesString={getAssignedClassesString}
 />

 {/* Left side core list of questions rendered perfectly (3/4 width) */}
 <div className="lg:col-span-3 space-y-6" id="questions-canvas">
 {localExam.sections.map((section, sIdx) => {
 const sectionQuestions = localExam.questions.filter((q) =>
 section.questionIds.includes(q.id),
 );

 return (
 <div
 key={section.id}
 className="pane p-5 md:p-6 rounded-3xl space-y-5"
 id={`pview-section-${section.id}`}
 >
 {/* Section Header */}
 <div className="border-b border-[var(--color-accent)]/10/60 pb-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] rounded-md px-2.5 py-0.5 text-micro">
 بخش {toPersianDigits(sIdx + 1)}
 </span>
 <h2 className="text-caption text-[var(--color-text-primary)] font-bold">
 {section.title}
 </h2>
 </div>
 {section.description && (
 <p className="text-micro text-[var(--color-text-tertiary)]">
 {section.description}
 </p>
 )}
 </div>

 {/* Manual Question Button per Section */}
 {viewMode === 'teacher' && (
 <PillButton
 fill="accent-soft"
 size="lg"
 radius="xl"
 onClick={(e) =>
 triggerAddManualQuestion(section.id, e.currentTarget as HTMLElement)
 }
 className="hover:bg-[var(--color-accent-soft)] flex items-center gap-1.5 transition-all self-end md:self-center"
 >
 <PlusCircle className="w-3.5 h-3.5" />
 <span>افزودن سوال دستی به این بخش</span>
 </PillButton>
 )}
 </div>

 {/* Question rendering */}
 <div className="space-y-8 divide-y divide-[var(--color-glass-light-stroke)] pr-1">
 {sectionQuestions.map((q, qIdx) => (
 <QuestionCard
 key={q.id}
 q={q}
 qIdx={qIdx}
 sectionId={section.id}
 viewMode={viewMode}
 studentAnswers={studentAnswers}
 handleStudentAnswerChange={handleStudentAnswerChange}
 textAnswerOf={textAnswerOf}
 moveQuestion={moveQuestion}
 triggerEditQuestion={triggerEditQuestion}
 triggerReplaceQuestion={triggerReplaceQuestion}
 setConfirmDeleteId={setConfirmDeleteId}
 />
 ))}

 {sectionQuestions.length === 0 && (
 <div className="py-12 text-center text-[var(--color-text-tertiary)] select-none space-y-2">
 <HelpCircle className="w-10 h-10 mx-auto text-[var(--color-text-primary)]" />
 <p className="text-caption font-bold text-[var(--color-text-secondary)]">
 این بخش فاقد هرگونه سوال انتصابی است
 </p>
 <p className="text-micro text-[var(--color-text-tertiary)]">
 می‌توانید با دکمه بالا سوال دستی اضافه کنید یا از بانک سوالات کپی نمایید.
 </p>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* FOOTER ACTIONS BAR */}
 <div
 className="border-t pane p-5 rounded-3xl mt-6 flex flex-col sm:flex-row justify-between items-center gap-4"
 id="preview-footer-plate"
 >
 <button
 type="button"
 onClick={handleBack}
 className="w-full sm:w-auto px-5 py-2.5 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] font-bold rounded-xl text-caption transition-all cursor-pointer text-center"
 >
 بازگشت به ساخت آزمون
 </button>

 <div className="flex gap-2.5 w-full sm:w-auto">
 <PillButton
 fill="accent-soft"
 size="xl"
 radius="xl"
 text="caption"
 onClick={() => {
 if (onSave) {
 onSave(localExam);
 setSavedFingerprint(JSON.stringify(localExam));
 } else {
 showToast('پیش‌نویس جدید آزمون با موفقیت در فضای ابری ذخیره شد.', 'success');
 }
 }}
 className="flex-1 sm:flex-none hover:bg-[var(--color-accent-soft)] transition-all border border-[var(--color-accent-soft)] text-center"
 >
 ذخیره پیش‌نویس موقت
 </PillButton>

 <PillButton
 fill="accent-solid"
 size="xl"
 radius="xl"
 text="caption"
 onClick={() => {
 if (onNavigateToSettings) {
 setSavedFingerprint(JSON.stringify(localExam));
 onNavigateToSettings(localExam);
 } else {
 showToast('تغییرات شما ذخیره شد. در حال هدایت به تنظیمات توزیع آزمون...', 'info');
 }
 }}
 className="flex-1 sm:flex-none hover:bg-[var(--color-accent-solid-hover)] shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all text-center"
 >
 ادامه به تنظیمات توزیع آزمون
 </PillButton>
 </div>
 </div>

 {/* MODAL 1: REPLACE QUESTION BANK — library chrome */}
 <ReplaceQuestionModal
 replacingQuestionId={replacingQuestionId}
 setReplacingQuestionId={setReplacingQuestionId}
 replaceFilterGrade={replaceFilterGrade}
 setReplaceFilterGrade={setReplaceFilterGrade}
 replaceFilterSubject={replaceFilterSubject}
 setReplaceFilterSubject={setReplaceFilterSubject}
 replaceFilterType={replaceFilterType}
 setReplaceFilterType={setReplaceFilterType}
 replaceFilterDifficulty={replaceFilterDifficulty}
 setReplaceFilterDifficulty={setReplaceFilterDifficulty}
 replaceSearchQuery={replaceSearchQuery}
 setReplaceSearchQuery={setReplaceSearchQuery}
 localExam={localExam}
 filteredBankQuestions={filteredBankQuestions}
 handleExecuteReplacement={handleExecuteReplacement}
 />

 {/* MODAL 2: MEGA ADD/EDIT MANUAL QUESTION PANEL — library side drawer */}
 <EditQuestionDrawer
 drawerQuestion={drawerQuestion}
 setEditingQuestion={setEditingQuestion}
 isAddingNew={isAddingNew}
 drawerTriggerRef={drawerTriggerRef}
 handleSaveDrawerQuestion={handleSaveDrawerQuestion}
 showToast={showToast}
 updateOptionTextInDrawer={updateOptionTextInDrawer}
 toggleOptionCorrectInDrawer={toggleOptionCorrectInDrawer}
 addNewOptionInDrawer={addNewOptionInDrawer}
 removeOptionInDrawer={removeOptionInDrawer}
 addNewSubquestionPartInDrawer={addNewSubquestionPartInDrawer}
 removeSubquestionPartInDrawer={removeSubquestionPartInDrawer}
 updateSubquestionTextInDrawer={updateSubquestionTextInDrawer}
 addNewRubricInDrawer={addNewRubricInDrawer}
 removeRubricInDrawer={removeRubricInDrawer}
 updateRubricInDrawer={updateRubricInDrawer}
 />

 {toastElement}
 <ConfirmDialog
 isOpen={confirmDeleteId !== null}
 title="حذف سوال از برگه"
 message="آیا از حذف این سوال از برگه آزمون مطمئن هستید؟"
 confirmText="حذف سوال"
 cancelText="انصراف"
 variant="danger"
 onConfirm={() => {
 if (confirmDeleteId) runDeleteQuestion(confirmDeleteId);
 setConfirmDeleteId(null);
 }}
 onCancel={() => setConfirmDeleteId(null)}
 />

 <UnsavedChangesGuard {...discardDialog} title="خروج از پیش‌نمایش؟" confirmText="خروج" />
 </div>
 );
}
