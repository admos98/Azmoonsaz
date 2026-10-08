/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Exam-settings editor state as a single useReducer with three slices.
 *
 * Extracted from src/pages/teacher/ExamSettings.tsx (26 useState → 1
 * useReducer + 4 transient useState left in the page). Initializers are
 * byte-identical to the page's original useState defaults. The hook exposes
 * setter-compatible bound functions (same call signatures as the old
 * setters) so every JSX call site works unchanged, plus `dispatch` for the
 * multi-field transitions (class toggles, official-recommendations preset).
 *
 * Slices:
 *   schedule — startDate/startHour/endDate/endHour/durationMinutes
 *   access   — allowedClasses/requireNationalId/entryCode/maxAttempts/
 *              limitToSpecificStudents/allowedStudents
 *   rules    — autoSubmit/allowBacktrack/showOneQuestionPerPage/
 *              autoSaveAnswers/shuffleQuestions/shuffleOptions/beastMode
 *   publish  — resultsDisplayMode/startInstructions/examStatus
 *
 * Transient UI state (studentSearchQuery, isCopied,
 * showRecommendationsApplied, savedSnapshot) stays in the page — it is
 * never persisted and does not belong in the editor snapshot.
 */
import { useReducer } from 'react';
import { Exam } from '../../types';
import { isoToWallClock } from '../../utils/tehranClock';

export type ResultsDisplayMode =
  | 'immediate_score'
  | 'immediate_score_answers'
  | 'after_approval'
  | 'none';

/** Today (local clock) as YYYY-MM-DD — defaults must not be frozen demo
    dates; scheduling itself is evaluated against Date.now(). */
const todayYmd = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

export interface ExamSettingsState {
  // schedule slice
  startDate: string;
  startHour: string;
  endDate: string;
  endHour: string;
  durationMinutes: number;
  // access slice
  allowedClasses: string[];
  requireNationalId: boolean;
  entryCode: string;
  maxAttempts: number;
  limitToSpecificStudents: boolean;
  allowedStudents: string[];
  // rules slice
  autoSubmit: boolean;
  allowBacktrack: boolean;
  showOneQuestionPerPage: boolean;
  autoSaveAnswers: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  beastMode: boolean;
  // publish slice
  resultsDisplayMode: ResultsDisplayMode;
  startInstructions: string;
  examStatus: Exam['status'];
}

type Action =
  | { type: 'patch'; patch: Partial<ExamSettingsState> }
  | { type: 'toggleClass'; classId: string; relatedStudentIds: string[] }
  | { type: 'toggleStudent'; studentId: string }
  | { type: 'selectAllForClass'; classStudentIds: string[] }
  | { type: 'applyOfficialRecommendations' };

function init(exam: Exam): ExamSettingsState {
  // Wall clock fields are the editor's source of truth. Legacy exams have no
  // startDate/startHour in settings — recover their Tehran wall clock from the
  // persisted instant instead of silently defaulting to "today".
  const startClock = isoToWallClock(exam.settings.startTime);
  const endClock = isoToWallClock(exam.settings.endTime);
  return {
    startDate: exam.settings.startDate || startClock?.date || todayYmd,
    startHour: exam.settings.startHour || startClock?.hour || '08:30',
    endDate: exam.settings.endDate || endClock?.date || todayYmd,
    endHour: exam.settings.endHour || endClock?.hour || '10:30',
    durationMinutes: exam.settings.durationMinutes || exam.duration || 60,
    allowedClasses: exam.settings.allowedClasses || exam.classGroupIds || [],
    requireNationalId: exam.settings.requireNationalId ?? true,
    entryCode: exam.settings.entryCode || '',
    maxAttempts: exam.settings.maxAttempts || 1,
    limitToSpecificStudents: !!(
      exam.settings.allowedStudents && exam.settings.allowedStudents.length > 0
    ),
    allowedStudents: exam.settings.allowedStudents || [],
    autoSubmit: exam.settings.autoSubmit ?? true,
    allowBacktrack: exam.settings.allowBacktrack ?? true,
    showOneQuestionPerPage: exam.settings.showOneQuestionPerPage ?? false,
    autoSaveAnswers: exam.settings.autoSaveAnswers ?? true,
    shuffleQuestions: exam.settings.shuffleQuestions ?? false,
    shuffleOptions: exam.settings.shuffleOptions ?? false,
    beastMode: exam.settings.beastMode ?? false,
    resultsDisplayMode:
      exam.settings.resultsDisplayMode ||
      (exam.settings.showImmediateResults ? 'immediate_score_answers' : 'after_approval'),
    startInstructions:
      exam.settings.startInstructions ||
      'دبیر گرامی یادداشت ابتدایی را جهت هدایت ذهن آماده کرده است:\n۱. لطفاً پیش از کلیک بر روی دکمه شروع آزمون، از پایداری ترافیک اینترنت خود اطمینان کامل حاصل کنید.\n۲. هرگونه سوییچ یا جابه‌جایی روی سایر نرم‌افزارهای دسکتاپ یا تب‌های مرورگر ثبت شده و تخلف محسوب می‌گردد.\n۳. زمان اجرای آزمون محدود است و پاسخ‌ها به صورت مستمر و پیوسته در ابر ذخیره می‌شوند.',
    examStatus: exam.status || 'draft',
  };
}

