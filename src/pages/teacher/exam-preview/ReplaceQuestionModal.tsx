/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Dispatch, SetStateAction } from 'react';
import { HelpCircle, RefreshCw } from 'lucide-react';
import { Button, Dropdown, EmptyState, FieldLabel, Modal, SearchInput } from '../../../ui';
import { toPersianDigits } from '../../../utils/persian';
import { getTypeNameInPersian } from '../../../utils/question-type-labels';
import type { Exam, Question } from '../../../types';

 // Persian digit converter helper

 const getDifficultyLabel = (diff: string | undefined): string => {
 if (diff === 'easy') return 'آسان';
 if (diff === 'medium') return 'متوسط';
 if (diff === 'hard') return 'سخت';
 return 'متوسط';
 };

 const getDifficultyColor = (diff: string | undefined): string => {
 if (diff === 'easy')
 return 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15';
 if (diff === 'hard')
 return 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border-[var(--color-danger)]/20';
 return 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/20';
 };

type ReplaceQuestionModalProps = {
  replacingQuestionId: string | null;
  setReplacingQuestionId: Dispatch<SetStateAction<string | null>>;
  replaceFilterGrade: string;
  setReplaceFilterGrade: Dispatch<SetStateAction<string>>;
  replaceFilterSubject: string;
  setReplaceFilterSubject: Dispatch<SetStateAction<string>>;
  replaceFilterType: string;
  setReplaceFilterType: Dispatch<SetStateAction<string>>;
  replaceFilterDifficulty: string;
  setReplaceFilterDifficulty: Dispatch<SetStateAction<string>>;
  replaceSearchQuery: string;
  setReplaceSearchQuery: Dispatch<SetStateAction<string>>;
  localExam: Exam;
  filteredBankQuestions: Question[];
  handleExecuteReplacement: (selectedBankQ: Question) => void;
};

