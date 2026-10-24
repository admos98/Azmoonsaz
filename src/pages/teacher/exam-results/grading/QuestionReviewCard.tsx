/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * One reviewed exam question: heading bar + stem + objective/descriptive branch.
 *
 * Extracted verbatim from src/pages/teacher/ExamResults.tsx.
 */
import { BookOpen } from 'lucide-react';

import { toPersianDigits } from '../../../../utils/persian';
import type { Dispatch, SetStateAction } from 'react';
import { Question, RubricCriterion, StudentAnswer } from '../../../../types';
import type { ResultRow } from '../student-rows';
import { ObjectiveAnswerReview } from './ObjectiveAnswerReview';
import { DescriptiveRubricEditor } from './DescriptiveRubricEditor';

interface QuestionReviewCardProps {
 q: Question;
 idx: number;
 activeSubmission: ResultRow;
 savedDescriptiveQuestions: Record<string, boolean>;
 rubricScores: Record<string, Record<string, number>>;
 setRubricScores: Dispatch<SetStateAction<Record<string, Record<string, number>>>>;
 setAssignedScores: Dispatch<SetStateAction<Record<string, number>>>;
 setSavedDescriptiveQuestions: Dispatch<SetStateAction<Record<string, boolean>>>;
 teacherComments: Record<string, string>;
 setTeacherComments: Dispatch<SetStateAction<Record<string, string>>>;
 getQuestionRubrics: (q: Question) => RubricCriterion[];
 saveSingleQuestionGrade: (questionId: string) => void;
}

export function QuestionReviewCard({
 q,
 idx,
 activeSubmission,
 savedDescriptiveQuestions,
 rubricScores,
 setRubricScores,
 setAssignedScores,
 setSavedDescriptiveQuestions,
 teacherComments,
 setTeacherComments,
 getQuestionRubrics,
 saveSingleQuestionGrade,
}: QuestionReviewCardProps) {
 // CQ-1 (strict): a graded row always carries its submission; the optional
 // chain keeps the type honest without changing behavior.
 const stdAnsObj = activeSubmission.rawSubmission?.answers.find(
 (ans: StudentAnswer) => ans.questionId === q.id,
 );
 const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
 const stdAnswerValue = stdAnsObj?.answer;
 return (
 <div
 key={q.id}
 className="relative lens rounded-3xl p-5 md:p-6 space-y-4"
 id={`sheet-qscol-${q.id}`}
 >
 {/* Section heading bar */}
 <div className="flex justify-between items-center border-b border-[var(--color-glass-light-stroke)] pb-2.5">
 <span className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
 <BookOpen className="w-4.5 h-4.5 text-[var(--color-accent)]" />
 <span>سؤال {toPersianDigits(idx + 1)}</span>
 <span className="text-[var(--color-text-tertiary)]">|</span>
 <span className="text-label-muted">
 قالب:{' '}
 {q.type === 'single_choice'
 ? 'چهار گزینه‌ای (تستی)'
 : q.type === 'multiple_choice'
 ? 'چند گزینه‌ای تستی'
 : q.type === 'true_false'
 ? 'صحیح / غلط'
 : q.type === 'fill_blank'
 ? 'جای خالی'
 : q.type === 'ordering'
 ? 'مرتب‌سازی ترتیبی'
 : q.type === 'matching'
 ? 'وصل‌کردنی متناظر'
 : 'معمولی تشریحی'}
 </span>
 </span>
 <span className="bg-[var(--color-accent-soft)]/60 border border-[var(--color-accent-soft)] text-[var(--color-accent)] px-2.5 py-0.5 rounded-lg text-micro">
 حداکثر سهم بارم: {toPersianDigits(q.points)} امتیاز
 </span>
 </div>

 {/* Question Text stem */}
 <div
 className="text-[var(--color-text-primary)] font-bold text-caption leading-relaxed leading-7"
 id="question-text-box"
 >
 {q.text}
 </div>

 {/* Options or Answer representation container */}
 {!isDescriptive ? (
 <ObjectiveAnswerReview
 q={q}
 stdAnsObj={stdAnsObj}
 stdAnswerValue={stdAnswerValue}
 />
 ) : (
 <DescriptiveRubricEditor
 q={q}
 stdAnswerValue={stdAnswerValue}
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
 )}
 </div>
 );

}