function reducer(state: ExamSettingsState, action: Action): ExamSettingsState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'toggleClass':
      if (state.allowedClasses.includes(action.classId)) {
        return {
          ...state,
          allowedClasses: state.allowedClasses.filter((id) => id !== action.classId),
          // Remove students that are no longer in allowed classes
          allowedStudents: state.allowedStudents.filter(
            (sid) => !action.relatedStudentIds.includes(sid),
          ),
        };
      }
      return { ...state, allowedClasses: [...state.allowedClasses, action.classId] };
    case 'toggleStudent':
      if (state.allowedStudents.includes(action.studentId)) {
        return {
          ...state,
          allowedStudents: state.allowedStudents.filter((id) => id !== action.studentId),
        };
      }
      return { ...state, allowedStudents: [...state.allowedStudents, action.studentId] };
    case 'selectAllForClass': {
      const allSelected = action.classStudentIds.every((sId) =>
        state.allowedStudents.includes(sId),
      );
      if (allSelected) {
        return {
          ...state,
          allowedStudents: state.allowedStudents.filter(
            (sId) => !action.classStudentIds.includes(sId),
          ),
        };
      }
      return {
        ...state,
        allowedStudents: Array.from(
          new Set([...state.allowedStudents, ...action.classStudentIds]),
        ),
      };
    }
    case 'applyOfficialRecommendations':
      return {
        ...state,
        maxAttempts: 1,
        resultsDisplayMode: 'after_approval',
        autoSubmit: true,
        showOneQuestionPerPage: true,
        allowBacktrack: false,
        beastMode: true,
        requireNationalId: true,
      };
  }
}

export function useExamSettingsState(exam: Exam) {
  const [state, dispatch] = useReducer(reducer, exam, init);

  // Setter-compatible bound functions — same call signatures as the old
  // useState setters, so JSX call sites (onChange={setAutoSubmit},
  // setResultsDisplayMode('none'), …) work unchanged.
  const bind = <K extends keyof ExamSettingsState>(key: K) => (value: ExamSettingsState[K]) =>
    dispatch({ type: 'patch', patch: { [key]: value } as Partial<ExamSettingsState> });

  return {
    state,
    dispatch,
    setStartDate: bind('startDate'),
    setStartHour: bind('startHour'),
    setEndDate: bind('endDate'),
    setEndHour: bind('endHour'),
    setDurationMinutes: bind('durationMinutes'),
    setAllowedClasses: bind('allowedClasses'),
    setRequireNationalId: bind('requireNationalId'),
    setEntryCode: bind('entryCode'),
    setMaxAttempts: bind('maxAttempts'),
    setLimitToSpecificStudents: bind('limitToSpecificStudents'),
    setAllowedStudents: bind('allowedStudents'),
    setAutoSubmit: bind('autoSubmit'),
    setAllowBacktrack: bind('allowBacktrack'),
    setShowOneQuestionPerPage: bind('showOneQuestionPerPage'),
    setAutoSaveAnswers: bind('autoSaveAnswers'),
    setShuffleQuestions: bind('shuffleQuestions'),
    setShuffleOptions: bind('shuffleOptions'),
    setBeastMode: bind('beastMode'),
    setResultsDisplayMode: bind('resultsDisplayMode'),
    setStartInstructions: bind('startInstructions'),
    setExamStatus: bind('examStatus'),
  };
}
