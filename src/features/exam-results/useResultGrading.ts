/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manual-grading workspace for one submission + finalize flow.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx. Owns the
 * per-question score/comment/rubric workspace, the startGrading loader, the
 * single-question save, the ungraded counter, and the finalize + invalidate
 * flows. The page keeps filters, stats derivations, exports, and JSX.
 */
import { useState } from 'react';
import { Exam, Question, StudentAnswer } from '../../types';
import { gradingService } from '../../services/api';
import { useTeacher, useTeacherCollections } from '../../contexts/TeacherContext';
import { logger } from '../../lib/logger';
import { toPersianDigits } from '../../utils/persian';
import type { ResultRow } from '../../pages/teacher/exam-results/student-rows';

interface GradingOptions {
  exam: Exam;
  activeSubmission: ResultRow | null;
  setSelectedSubmissionId: (id: string | null) => void;
  setConfirmFinalize: (v: boolean) => void;
  setConfirmInvalidate: (v: boolean) => void;
  setInvalidateBusy: (v: boolean) => void;
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
  ) => void;
}

export function useResultGrading(opts: GradingOptions) {
  const { exam, activeSubmission, setSelectedSubmissionId, setConfirmFinalize, setConfirmInvalidate, setInvalidateBusy, showToast } = opts;
  const { upsertSubmission, reload } = useTeacherCollections();
  const { teacher } = useTeacher();

    // Temporary workspace state for grading a single student
    // Stores scoring details per question
    const [assignedScores, setAssignedScores] = useState<Record<string, number>>({});
    const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  
    // Rubric details state: questionId => criterionId => assignedPoints
    const [rubricScores, setRubricScores] = useState<Record<string, Record<string, number>>>({});
    const [savedDescriptiveQuestions, setSavedDescriptiveQuestions] = useState<
      Record<string, boolean>
    >({});
    const [invalidateBusy, setInvalidateBusyLocal] = useState(false);
    const markInvalidateBusy = (v: boolean) => {
      setInvalidateBusy(v);
      setInvalidateBusyLocal(v);
    };
  

    // Wave C: disciplinary action — the SERVER decides warn-first vs block
    // (first strike restarts the session, second strike locks it permanently).
    const handleInvalidate = async () => {
      const submissionId = activeSubmission?.rawSubmission?.id;
      if (!submissionId) return;
      setConfirmInvalidate(false);
      markInvalidateBusy(true);
      try {
        const result = await gradingService.invalidateSubmission(submissionId);
        if (result.action === 'warned') {
          showToast(
            'هشدار ثبت شد و آزمون این دانش‌آموز از نو (با زمان کامل) شروع شد.',
            'warning',
          );
        } else {
          showToast('دانش‌آموز برای این آزمون مسدود شد.', 'success');
        }
        setSelectedSubmissionId(null);
        await reload('submissions');
      } catch (err) {
        logger.error('Invalidate submission failed:', err);
        showToast('انجام اقدام ممکن نشد. دوباره تلاش کنید.', 'error');
      } finally {
        markInvalidateBusy(false);
      }
    };

    const startGrading = (row: ResultRow) => {
      if (row.status === 'absent') {
        showToast('این دانش‌آموز غایب بوده و پاسخ‌برگی ارسال نکرده است.', 'warning');
        return;
      }
  
      setSelectedSubmissionId(row.id);
      const sub = row.rawSubmission;
  
      // Auto populate existing scores, comments, & rubrics
      const scores: Record<string, number> = {};
      const comments: Record<string, string> = {};
      const initialRubric: Record<string, Record<string, number>> = {};
      const gradedQSaved: Record<string, boolean> = {};
  
      exam.questions.forEach((q) => {
        const stdAns = sub.answers.find((a: StudentAnswer) => a.questionId === q.id);
        scores[q.id] = stdAns?.scoreGained ?? 0;
        comments[q.id] = stdAns?.teacherComment ?? '';
  
        // Setup rubrics
        initialRubric[q.id] = {};
        const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
  
        if (isDescriptive) {
          // If question already has score, set up mock rubrics partitioned
          const defaultRubrics = getQuestionRubrics(q);
          const savedScore = stdAns?.scoreGained;
  
          if (savedScore !== undefined && savedScore !== null) {
            gradedQSaved[q.id] = true;
            // Split saved score across rubrics
            let remaining = savedScore;
            defaultRubrics.forEach((rub, rIdx) => {
              if (rIdx === defaultRubrics.length - 1) {
                initialRubric[q.id][rub.id] = Math.min(rub.maxPoints, remaining);
              } else {
                const allocated = Math.min(
                  rub.maxPoints,
                  Number((savedScore * (rub.maxPoints / q.points)).toFixed(2)),
                );
                initialRubric[q.id][rub.id] = allocated;
                remaining -= allocated;
              }
            });
          } else {
            // Initialize empty
            defaultRubrics.forEach((rub) => {
              initialRubric[q.id][rub.id] = 0;
            });
          }
        }
      });
  
      setAssignedScores(scores);
      setTeacherComments(comments);
      setRubricScores(initialRubric);
      setSavedDescriptiveQuestions(gradedQSaved);
    };
  
    // Helper to retrieve or establish default rubrics for long answers
    const getQuestionRubrics = (q: Question) => {
      if (q.rubrics && q.rubrics.length > 0) {
        return q.rubrics;
      }
      // Build 2 default rubrics: scientific/conceptual accuracy (60%) and writing/analytical structure (40%)
      const crit1Points = Number((q.points * 0.6).toFixed(2));
      const crit2Points = Number((q.points - crit1Points).toFixed(2));
      return [
        {
          id: `${q.id}-crit-accuracy`,
          title: 'درستی استدلال و محتوای علمی',
          description: 'عمق پاسخ ارائه شده در تحلیل مسئله و تطابق آن با اصول کلید تصحیح آزمون',
          maxPoints: crit1Points,
        },
        {
          id: `${q.id}-crit-grammar`,
          title: 'نگارش، شیوایی سخن و انسجام ساختاری',
          description: 'رعایت اصول دستوری ادبیات ملی، انسجام مفاهیم و عدم ابهام زبانی',
          maxPoints: crit2Points,
        },
      ];
    };
  
    // Save score of a single descriptive question based on rubrics
    const saveSingleQuestionGrade = (questionId: string) => {
      const q = exam.questions.find((item) => item.id === questionId);
      if (!q) return;
  
      // Sum points allocated in the active rubric rows
      const rubricRows = rubricScores[questionId] || {};
      const sumPoints = (Object.values(rubricRows) as number[]).reduce((s, val) => s + val, 0);
      const finalPoints = Math.min(q.points, Math.max(0, Number(sumPoints.toFixed(2))));
  
      setAssignedScores((prev) => ({
        ...prev,
        [questionId]: finalPoints,
      }));
  
      setSavedDescriptiveQuestions((prev) => ({
        ...prev,
        [questionId]: true,
      }));
  
      showToast(
        `نمره ثبت شد: نمره ${toPersianDigits(finalPoints)} از ${toPersianDigits(q.points)} برای این سؤال اعمال گردید.`,
        'success',
      );
    };
  
    // Note: the old "AI suggested score" button is gone — it filled rubric
    // rows with Math.random() and canned Persian feedback while no
    // /api/teacher/ai-grade endpoint exists. Grades are teacher-entered only.
  
    // Check if any descriptive questions remain ungraded
    const getUngradedDescriptiveQuestionsCount = () => {
      let unGraded = 0;
      exam.questions.forEach((q) => {
        const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
        if (isDescriptive && !savedDescriptiveQuestions[q.id]) {
          unGraded++;
        }
      });
      return unGraded;
    };
  
    // Submit complete submission grading sheet — gated by the designed
    // ConfirmDialog when descriptive questions are left ungraded.
    const handleFinalizeGrading = () => {
      if (!activeSubmission) return;
      if (getUngradedDescriptiveQuestionsCount() > 0) {
        setConfirmFinalize(true);
        return;
      }
      void runFinalizeGrading();
    };
  
    const runFinalizeGrading = async () => {
      if (!activeSubmission) return;
  
      // Assemble final student answers array
      const finalizedAnswers = activeSubmission.rawSubmission.answers.map((ans: StudentAnswer) => {
        const q = exam.questions.find((item) => item.id === ans.questionId);
        const isDescriptive = q?.type === 'long_answer' || q?.type === 'short_answer';
  
        const scoreGained = assignedScores[ans.questionId] ?? ans.scoreGained ?? 0;
        const comment = teacherComments[ans.questionId] || ans.teacherComment;
  
        return {
          ...ans,
          scoreGained: scoreGained,
          teacherComment: comment,
          isCorrect: isDescriptive ? scoreGained >= (q?.points ?? 1) / 2 : ans.isCorrect,
        };
      });
  
      // Sum overall score gained
      const finalTotalScore = (Object.values(assignedScores) as number[]).reduce(
        (sum, s) => sum + s,
        0,
      );
  
      try {
        for (const ans of finalizedAnswers) {
          await gradingService.updateManualGrade(
            activeSubmission.id,
            ans.questionId,
            ans.scoreGained,
            ans.teacherComment,
          );
        }
  
        // Mark graded server-side too — without this the submission kept
        // reappearing under "needs grading" in notifications after a reload.
        await gradingService.finalizeGrade(activeSubmission.id);
  
        // Patch the shared cache with the finalized sheet — spreading the raw
        // submission, not the derived row (the row carries ledger-only fields).
        upsertSubmission({
          ...activeSubmission.rawSubmission,
          answers: finalizedAnswers,
          score: Number(finalTotalScore.toFixed(2)),
          status: 'graded' as const,
          gradedBy: teacher?.name || '',
          gradedAt: new Date().toISOString(),
        });
        showToast(
          `تصحیح پایانی کارنامه «${activeSubmission.studentName}» با موفقیت تکمیل شد و نتایج به سیستم آموزشی ابلاغ گردید.`,
          'success',
        );
        setSelectedSubmissionId(null);
      } catch (_err) {
        showToast('خطا در نهایی سازی و ثبت کارنامه', 'error');
      }
    };

  return {
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
    invalidateBusy,
  };
}
