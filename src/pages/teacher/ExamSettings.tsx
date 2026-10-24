/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useExamSettingsState } from '../../features/exam-settings/useExamSettingsState';
import { Save } from 'lucide-react';
import { Exam } from '../../types';
import {
 Button,
 PageHeader,
 UnsavedChangesGuard,
} from '../../ui';
import { useToast } from '../../hooks/useToast';
import { normalizePersianText } from '../../utils/persian';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useTeacherCollections } from '../../contexts/TeacherContext';
import { getValidationErrors } from '../../features/exam-settings/validation';
import { useExamSettingsActions } from '../../features/exam-settings/useExamSettingsActions';
import { RecommendationsBanner } from '../../features/exam-settings/RecommendationsBanner';
import { ScheduleSection } from '../../features/exam-settings/ScheduleSection';
import { AccessSection } from '../../features/exam-settings/AccessSection';
import { BehaviorSection } from '../../features/exam-settings/BehaviorSection';
import { ResultsSection } from '../../features/exam-settings/ResultsSection';
import { InstructionsSection } from '../../features/exam-settings/InstructionsSection';
import { ReviewPanel } from '../../features/exam-settings/ReviewPanel';

interface ExamSettingsProps {
 exam: Exam;
 // FE-7 fix: allow the parent to report success/failure — the dirty-guard
 // snapshot may only be committed after the save actually resolves.
 onSave: (updatedExam: Exam) => boolean | void | Promise<boolean | void>;
 onBack: () => void;
}