export function ReplaceQuestionModal({
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
 localExam,
 filteredBankQuestions,
 handleExecuteReplacement,
}: ReplaceQuestionModalProps) {
 return (
 <Modal
 isOpen={replacingQuestionId !== null}
 onClose={() => setReplacingQuestionId(null)}
 title="جایگزینی سوال با مخزن بانک سوالات همگام"
 icon={<RefreshCw className="w-5 h-5 animate-spin-slow" />}
 maxWidth="3xl"
 bodyClassName="flex flex-col overflow-hidden text-right font-sans"
 footerClassName="justify-center"
 footer={
 <span className="text-label-muted">
 تطبیق‌دهنده هوشمند آزمون‌ساز همگام دبیـران
 </span>
 }
 >
 {/* Smart Filters Header block inside modal */}
 <div className="p-4 glx-inset border-b border-[var(--color-glass-light-stroke)] space-y-3">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-caption">
 <div className="space-y-1">
 <FieldLabel>
 پایه تحصیلی:
 </FieldLabel>
 <Dropdown
 value={replaceFilterGrade}
 onChange={setReplaceFilterGrade}
 options={[
 { value: 'all', label: 'همه پایه‌ها' },
 { value: 'هفتم', label: 'پایه هفتم' },
 { value: 'هشتم', label: 'پایه هشتم' },
 { value: 'نهم', label: 'پایه نهم' },
 ]}
 className="text-micro"
 />
 </div>

 <div className="space-y-1">
 <FieldLabel>
 درس هدف:
 </FieldLabel>
 <Dropdown
 value={replaceFilterSubject}
 onChange={setReplaceFilterSubject}
 options={[
 { value: 'all', label: 'همه درس‌ها' },
 { value: localExam.subject, label: localExam.subject },
 { value: 'علوم تجربی', label: 'علوم تجربی' },
 { value: 'ریاضی پایه هفتم', label: 'ریاضی پایه هفتم' },
 { value: 'ادبیات', label: 'ادبیات' },
 ]}
 className="text-micro"
 />
 </div>

 <div className="space-y-1">
 <FieldLabel>
 قالب سوال قالب:
 </FieldLabel>
 <Dropdown
 value={replaceFilterType}
 onChange={setReplaceFilterType}
 options={[
 { value: 'all', label: 'همه قالب‌ها' },
 { value: 'single_choice', label: 'چهارگزینه‌ای' },
 { value: 'multiple_choice', label: 'چندگزینه‌ای' },
 { value: 'true_false', label: 'درست/غلط' },
 { value: 'short_answer', label: 'پاسخ کوتاه' },
 { value: 'long_answer', label: 'تشریحی' },
 { value: 'matching', label: 'وصل‌کردنی' },
 { value: 'image_based', label: 'تصویری' },
 ]}
 className="text-micro"
 />
 </div>

 <div className="space-y-1">
 <FieldLabel>
 سطح سختی:
 </FieldLabel>
 <Dropdown
 compact
 value={replaceFilterDifficulty}
 onChange={setReplaceFilterDifficulty}
 options={[
 { value: 'all', label: 'همه سطوح' },
 { value: 'easy', label: 'آسان' },
 { value: 'medium', label: 'متوسط' },
 { value: 'hard', label: 'سخت' },
 ]}
 />
 </div>
 </div>

 {/* Text search querying inside modal */}
 <SearchInput
 placeholder="جستجو در کل صورت سوال یا موضوعات..."
 value={replaceSearchQuery}
 onChange={(e) => setReplaceSearchQuery(e.target.value)}
 />
 </div>

 {/* Questions Bank scrolling container list */}
 <div className="p-5 overflow-y-auto flex-1 space-y-4 pane">
 {filteredBankQuestions.length > 0 ? (
 filteredBankQuestions.map((bq) => {
 const hasImg = !!bq.imageUrl;
 return (
 <div
 key={bq.id}
 className="pane p-4 rounded-2xl border hover:border-[var(--color-accent)]/20 transition-all flex flex-col justify-between gap-3"
 >
 <div className="space-y-2 text-right">
 {/* Upper indicators bar */}
 <div className="flex items-center justify-between gap-1 text-micro text-[var(--color-text-tertiary)]">
 <div className="flex items-center gap-1.5">
 <span className="glx-inset text-[var(--color-text-secondary)] font-bold px-1.5 py-0.5 rounded-md">
 پایه {bq.grade}
 </span>
 <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold px-2 py-0.5 rounded-md">
 {bq.category}
 </span>
 <span className="glx field text-[var(--color-text-tertiary)] rounded-md px-1.5 py-0.5 font-medium border">
 {getTypeNameInPersian(bq.type)}
 </span>
 </div>

 <div
 className={`px-2 py-0.5 rounded-full border font-bold ${getDifficultyColor(bq.difficulty || 'medium')}`}
 >
 {getDifficultyLabel(bq.difficulty || 'medium')}
 </div>
 </div>

 {/* Text */}
 <p className="font-extrabold text-[var(--color-text-primary)] text-caption line-clamp-1">
 {bq.title}
 </p>
 <p className="text-micro text-[var(--color-text-tertiary)] leading-relaxed line-clamp-2">
 {bq.text}
 </p>

 {hasImg && (
 <div className="text-micro text-[var(--color-accent)] bg-[var(--color-accent-soft)]/30 rounded-lg px-2 py-0.5 w-fit border border-[var(--color-accent-soft)] font-semibold">
 دارای تصویر ضمیمه مرتبط
 </div>
 )}
 </div>

 {/* Select and apply button */}
 <div className="border-t border-[var(--color-glass-light-stroke)] pt-2.5 flex justify-between items-center text-micro text-[var(--color-text-tertiary)]">
 <span>بارم استاندارد: {toPersianDigits(bq.points)} نمره</span>
 <Button size="sm" onClick={() => handleExecuteReplacement(bq)}>
 تایید و جایگزینی این سوال
 </Button>
 </div>
 </div>
 );
 })
 ) : (
 <EmptyState
 compact
 icon={<HelpCircle className="w-8 h-8" />}
 title="سوال همخوانی داری در بانک یافت نشد"
 description="فیلترها را بردارید یا کلمه جستجو را کوتاه کنید."
 />
 )}
 </div>
 </Modal>
 );
}
