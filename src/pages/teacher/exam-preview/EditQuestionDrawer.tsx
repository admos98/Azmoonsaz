/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RefObject } from 'react';
import { Sliders } from 'lucide-react';
import { Button, Dropdown, FieldLabel, Input, Modal, Textarea } from '../../../ui';
import { QuestionImageInput } from '../../../components/QuestionImage';
import type { Question, QuestionType } from '../../../types';
import type { useToast } from '../../../hooks/useToast';
import type { usePreviewDrawerHandlers } from '../../../features/exam-preview/usePreviewDrawerHandlers';
import { EditQuestionTypeSections } from './EditQuestionTypeSections';

type ShowToast = ReturnType<typeof useToast>['showToast'];
type DrawerHandlers = ReturnType<typeof usePreviewDrawerHandlers>;

type EditQuestionDrawerProps = DrawerHandlers & {
  drawerQuestion: Partial<Question>;
  setEditingQuestion: (q: Partial<Question> | null) => void;
  isAddingNew: boolean;
  drawerTriggerRef: RefObject<HTMLElement | null>;
  handleSaveDrawerQuestion: () => void;
  showToast: ShowToast;
};

export function EditQuestionDrawer({
 drawerQuestion,
 setEditingQuestion,
 isAddingNew,
 drawerTriggerRef,
 handleSaveDrawerQuestion,
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
}: EditQuestionDrawerProps) {
 return (
 <Modal
 isOpen={drawerQuestion !== null}
 onClose={() => setEditingQuestion(null)}
 title={isAddingNew ? 'طرح سوال تازه برای برگه آزمون' : 'ویرایش جزئیات فنی و بارم سوال'}
 icon={<Sliders className="w-5 h-5" />}
 variant="side"
 triggerRef={drawerTriggerRef}
 bodyClassName="p-5 overflow-y-auto space-y-5 flex-1 text-caption text-right font-sans"
 footer={
 <>
 <Button className="flex-1" onClick={handleSaveDrawerQuestion}>
 ثبت نهایی و بازگشت به ورقه املاکی
 </Button>
 <Button variant="ghost" className="flex-1" onClick={() => setEditingQuestion(null)}>
 لغو تغییرات
 </Button>
 </>
 }
 >
 {/* Type selector */}
 <div className="space-y-1 pane p-3 rounded-2xl">
 <FieldLabel>
 نوع قالب‌بندی سوال:
 </FieldLabel>
 <Dropdown
 // CQ-1 (strict): a fresh drawer has no type yet — render the same default
 // the save path applies (handleSaveDrawerQuestion defaults to single_choice).
 value={drawerQuestion.type ?? 'single_choice'}
 onChange={(v) => {
 const nextVal = v as QuestionType;
 setEditingQuestion({
 ...drawerQuestion,
 type: nextVal,
 // populate default structures if missing
 options: ['single_choice', 'multiple_choice', 'image_based'].includes(nextVal)
 ? drawerQuestion.options || [
 { id: 'o1', text: 'گزینه الف', isCorrect: true },
 { id: 'o2', text: 'گزینه ب', isCorrect: false },
 ]
 : undefined,
 rubrics: nextVal === 'long_answer' ? [] : undefined,
 parts: nextVal === 'reading_comprehension' ? [] : undefined,
 });
 }}
 options={[
 { value: 'single_choice', label: 'چهارگزینه‌ای یا کتبی تستی' },
 { value: 'multiple_choice', label: 'چندگزینه‌ای چندپاسخ' },
 { value: 'true_false', label: 'درست / نادرست' },
 { value: 'short_answer', label: 'پاسخ کوتاه (نیم‌تشریحی)' },
 { value: 'long_answer', label: 'پاسخ تشریحی بلند' },
 { value: 'fill_blank', label: 'پر کردن جاهای خالی' },
 { value: 'matching', label: 'وصل‌کردنی ارتباطی' },
 { value: 'ordering', label: 'مرتب‌سازی ترتیبی' },
 { value: 'image_based', label: 'سوال تصویری یا تحلیلی' },
 ]}
 />
 </div>

 {/* Title & Points row */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <div className="md:col-span-2 pane p-3.5 rounded-2xl">
 <Input
 label="عنوان خلاصه سوال:"
 size="sm"
 type="text"
 value={drawerQuestion.title || ''}
 onChange={(e) => setEditingQuestion({ ...drawerQuestion, title: e.target.value })}
 placeholder="مثال: سوال مضاف‌الیه ادبیات"
 />
 </div>

 <div className="pane p-3.5 rounded-2xl text-center">
 <Input
 label="بارم (امتیاز عددی):"
 size="sm"
 type="number"
 step="0.25"
 min="0"
 value={drawerQuestion.points || 0}
 onChange={(e) =>
 setEditingQuestion({ ...drawerQuestion, points: Number(e.target.value) })
 }
 className="text-center font-bold font-mono"
 />
 </div>
 </div>

 {/* Question Text Prompt */}
 <div className="pane p-4 rounded-2xl">
 <Textarea
 label="متن اصلی صورت سوال:"
 size="sm"
 rows={4}
 value={drawerQuestion.text || ''}
 onChange={(e) => setEditingQuestion({ ...drawerQuestion, text: e.target.value })}
 placeholder="صورت سوال علمی، پیوند‌ها و نمادها را در اینجا تایپ کنید..."
 />
 </div>

 {/* Image upload — pipeline only (no URL pasting, no presets) */}
 <div className="space-y-2 pane p-3.5 rounded-2xl">
 <span className="text-label-muted block">
 تصویر یا نمودار پیوست سوال:
 </span>
 <div className="flex gap-2 items-center">
 <QuestionImageInput
 value={drawerQuestion.imageUrl}
 onChange={(next) => setEditingQuestion({ ...drawerQuestion, imageUrl: next || undefined })}
 notify={showToast}
 />
 </div>
 </div>

 <EditQuestionTypeSections
 drawerQuestion={drawerQuestion}
 setEditingQuestion={setEditingQuestion}
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
 </Modal>
 );
}
