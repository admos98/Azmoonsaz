/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Award, ChevronDown, ChevronUp, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { PillButton } from '../../../ui';
import { ResolvedImage } from '../../../components/QuestionImage';
import { toPersianDigits } from '../../../utils/persian';
import { getTypeNameInPersian } from '../../../utils/question-type-labels';
import type { Question } from '../../../types';
import type { StudentAnswerValue } from '../../../components/student-questions/types';
import { QuestionAnswerInputs } from './QuestionAnswerInputs';
import { QuestionStaticSections } from './QuestionStaticSections';

type QuestionCardProps = {
  q: Question;
  qIdx: number;
  sectionId: string;
  viewMode: 'teacher' | 'student';
  studentAnswers: Record<string, StudentAnswerValue>;
  handleStudentAnswerChange: (qId: string, val: StudentAnswerValue) => void;
  textAnswerOf: (qId: string) => string;
  moveQuestion: (questionId: string, direction: 'up' | 'down') => void;
  triggerEditQuestion: (q: Question, trigger?: HTMLElement) => void;
  triggerReplaceQuestion: (questionId: string, sectionId: string) => void;
  setConfirmDeleteId: (id: string) => void;
};

export function QuestionCard({
 q,
 qIdx,
 sectionId,
 viewMode,
 studentAnswers,
 handleStudentAnswerChange,
 textAnswerOf,
 moveQuestion,
 triggerEditQuestion,
 triggerReplaceQuestion,
 setConfirmDeleteId,
}: QuestionCardProps) {
 const _hasImage = !!q.imageUrl;

 return (
 <div
 key={q.id}
 className={`pt-6 first:pt-0 space-y-4`}
 id={`editor-q-box-${q.id}`}
 >
 {/* Upper mini spec line inside (Teacher edit vs student meta) */}
 <div className="flex items-center justify-between gap-2 text-micro">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="glx-inset text-[var(--color-text-secondary)] px-2 py-0.5 rounded-md font-bold">
 شماره {toPersianDigits(qIdx + 1)}
 </span>
 <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-soft)]/50 px-2 py-0.5 rounded-md font-semibold">
 {getTypeNameInPersian(q.type)}
 </span>
 </div>

 <div className="flex items-center gap-2">
 <span className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] font-bold border border-[var(--color-warning)]/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
 <Award className="w-3.5 h-3.5 text-[var(--color-warning-soft)]/500" />
 <span>{toPersianDigits(q.points)} امتیاز</span>
 </span>
 </div>
 </div>

 {/* Visual Image/Diagram in question Prompt if available */}
 <div className="space-y-3.5">
 <p className="text-caption text-[var(--color-text-primary)] font-bold leading-relaxed">
 {q.text}
 </p>

 {q.imageUrl && (
 <div className="max-w-md pane rounded-2xl p-2 relative group inline-block">
 <ResolvedImage
 value={q.imageUrl}
 alt="سوال پیوست"
 className="max-h-56 max-w-md"
 imgClassName="max-h-56 rounded-xl object-contain bg-[var(--color-surface)] transition-all shadow-3xs"
 />
 <span className="absolute bottom-3 right-3 bg-black/30 text-[var(--color-text-on-solid)] rounded-md px-2 py-0.5 text-micro">
 تصویر ضمیمه سوال
 </span>
 </div>
 )}
 </div>

 {/* Rendering different input templates if Mode is Student vs Teacher */}

 <QuestionAnswerInputs
 q={q}
 viewMode={viewMode}
 studentAnswers={studentAnswers}
 handleStudentAnswerChange={handleStudentAnswerChange}
 textAnswerOf={textAnswerOf}
 />

 <QuestionStaticSections q={q} viewMode={viewMode} />


 {/* Teacher Edit Controls (ONLY visible in teacher view mode) */}
 {viewMode === 'teacher' && (
 <div className="pane -mx-5 -mb-6 mt-4 p-3.5 border-t flex flex-wrap items-center justify-between gap-3.5 rounded-b-3xl">
 {/* Order Moving Controls */}
 <div className="flex items-center gap-1.5">
 <button
 type="button"
 onClick={() => moveQuestion(q.id, 'up')}
 className="p-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-lg cursor-pointer text-micro flex items-center gap-1 transition-all"
 title="جابه‌جایی سوال به بالا"
 >
 <ChevronUp className="w-4 h-4 text-[var(--color-accent)]" />
 <span>بالاتر</span>
 </button>
 <button
 type="button"
 onClick={() => moveQuestion(q.id, 'down')}
 className="p-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-lg cursor-pointer text-micro flex items-center gap-1 transition-all"
 title="جابه‌جایی سوال به پایین"
 >
 <ChevronDown className="w-4 h-4 text-[var(--color-accent)]" />
 <span>پایین‌تر</span>
 </button>
 </div>

 {/* Core Action Tools */}
 <div className="flex flex-wrap items-center gap-1.5">
 <button
 type="button"
 onClick={(e) =>
 triggerEditQuestion(q, e.currentTarget as HTMLElement)
 }
 className="p-2 btn-glass btn-glass--quiet text-[var(--color-accent)] hover:text-[var(--color-accent)] rounded-lg border border-[var(--color-accent-soft)] hover:border-[var(--color-accent)]/20 cursor-pointer text-micro flex items-center gap-1.5 transition-all"
 >
 <Edit className="w-3.5 h-3.5 text-[var(--color-accent)]" />
 <span>ویرایش محتوا و گزینه‌ها</span>
 </button>
 <button
 type="button"
 onClick={() => triggerReplaceQuestion(q.id, sectionId)}
 className="p-2 btn-glass btn-glass--quiet text-[var(--color-warning)] hover:text-[var(--color-warning)] rounded-lg border border-[var(--color-warning)]/10 hover:border-[var(--color-warning)]/20 cursor-pointer text-micro flex items-center gap-1.5 transition-all"
 >
 <RefreshCw className="w-3.5 h-3.5 text-[var(--color-warning)]" />
 <span>جایگزینی از بانک سوالات</span>
 </button>
 <PillButton
 fill="danger-soft"
 size="none"
 radius="lg"
 onClick={() => setConfirmDeleteId(q.id)}
 className="p-2 hover:bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/10 flex items-center gap-1 transition-all"
 >
 <Trash2 className="w-3.5 h-3.5" />
 <span>حذف سوال</span>
 </PillButton>
 </div>
 </div>
 )}
 </div>
 );
}
