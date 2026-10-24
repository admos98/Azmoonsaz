/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check, Plus, Trash, X } from 'lucide-react';
import { IconButton, PillButton, TextLink } from '../../../ui';
import { QuestionImageInput } from '../../../components/QuestionImage';
import { toPersianDigits } from '../../../utils/persian';
import type { Question } from '../../../types';
import type { useToast } from '../../../hooks/useToast';
import type { usePreviewDrawerHandlers } from '../../../features/exam-preview/usePreviewDrawerHandlers';

type ShowToast = ReturnType<typeof useToast>['showToast'];
type DrawerHandlers = ReturnType<typeof usePreviewDrawerHandlers>;

type EditQuestionTypeSectionsProps = DrawerHandlers & {
  drawerQuestion: Partial<Question>;
  setEditingQuestion: (q: Partial<Question> | null) => void;
  showToast: ShowToast;
};

export function EditQuestionTypeSections({
 drawerQuestion,
 setEditingQuestion,
 showToast,
 updateOptionTextInDrawer,
 toggleOptionCorrectInDrawer,
 addNewOptionInDrawer,
 removeOptionInDrawer,
 addNewSubquestionPartInDrawer,
 removeSubquestionPartInDrawer,
 updateSubquestionTextInDrawer,
 addNewRubricInDrawer,
 removeRubricInDrawer,
 updateRubricInDrawer,
}: EditQuestionTypeSectionsProps) {
 return (
 <>
 {/* Specific template setups according to chosen type! */}

 {/* A. Choice Options edit area */}
 {['single_choice', 'multiple_choice', 'image_based'].includes(
 drawerQuestion.type || '',
 ) && (
 <div className="space-y-3 bg-[var(--color-accent-soft)]/40 p-4 rounded-2xl border border-[var(--color-accent-soft)]/50">
 <div className="flex justify-between items-center border-b border-[var(--color-accent-soft)]/60 pb-1.5">
 <span className="text-micro text-[var(--color-accent)]">
 گزینه‌های پاسخ و تخصیص کلید:
 </span>
 <button
 type="button"
 onClick={addNewOptionInDrawer}
 className="btn-glass btn-glass--primary px-2.5 py-1 rounded-lg transition-all text-micro flex items-center gap-1.5"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>افزودن گزینه جدید</span>
 </button>
 </div>

 <div className="space-y-2.5">
 {(drawerQuestion.options || []).map((opt, oIdx) => (
 <div key={opt.id} className="flex gap-2 items-center pane p-2 rounded-xl">
 {/* Correct trigger */}
 <button
 type="button"
 onClick={() => toggleOptionCorrectInDrawer(opt.id)}
 className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
 opt.isCorrect ? 'btn-glass btn-glass--success' : 'btn-glass btn-glass--bare'
 }`}
 title={
 opt.isCorrect ? 'کلید پاسخ صحیح (غیرفعال‌سازی)' : 'تبدیل به کلید پاسخ صحیح'
 }
 >
 <Check className="w-3.5 h-3.5" />
 </button>

 {/* Input */}
 <input
 type="text"
 value={opt.text}
 onChange={(e) => updateOptionTextInDrawer(opt.id, e.target.value)}
 className="w-full bg-transparent border-none py-1 px-1.5 text-caption focus:ring-0 "
 placeholder={`متن گزینه ${toPersianDigits(oIdx + 1)} را بنویسید...`}
 />

 {/* Image Option helper — pipeline upload only */}
 <QuestionImageInput
 value={opt.imageUrl}
 onChange={(next) => {
 const updatedOpts = (drawerQuestion.options || []).map((o) =>
 o.id === opt.id ? { ...o, imageUrl: next } : o,
 );
 setEditingQuestion({ ...drawerQuestion, options: updatedOpts });
 }}
 notify={showToast}
 />

 {/* Remove Option */}
 <IconButton
 label="حذف این گزینه"
 title="حذف این گزینه"
 size="xs"
 radius="lg"
 tone="danger"
 surface="wash"
 motion={false}
 onClick={() => removeOptionInDrawer(opt.id)}
 >
 <Trash className="w-4 h-4" />
 </IconButton>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* B. True False setup */}
 {drawerQuestion.type === 'true_false' && (
 <div className="space-y-2 bg-[var(--color-accent-soft)]/40 p-4 rounded-2xl border border-[var(--color-accent-soft)]/50">
 <span className="text-micro text-[var(--color-accent)] block">
 مشخص‌سازی کلید پاسخ درست:
 </span>
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => setEditingQuestion({ ...drawerQuestion, correctAnswer: true })}
 className={`flex-1 p-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
 drawerQuestion.correctAnswer === true
 ? 'btn-glass btn-glass--success'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 صحیح
 </button>
 <button
 type="button"
 onClick={() => setEditingQuestion({ ...drawerQuestion, correctAnswer: false })}
 className={`flex-1 p-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
 drawerQuestion.correctAnswer === false
 ? 'btn-glass btn-glass--success'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 غلط
 </button>
 </div>
 </div>
 )}

 {/* C. Fill Blanks input tag builders */}
 {drawerQuestion.type === 'fill_blank' && (
 <div className="space-y-3 bg-[var(--color-accent-soft)]/40 p-4 rounded-2xl border border-[var(--color-accent-soft)]/50">
 <span className="text-micro text-[var(--color-accent)] block">
 کلید واژه‌های صحیح برای پرکردن جاهای خالی (به ترتیب):
 </span>
 <div className="space-y-2">
 {(drawerQuestion.correctFillBlanks || ['']).map((word, wIdx) => (
 <div key={wIdx} className="flex gap-2 items-center pane p-2 rounded-xl">
 <span className="text-[var(--color-text-tertiary)] font-bold font-mono">
 جای خالی ({toPersianDigits(wIdx + 1)}):
 </span>
 <input
 type="text"
 value={word}
 onChange={(e) => {
 const nextWords = [...(drawerQuestion.correctFillBlanks || [])];
 nextWords[wIdx] = e.target.value;
 setEditingQuestion({
 ...drawerQuestion,
 correctFillBlanks: nextWords,
 });
 }}
 className="w-full bg-transparent border-none text-caption focus:ring-0"
 placeholder="کلمه معتبر..."
 />
 <IconButton
 label={`حذف پاسخ معتبر شماره ${toPersianDigits(wIdx + 1)}`}
 title="حذف پاسخ"
 size="xs"
 radius="lg"
 tone="danger"
 surface="bright"
 motion={false}
 onClick={() => {
 const nextWords = (drawerQuestion.correctFillBlanks || []).filter(
 (_, i) => i !== wIdx,
 );
 setEditingQuestion({
 ...drawerQuestion,
 correctFillBlanks: nextWords,
 });
 }}
 >
 <X className="w-3.5 h-3.5" />
 </IconButton>
 </div>
 ))}
 </div>

 <button
 type="button"
 onClick={() => {
 const nextWords = [...(drawerQuestion.correctFillBlanks || []), ''];
 setEditingQuestion({ ...drawerQuestion, correctFillBlanks: nextWords });
 }}
 className="w-full btn-glass btn-glass--quiet text-[var(--color-accent)] text-micro py-1.5 rounded-xl border-[var(--color-accent)]/20 hover:bg-[var(--color-accent-soft)] transition-all flex items-center justify-center gap-1 cursor-pointer"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>افزودن جای خالی گمشده دیگر</span>
 </button>
 </div>
 )}

 {/* D. Rubrics Metrics setup (Descriptive Long Answer) */}
 {drawerQuestion.type === 'long_answer' && (
 <div className="space-y-3 bg-[var(--color-danger-soft)]/40 p-4 rounded-2xl border border-[var(--color-danger)]/10">
 <div className="flex justify-between items-center border-b border-[var(--color-danger)]/10 pb-1.5">
 <span className="text-micro text-[var(--color-danger)]">
 معیارهای واگذاری بارم تصحیح:
 </span>
 <button
 type="button"
 onClick={addNewRubricInDrawer}
 className="btn-glass btn-glass--danger px-2.5 py-1 rounded-lg transition-all text-micro flex items-center gap-1"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>افزودن معیار بارم</span>
 </button>
 </div>

 <div className="space-y-3">
 {(drawerQuestion.rubrics || []).map((rub) => (
 <div
 key={rub.id}
 className="pane p-3 rounded-xl border-[var(--color-danger)]/10 space-y-2"
 >
 <div className="flex gap-2 justify-between">
 <input
 type="text"
 value={rub.title}
 onChange={(e) => updateRubricInDrawer(rub.id, { title: e.target.value })}
 className="w-full glx field border-none px-2 py-1 rounded-md text-[var(--color-text-primary)] font-bold font-sans"
 placeholder="نام معیار (مثال: رسم درست نمودار)"
 />
 <input
 type="number"
 step="0.25"
 value={rub.maxPoints}
 onChange={(e) =>
 updateRubricInDrawer(rub.id, {
 maxPoints: Number(e.target.value),
 })
 }
 className="w-20 glx field border-none px-2 py-1 rounded-md font-bold font-mono text-center"
 placeholder="بارم"
 />
 </div>
 <input
 type="text"
 value={rub.description}
 onChange={(e) => updateRubricInDrawer(rub.id, { description: e.target.value })}
 className="w-full glx field border-none px-2 py-1 rounded-md"
 placeholder="شرح کوتاه برای دبیـر تصحیح‌کننده..."
 />
 <PillButton
 fill="danger-soft"
 size="none"
 radius="md"
 onClick={() => removeRubricInDrawer(rub.id)}
 className="hover:bg-[var(--color-danger-soft)]/40 block transition-all"
 >
 پاک کردن این گزینه معیار
 </PillButton>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* E. Subquestions parts list (Reading comprehension) */}
 {drawerQuestion.type === 'reading_comprehension' && (
 <div className="space-y-3 bg-[var(--color-info-soft)]/30/40 p-4 rounded-2xl border border-[var(--color-info)]/20">
 <div className="flex justify-between items-center border-b border-[var(--color-info)]/20 pb-1.5">
 <span className="text-micro text-[var(--color-info)]">
 زیرسوالات درک مطلب (مینی‌سوال‌ها):
 </span>
 <PillButton
 fill="info-soft"
 size="none"
 radius="xl"
 onClick={addNewSubquestionPartInDrawer}
 className="px-2.5 py-1"
 >
 افزودن زیرسوال جدید
 </PillButton>
 </div>

 <div className="space-y-3">
 {(drawerQuestion.parts || []).map((part, pIdx) => (
 <div
 key={part.id}
 className="pane p-3 rounded-xl border-[var(--color-info)]/20 space-y-2"
 >
 <div className="flex justify-between items-center text-micro text-[var(--color-text-tertiary)]">
 <span>زیرسوال شماره {toPersianDigits(pIdx + 1)}</span>
 <TextLink
 tone="danger"
 hover="none"
 onClick={() => removeSubquestionPartInDrawer(part.id)}
 >
 حذف
 </TextLink>
 </div>
 <input
 type="text"
 value={part.text}
 onChange={(e) => updateSubquestionTextInDrawer(part.id, e.target.value)}
 className="w-full glx field border-none p-1.5 rounded-md font-semibold text-[var(--color-text-primary)]"
 placeholder="نمام متن مینی‌سوال..."
 />
 <QuestionImageInput
 value={part.imageUrl}
 onChange={(next) => {
 const updatedParts = (drawerQuestion.parts || []).map((p) =>
 p.id === part.id ? { ...p, imageUrl: next } : p,
 );
 setEditingQuestion({ ...drawerQuestion, parts: updatedParts });
 }}
 notify={showToast}
 />
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 );
}
