/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { Exam } from '../../types';
import { ConfirmDialog } from '../../ui';
import { useToast } from '../../hooks/useToast';
import { PanelCrest } from '../../components/PanelCrest';
import { toPersianDigits } from '../../utils/persian';
import { useResultGrading } from '../../features/exam-results/useResultGrading';
import { useTeacherCollections } from '../../contexts/TeacherContext';
import {
 buildResultStats,
 buildResultsCsv,
 buildResultsXlsx,
 buildStudentRows,
 filterRows,
} from './exam-results/student-rows';
import { ResultsHeaderBar } from './exam-results/ResultsHeaderBar';
import { ResultsStatsGrid } from './exam-results/ResultsStatsGrid';
import { ResultsFiltersPanel } from './exam-results/ResultsFiltersPanel';
import { ResultsTable } from './exam-results/ResultsTable';
import { GradingHeaderRow } from './exam-results/grading/GradingHeaderRow';
import { QuestionReviewCard } from './exam-results/grading/QuestionReviewCard';
import { GradingSummaryPanel } from './exam-results/grading/GradingSummaryPanel';

interface ExamResultsProps {
 exam: Exam;
 onBack: () => void;
}

export default function ExamResults({ exam, onBack }: ExamResultsProps) {
 // Submissions and the cohort ride the shared collections cache — this page
 // used to fire its own ?examId= fetch (and a full submissions refetch per
 // graded answer). The exam-filtered view is a pure derivation now.
 const {
 submissions: allSubmissions,
 students: allStudents,
 classGroups,
 reload,
 } = useTeacherCollections();

 const submissions = useMemo(
 () => allSubmissions.filter((s) => s.examId === exam.id),
 [allSubmissions, exam.id],
 );

 // Combine real submissions and the class cohort to have a complete student
 // ledger — this actually works now that allStudents is the shared cache
 // instead of a dead local empty array.
 const examCohortStudents = allStudents.filter((student) =>
 exam.classGroupIds.includes(student.classGroupId),
 );
 const effectiveCohort = examCohortStudents.length > 0 ? examCohortStudents : allStudents;

 // Active view constraints
 const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

 // States for search & filter
 const [searchQuery, setSearchQuery] = useState('');
 const [classFilter, setClassFilter] = useState('all');
 const [participationFilter, setParticipationFilter] = useState('all'); // 'all', 'submitted', 'absent', 'ongoing'
 const [correctionFilter, setCorrectionFilter] = useState('all'); // 'all', 'graded', 'needs_grading'
 const [scoreRangeFilter, setScoreRangeFilter] = useState('all'); // 'all', 'high' (>=80%), 'mid' (50%-80%), 'low' (<50%)

 const { showToast, toastElement } = useToast();
 const [confirmFinalize, setConfirmFinalize] = useState(false);
 const [confirmInvalidate, setConfirmInvalidate] = useState(false);
 const [invalidateBusy, setInvalidateBusy] = useState(false);

 // Construct complete row data pairing cohort with submissions, then derive
 // overview stats and the filtered view — all logic lives in the pure
 // ./exam-results/student-rows module.
 const studentRows = buildStudentRows({
 exam,
 submissions,
 students: effectiveCohort,
 classGroups,
 });
 const activeSubmission = selectedSubmissionId
 ? studentRows.find((row) => row.id === selectedSubmissionId) || null
 : null;

 // Manual-grading workspace lives in the exam-results feature (extracted
 // verbatim from this page). The page keeps filters, stats, exports, JSX.
 const {
 assignedScores, setAssignedScores,
 teacherComments, setTeacherComments,
 rubricScores, setRubricScores,
 savedDescriptiveQuestions, setSavedDescriptiveQuestions,
 startGrading,
 getQuestionRubrics,
 saveSingleQuestionGrade,
 getUngradedDescriptiveQuestionsCount,
 handleFinalizeGrading,
 runFinalizeGrading,
 handleInvalidate,
 } = useResultGrading({
 exam,
 activeSubmission,
 setSelectedSubmissionId,
 setConfirmFinalize,
 setConfirmInvalidate,
 setInvalidateBusy,
 showToast,
 });

 const {
 totalCohortsCount,
 participantsCount,
 absentCount,
 avgScore,
 highestScore,
 needsCorrectionCount,
 completedCorrectionCount,
 hasDescriptiveQuestions,
 } = buildResultStats(studentRows, exam);

 // Apply filters
 const filteredRows = filterRows(studentRows, {
 searchQuery,
 classFilter,
 participationFilter,
 correctionFilter,
 scoreRangeFilter,
 });

 // Excel CSV Export (logic in ./exam-results/student-rows)
 const handleExportCSV = () => {
 buildResultsCsv(exam.title, studentRows);
 };

 // Real XLSX via SheetJS — the old button faked an ExcelJS success toast
 // over a CSV file. The toast fires only after the workbook downloads.
 const handleExportExcel = async () => {
 try {
 await buildResultsXlsx(exam.title, studentRows);
 showToast('فایل Excel (XLSX) دانلود شد.', 'success');
 } catch {
 showToast('ساخت فایل Excel ممکن نشد؛ از خروجی CSV استفاده کنید.', 'error');
 }
 };

 return (
 <div className="space-y-6 text-right" id="exam-grading-dashboard">
 <AnimatePresence mode="wait">
 {/* CQ-1 (strict) fix: guard on the derived row, not the raw id. Behavior
     is identical while a row exists; a stale selected id (row removed by a
     concurrent refresh) now shows the list instead of dereferencing null. */}
 {!activeSubmission ? (
 <motion.div
 key="results-list"
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -15 }}
 className="space-y-6"
 id="panel-results-list"
 >
 <ResultsHeaderBar
 exam={exam}
 onBack={onBack}
 handleExportCSV={handleExportCSV}
 handleExportExcel={handleExportExcel}
 />

 <ResultsStatsGrid
 totalCohortsCount={totalCohortsCount}
 participantsCount={participantsCount}
 absentCount={absentCount}
 avgScore={avgScore}
 highestScore={highestScore}
 needsCorrectionCount={needsCorrectionCount}
 completedCorrectionCount={completedCorrectionCount}
 />

 <ResultsFiltersPanel
 exam={exam}
 classGroups={classGroups}
 searchQuery={searchQuery}
 setSearchQuery={setSearchQuery}
 classFilter={classFilter}
 setClassFilter={setClassFilter}
 participationFilter={participationFilter}
 setParticipationFilter={setParticipationFilter}
 correctionFilter={correctionFilter}
 setCorrectionFilter={setCorrectionFilter}
 scoreRangeFilter={scoreRangeFilter}
 setScoreRangeFilter={setScoreRangeFilter}
 />

 {/* Structured Submissions Tables */}
 <div
 className="lens rounded-3xl p-6 overflow-hidden space-y-4"
 id="section-structured-submissions"
 >
 <PanelCrest
 kind="grading"
 state={filteredRows.length > 0 ? 'filled' : 'empty'}
 >
 <div className="flex items-center justify-between border-b border-[var(--color-glass-light-stroke)] pb-2">
 <div>
 <h2 className="text-label text-[var(--color-text-primary)]">
 لیست پاسخ‌برگ‌ها و وضعیت ثبت نمرات
 </h2>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-0.5">
 مجموع فیلتر شده: {toPersianDigits(filteredRows.length)} دانش‌آموز
 </p>
 </div>
 </div>

 <ResultsTable
 filteredRows={filteredRows}
 startGrading={startGrading}
 reload={reload}
 />
 </PanelCrest>
 </div>
 </motion.div>
 ) : (
 /* Substantive Focused Cinema Mode Workspace interface */
 <motion.div
 key="results-grading-detail"
 initial={{ opacity: 0, scale: 0.92 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.92 }}
 style={{ transformOrigin: 'center bottom' }}
 transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
 className="grid grid-cols-1 lg:grid-cols-12 gap-6"
 id="workspace-evaluation-mode"
 >
 {/* Right evaluation control details drawer list (or column top) */}
 <div className="lg:col-span-8 space-y-6">
 <GradingHeaderRow
 activeSubmission={activeSubmission}
 assignedScores={assignedScores}
 setSelectedSubmissionId={setSelectedSubmissionId}
 setConfirmInvalidate={setConfirmInvalidate}
 invalidateBusy={invalidateBusy}
 />

 {/* Step-by-step Reviewing all exam questions list */}
 <div className="space-y-6">
 {exam.questions.map((q, idx) => (
 <QuestionReviewCard
 key={q.id}
 q={q}
 idx={idx}
 activeSubmission={activeSubmission}
 savedDescriptiveQuestions={savedDescriptiveQuestions}
 rubricScores={rubricScores}
 setRubricScores={setRubricScores}
 setAssignedScores={setAssignedScores}
 setSavedDescriptiveQuestions={setSavedDescriptiveQuestions}
 teacherComments={teacherComments}
 setTeacherComments={setTeacherComments}
 getQuestionRubrics={getQuestionRubrics}
 saveSingleQuestionGrade={saveSingleQuestionGrade}
 />
 ))}
 </div>
 </div>

 {/* Left static metadata summary & finalizing drawer col */}
 <div className="lg:col-span-4 space-y-6">
 <GradingSummaryPanel
 exam={exam}
 activeSubmission={activeSubmission}
 assignedScores={assignedScores}
 savedDescriptiveQuestions={savedDescriptiveQuestions}
 hasDescriptiveQuestions={hasDescriptiveQuestions}
 getUngradedDescriptiveQuestionsCount={getUngradedDescriptiveQuestionsCount}
 handleFinalizeGrading={handleFinalizeGrading}
 setSelectedSubmissionId={setSelectedSubmissionId}
 />
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {toastElement}
 <ConfirmDialog
 isOpen={confirmInvalidate}
 title="اقدام انضباطی آزمون"
 message={
 (activeSubmission?.rawSubmission?.warningCount || 0) > 0
 ? 'این دانش‌آموز قبلاً یک هشدار دارد. این بار پاسخ‌برگ او مسدود و شرکت در این آزمون برای همیشه بسته می‌شود. ادامه می‌دهید؟'
 : 'اولین هشدار: پاسخ‌های این نشست پاک و آزمون از نو (با زمان کامل) شروع می‌شود. در صورت تکرار تخلف، دانش‌آموز برای همیشه در این آزمون مسدود خواهد شد. ادامه می‌دهید؟'
 }
 confirmText="بله، اعمال شود"
 cancelText="انصراف"
 variant="danger"
 onConfirm={() => {
 void handleInvalidate();
 }}
 onCancel={() => setConfirmInvalidate(false)}
 />
 <ConfirmDialog
 isOpen={confirmFinalize}
 title="ثبت کارنامه با تصحیح ناقص"
 message={`تعداد ${toPersianDigits(getUngradedDescriptiveQuestionsCount())} سوال تشریحی هنوز نمره‌دهی نهایی نشده‌اند. آیا مایل هستید بدون تصحیح کاملِ ورقه اقدام به ثبت کارنامه کنید؟`}
 confirmText="ثبت نهایی کارنامه"
 cancelText="بازگشت به تصحیح"
 variant="danger"
 onConfirm={() => {
 setConfirmFinalize(false);
 void runFinalizeGrading();
 }}
 onCancel={() => setConfirmFinalize(false)}
 />
 </div>
 );
}
