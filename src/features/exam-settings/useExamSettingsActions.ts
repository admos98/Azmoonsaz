/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Save/publish submission handlers for the exam settings page — moved
 * verbatim from src/pages/teacher/ExamSettings.tsx (handleSaveSettings and
 * handlePublishExam). The hook owns no state; the page threads the editor
 * state and the unsaved-changes snapshot in as parameters.
 */
import { Exam, ExamSettings as SettingsType } from '../../types';
import { wallClockToIso } from '../../utils/tehranClock';
import { deriveExamStatus } from '../../lib/examStatus';
import type { ResultsDisplayMode } from './useExamSettingsState';

interface ExamSettingsActionsParams {
  exam: Exam;
  onSave: (updatedExam: Exam) => boolean | void | Promise<boolean | void>;
  validationErrors: string[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  editorSnapshot: string;
  setSavedSnapshot: (snapshot: string) => void;
  setExamStatus: (value: Exam['status']) => void;
  examStatus: Exam['status'];
  startDate: string;
  startHour: string;
  endDate: string;
  endHour: string;
  durationMinutes: number;
  allowedClasses: string[];
  requireNationalId: boolean;
  entryCode: string;
  maxAttempts: number;
  limitToSpecificStudents: boolean;
  allowedStudents: string[];
  autoSubmit: boolean;
  allowBacktrack: boolean;
  showOneQuestionPerPage: boolean;
  autoSaveAnswers: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  beastMode: boolean;
  resultsDisplayMode: ResultsDisplayMode;
  startInstructions: string;
}

export function useExamSettingsActions({
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
}: ExamSettingsActionsParams) {
 // Handle Form Submission Save
 const handleSaveSettings = async () => {
 const settings: SettingsType = {
 mode: exam.settings.mode, // Preserve 'official' or 'practice'
 durationMinutes,
 // Tehran wall clock -> absolute instant (+03:30, never a naive string).
 startTime: wallClockToIso(startDate, startHour) || undefined,
 endTime: wallClockToIso(endDate, endHour) || undefined,
 shuffleQuestions,
 shuffleOptions,
 allowBacktrack,
 showImmediateResults:
 resultsDisplayMode === 'immediate_score' ||
 resultsDisplayMode === 'immediate_score_answers',
 maxAttempts,
 browserLockdown: beastMode,

 // Extended fields mapped
 startDate,
 endDate,
 startHour,
 endHour,
 allowedClasses,
 allowedStudents: limitToSpecificStudents ? allowedStudents : [],
 requireNationalId,
 entryCode,
 autoSubmit,
 showOneQuestionPerPage,
 autoSaveAnswers,
 beastMode,
 resultsDisplayMode,
 startInstructions,
 // examLink no longer persisted — derived from exam.examCode at render
 };

 // FE-7 fix: the snapshot is committed only AFTER the awaited save
 // succeeds. The old code marked it saved synchronously, so a failed
 // network save left the dirty-check "clean" and navigating away
 // silently discarded the edits. The parent returns false on failure
 // (Exams.tsx handleUpdateExam); void return (local savers) = success.
 const outcome = await onSave({
 ...exam,
 duration: durationMinutes,
 classGroupIds: allowedClasses,
 status: examStatus,
 settings,
 });
 if (outcome !== false) {
 setSavedSnapshot(editorSnapshot);
 }
 };

 // Handle Publishing Action with link generation
 const handlePublishExam = async () => {
 if (validationErrors.length > 0) {
 showToast(
 'پیکربندی آزمون دارای برخی خطاهای اساسی است و قابل انتشار نیست. لطفاً ابتدا خطاهای موجود در پنل مرور چپ را اصلاح نمایید.',
 'error',
 );
 return;
 }

 // Join link: the server mints exam_code at creation (hydrateExam/mapExam
 // round-trip it) — nothing to generate client-side.

 // CQ-9 fix: this used to be a hand-rolled clock-only mirror that omitted
 // the server's sticky draft/archived/completed branches and its
 // garbage-timestamp fallback. It now routes through the shared client twin
 // (src/lib/examStatus.ts, case-for-case test parity with the server suite).
 // Passing status 'active' keeps the sticky branches inert, so the result is
 // decided by exactly the clock logic the server applies on read — parsing
 // the same Tehran instant the server will store, so client and server agree
 // on "scheduled vs active". The server re-derives on every read anyway.
 const nowMs = Date.now();
 const startIso = wallClockToIso(startDate, startHour);
 const endIso = wallClockToIso(endDate, endHour);

 const targetStatus: Exam['status'] = deriveExamStatus(
  { status: 'active', starts_at: startIso, ends_at: endIso },
  new Date(nowMs),
 );

 setExamStatus(targetStatus);

 // Trigger save automatically right after
 const settings: SettingsType = {
 mode: exam.settings.mode,
 durationMinutes,
 // Tehran wall clock -> absolute instant (+03:30, never a naive string).
 startTime: wallClockToIso(startDate, startHour) || undefined,
 endTime: wallClockToIso(endDate, endHour) || undefined,
 shuffleQuestions,
 shuffleOptions,
 allowBacktrack,
 showImmediateResults:
 resultsDisplayMode === 'immediate_score' ||
 resultsDisplayMode === 'immediate_score_answers',
 maxAttempts,
 browserLockdown: beastMode,

 startDate,
 endDate,
 startHour,
 endHour,
 allowedClasses,
 allowedStudents: limitToSpecificStudents ? allowedStudents : [],
 requireNationalId,
 entryCode,
 autoSubmit,
 showOneQuestionPerPage,
 autoSaveAnswers,
 beastMode,
 resultsDisplayMode,
 startInstructions,
 };

 // FE-7 fix: same awaited-snapshot commit as handleSaveSettings — a
 // failed publish save must keep the guard dirty.
 const outcome = await onSave({
 ...exam,
 duration: durationMinutes,
 classGroupIds: allowedClasses,
 status: targetStatus,
 settings,
 });
 if (outcome !== false) {
 setSavedSnapshot(editorSnapshot);
 }
 };

  return { handleSaveSettings, handlePublishExam };
}