export default function ExamSettings({ exam, onSave, onBack }: ExamSettingsProps) {
 // Editor state lives in a single useReducer (schedule / access / rules /
 // publish slices). Initializers are byte-identical to the old useState
 // defaults; bound setters keep every JSX call site untouched.
 const {
 state: {
 startDate,
 startHour,
 endDate,
 endHour,
 durationMinutes,
 allowedClasses,
 requireNationalId,
 entryCode,
 maxAttempts,
 limitToSpecificStudents,
 allowedStudents,
 autoSubmit,
 allowBacktrack,
 showOneQuestionPerPage,
 autoSaveAnswers,
 shuffleQuestions,
 shuffleOptions,
 beastMode,
 resultsDisplayMode,
 startInstructions,
 examStatus,
 },
 dispatch,
 setStartDate,
 setStartHour,
 setEndDate,
 setEndHour,
 setDurationMinutes,
 setRequireNationalId,
 setEntryCode,
 setMaxAttempts,
 setLimitToSpecificStudents,
 setAutoSubmit,
 setAllowBacktrack,
 setShowOneQuestionPerPage,
 setAutoSaveAnswers,
 setShuffleQuestions,
 setShuffleOptions,
 setBeastMode,
 setResultsDisplayMode,
 setStartInstructions,
 setExamStatus,
 } = useExamSettingsState(exam);
 // Classes and students ride the shared collections cache — no private fetch.
 const { classGroups, students: allStudents } = useTeacherCollections();
 const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
 // Join link is DERIVED from exam_code (the old client-minted link 404'd).
 const examLink = exam.examCode ? `/secure-exam/${exam.examCode}` : '';
 const [isCopied, setIsCopied] = useState<boolean>(false);
 const [showRecommendationsApplied, setShowRecommendationsApplied] = useState<boolean>(false);

 // Track only persisted fields; search/copy/recommendation feedback is transient UI state.
 const editorSnapshot = JSON.stringify([
 startDate,
 startHour,
 endDate,
 endHour,
 durationMinutes,
 allowedClasses,
 requireNationalId,
 entryCode,
 maxAttempts,
 limitToSpecificStudents,
 allowedStudents,
 autoSubmit,
 allowBacktrack,
 showOneQuestionPerPage,
 autoSaveAnswers,
 shuffleQuestions,
 shuffleOptions,
 beastMode,
 resultsDisplayMode,
 startInstructions,
 examStatus,
 ]);
 const [savedSnapshot, setSavedSnapshot] = useState(editorSnapshot);
 const { guarded: guardUnsavedAction, dialogProps: unsavedDialog } = useUnsavedChanges(editorSnapshot !== savedSnapshot);
 const handleBack = () => guardUnsavedAction(onBack);

 const handleToggleClass = (classId: string) => {
 const relatedStudents = allStudents
 .filter((s) => s.classGroupId === classId)
 .map((s) => s.id);
 dispatch({ type: 'toggleClass', classId, relatedStudentIds: relatedStudents });
 };

 // Student selection handler
 const handleToggleStudent = (studentId: string) => {
 dispatch({ type: 'toggleStudent', studentId });
 };

 // Checkbox/Toggle toggler helpers
 const handleSelectAllStudentsForClass = (classId: string) => {
 const classStudents = allStudents.filter((s) => s.classGroupId === classId).map((s) => s.id);
 dispatch({ type: 'selectAllForClass', classStudentIds: classStudents });
 };

 // Real-time student calculation list
 const activeClassStudents = allStudents.filter((s) => allowedClasses.includes(s.classGroupId));
 const normalizedStudentSearch = normalizePersianText(studentSearchQuery);
 const filteredStudents = activeClassStudents.filter(
 (student) =>
 !normalizedStudentSearch ||
 normalizePersianText(student.name).includes(normalizedStudentSearch) ||
 normalizePersianText(student.nationalId).includes(normalizedStudentSearch),
 );

 const totalCalculatedStudents = limitToSpecificStudents
 ? allowedStudents.length
 : allowedClasses.reduce((sum, cid) => {
 const found = classGroups.find((c) => c.id === cid);
 return sum + (found ? found.studentCount : 0);
 }, 0);

 const questionsCount = exam.questions?.length || 0;
 const totalPoints = exam.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;

 // Real-time checker for descriptive items
 const longAnswersCount = exam.questions?.filter((q) => q.type === 'long_answer').length || 0;
 const longAnswersMissingRubric =
 exam.questions?.filter(
 (q) => q.type === 'long_answer' && (!q.rubrics || q.rubrics.length === 0),
 ) || [];

 // Recommended template applier
 const handleApplyOfficialRecommendations = () => {
 dispatch({ type: 'applyOfficialRecommendations' });

 setShowRecommendationsApplied(true);
 setTimeout(() => {
 setShowRecommendationsApplied(false);
 }, 4000);
 };

 const validationErrors = getValidationErrors({
 questionsCount,
 startDate,
 startHour,
 durationMinutes,
 allowedClasses,
 limitToSpecificStudents,
 allowedStudents,
 longAnswersMissingRubric,
 });

 const { showToast, toastElement } = useToast();

 const { handleSaveSettings, handlePublishExam } = useExamSettingsActions({
 exam,
 onSave,
 validationErrors,
 showToast,
 editorSnapshot,
 setSavedSnapshot,
 setExamStatus,
 examStatus,
 startDate,
 startHour,
 endDate,
 endHour,
 durationMinutes,
 allowedClasses,
 requireNationalId,
 entryCode,
 maxAttempts,
 limitToSpecificStudents,
 allowedStudents,
 autoSubmit,
 allowBacktrack,
 showOneQuestionPerPage,
 autoSaveAnswers,
 shuffleQuestions,
 shuffleOptions,
 beastMode,
 resultsDisplayMode,
 startInstructions,
 });

 // Copy Link function
 const handleCopyLink = () => {
 const fullUrl = `${window.location.origin}${examLink}`;
 navigator.clipboard.writeText(fullUrl).then(() => {
 setIsCopied(true);
 setTimeout(() => setIsCopied(false), 2500);
 });
 };

 return (
 <div className="space-y-6 text-right" dir="rtl" id="exam-settings-subview">
 {/* 1. Header and navigation row */}
 <div className="lens p-6 rounded-3xl">
 <PageHeader
 title="تنظیمات و انتشار آزمون"
 subtitle="پیکربندی زمان‌بندی، سطوح محدودیت دسترسی، کلیدها، رفتار تصادفی سیستم و صدور لینک ورودی"
 back={{ label: 'بازگشت', onClick: handleBack }}
 actions={
 <Button
 id="btn-settings-save-shortcut"
 variant="secondary"
 onClick={handleSaveSettings}
 icon={<Save className="w-4 h-4" />}
 >
 ذخیره پیش‌نویس موقت
 </Button>
 }
 />
 </div>

 {/* 2. Main Double-Column Layout */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
 {/* Right Columns (2/3 width) - Content Inputs and Custom Options */}
 <div className="lg:col-span-2 space-y-6">
 <RecommendationsBanner
 handleApplyOfficialRecommendations={handleApplyOfficialRecommendations}
 showRecommendationsApplied={showRecommendationsApplied}
 />
 <ScheduleSection
 startDate={startDate}
 startHour={startHour}
 endDate={endDate}
 endHour={endHour}
 durationMinutes={durationMinutes}
 setStartDate={setStartDate}
 setStartHour={setStartHour}
 setEndDate={setEndDate}
 setEndHour={setEndHour}
 setDurationMinutes={setDurationMinutes}
 />
 <AccessSection
 classGroups={classGroups}
 allowedClasses={allowedClasses}
 handleToggleClass={handleToggleClass}
 limitToSpecificStudents={limitToSpecificStudents}
 setLimitToSpecificStudents={setLimitToSpecificStudents}
 studentSearchQuery={studentSearchQuery}
 setStudentSearchQuery={setStudentSearchQuery}
 filteredStudents={filteredStudents}
 handleToggleStudent={handleToggleStudent}
 allowedStudents={allowedStudents}
 activeClassStudents={activeClassStudents}
 handleSelectAllStudentsForClass={handleSelectAllStudentsForClass}
 requireNationalId={requireNationalId}
 setRequireNationalId={setRequireNationalId}
 entryCode={entryCode}
 setEntryCode={setEntryCode}
 maxAttempts={maxAttempts}
 setMaxAttempts={setMaxAttempts}
 />
 <BehaviorSection
 autoSubmit={autoSubmit}
 setAutoSubmit={setAutoSubmit}
 allowBacktrack={allowBacktrack}
 setAllowBacktrack={setAllowBacktrack}
 autoSaveAnswers={autoSaveAnswers}
 setAutoSaveAnswers={setAutoSaveAnswers}
 shuffleQuestions={shuffleQuestions}
 setShuffleQuestions={setShuffleQuestions}
 shuffleOptions={shuffleOptions}
 setShuffleOptions={setShuffleOptions}
 showOneQuestionPerPage={showOneQuestionPerPage}
 setShowOneQuestionPerPage={setShowOneQuestionPerPage}
 beastMode={beastMode}
 setBeastMode={setBeastMode}
 />
 <ResultsSection
 resultsDisplayMode={resultsDisplayMode}
 setResultsDisplayMode={setResultsDisplayMode}
 longAnswersCount={longAnswersCount}
 />
 <InstructionsSection
 startInstructions={startInstructions}
 setStartInstructions={setStartInstructions}
 />
 </div>

 {/* Left Column (1/3 width) - Final Review, Validation Alerts & Publishing Link Panel */}
 <div className="col-span-1 space-y-5">
 <ReviewPanel
 exam={exam}
 classGroups={classGroups}
 allowedClasses={allowedClasses}
 totalCalculatedStudents={totalCalculatedStudents}
 questionsCount={questionsCount}
 totalPoints={totalPoints}
 startDate={startDate}
 startHour={startHour}
 endDate={endDate}
 endHour={endHour}
 durationMinutes={durationMinutes}
 beastMode={beastMode}
 longAnswersCount={longAnswersCount}
 validationErrors={validationErrors}
 examStatus={examStatus}
 setExamStatus={setExamStatus}
 handlePublishExam={handlePublishExam}
 examLink={examLink}
 isCopied={isCopied}
 handleCopyLink={handleCopyLink}
 handleBack={handleBack}
 handleSaveSettings={handleSaveSettings}
 />
 </div>
 </div>

 <UnsavedChangesGuard {...unsavedDialog} title="خروج بدون ذخیره؟" /> {toastElement}
 </div>
 );
}
