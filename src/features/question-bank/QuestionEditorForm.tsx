/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Right column of the add/edit drawer: the question editor form (identity
 * fields, type picker, title/text, image support, per-type builders,
 * explanation).
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx. The form bundle
 * produced by useQuestionForm is threaded in as-is and destructured to the
 * same identifiers the page previously closed over.
 */
import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { QuestionType } from '../../types';
import { Dropdown, FieldLabel, Input, Textarea, TextLink } from '../../ui';
import { ResolvedImage } from '../../components/QuestionImage';
import { QuestionTypeBuilders } from './builders/QuestionTypeBuilders';
import type { useQuestionForm } from './useQuestionForm';

type QuestionFormApi = ReturnType<typeof useQuestionForm>;

export function QuestionEditorForm({
  form,
  handleSaveQuestion,
}: {
  form: QuestionFormApi;
  handleSaveQuestion: (e: React.FormEvent) => void;
}) {
  const {
    formGrade, setFormGrade,
    formSubject, setFormSubject,
    formSection, setFormSection,
    formType, setFormType,
    formDifficulty, setFormDifficulty,
    formPoints, setFormPoints,
    formText, setFormText,
    formTitle, setFormTitle,
    formTagsString, setFormTagsString,
    formExplanation, setFormExplanation,
    formImageUrl, setFormImageUrl,
    formOptions, setFormOptions,
    formCorrectTrueFalse, setFormCorrectTrueFalse,
    formFillBlanks, setFormFillBlanks,
    formMatchingPairs, setFormMatchingPairs,
    formOrderingItems, setFormOrderingItems,
    formRubrics, setFormRubrics,
    formSampleAnswer, setFormSampleAnswer,
    formParts, setFormParts,
    handleImageUpload,
    addOptionRow,
    removeOptionRow,
    handleOptionCorrectChange,
    addRubricRow,
    removeRubricRow,
    addPartRow,
    removePartRow,
  } = form;

  return (
        <div className="lg:col-span-7 overflow-y-auto p-6 lens space-y-5" id="drawer-form-contents">
          <form id="question-editor-form" onSubmit={handleSaveQuestion} className="space-y-4">
            {/* 1. Grade, Subject, Section, Difficulty */}
            <div className="pane p-4 rounded-2xl space-y-3">
              <span className="text-[var(--color-text-primary)] text-micro block border-r-2 border-[var(--color-accent)]/100 pr-2 mb-2">
                شناسنامه علمی سوال
              </span>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Grade Selector */}
                <div className="space-y-1">
                  <FieldLabel>
                    پایه تحصیلی:
                  </FieldLabel>
                  <Dropdown
                    value={formGrade}
                    onChange={(v) => setFormGrade(v)}
                    options={[
                      { value: '', label: 'انتخاب پایه...' },
                      { value: 'اول', label: 'اول', group: 'دبستان' },
                      { value: 'دوم', label: 'دوم', group: 'دبستان' },
                      { value: 'سوم', label: 'سوم', group: 'دبستان' },
                      { value: 'چهارم', label: 'چهارم', group: 'دبستان' },
                      { value: 'پنجم', label: 'پنجم', group: 'دبستان' },
                      { value: 'ششم', label: 'ششم', group: 'دبستان' },
                      { value: 'هفتم', label: 'هفتم', group: 'دوره اول متوسطه' },
                      { value: 'هشتم', label: 'هشتم', group: 'دوره اول متوسطه' },
                      { value: 'نهم', label: 'نهم', group: 'دوره اول متوسطه' },
                      { value: 'دهم', label: 'دهم', group: 'دوره دوم متوسطه' },
                      { value: 'یازدهم', label: 'یازدهم', group: 'دوره دوم متوسطه' },
                      { value: 'دوازدهم', label: 'دوازدهم', group: 'دوره دوم متوسطه' },
                    ]}
                  />
                </div>

                {/* Subject */}
                <Input
                  label="موضوع درس:"
                  size="sm"
                  type="text"
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="مثال: علوم تجربی، ریاضی"
                />

                {/* Section */}
                <Input
                  label="بخش / فصل کتاب:"
                  size="sm"
                  type="text"
                  required
                  value={formSection}
                  onChange={(e) => setFormSection(e.target.value)}
                  placeholder="مثال: فصل اول یا مبحث فیزیک"
                />

                {/* Difficulty */}
                <div className="space-y-1">
                  <FieldLabel>
                    سطح سختی علمی:
                  </FieldLabel>
                  <Dropdown
                    value={formDifficulty}
                    onChange={(v) => setFormDifficulty(v as 'easy' | 'medium' | 'hard')}
                    options={[
                      { value: 'easy', label: 'آسان' },
                      { value: 'medium', label: 'متوسط' },
                      { value: 'hard', label: 'سخت / استعداد درخشان' },
                    ]}
                  />
                </div>

                {/* Points / Barom */}
                <Input
                  label="امتیاز / بارم نمره:"
                  size="sm"
                  type="number"
                  min={0.25}
                  max={20}
                  step={0.25}
                  value={formPoints}
                  onChange={(e) => setFormPoints(Number(e.target.value))}
                  className="font-bold"
                />

                {/* Tags separated */}
                <Input
                  label="کلمات کلیدی / تگ‌ها (کاما جدا کننده):"
                  size="sm"
                  type="text"
                  value={formTagsString}
                  onChange={(e) => setFormTagsString(e.target.value)}
                  placeholder="کنکوری، تستی، مهم"
                  className="text-[var(--color-accent)] font-bold"
                />
              </div>
            </div>

            {/* 2. Type selection picker */}
            <div className="space-y-1.5">
              <FieldLabel>
                انتخاب قالب بندی ساختاری سوال (۱۱ نوع):
              </FieldLabel>
              <Dropdown
                value={formType}
                onChange={(v) => setFormType(v as QuestionType)}
                options={[
                  { value: 'single_choice', label: 'چهارگزینه‌ای تک‌پاسخ' },
                  { value: 'multiple_choice', label: 'چندگزینه‌ای چندپاسخ' },
                  { value: 'true_false', label: 'درست / نادرست' },
                  { value: 'fill_blank', label: 'جای خالی' },
                  { value: 'short_answer', label: 'پاسخ کوتاه تشریحی' },
                  { value: 'long_answer', label: 'پاسخ تشریحی بلند' },
                  { value: 'matching', label: 'وصل‌کردنی' },
                  { value: 'ordering', label: 'مرتب‌سازی ترتیبی' },
                  { value: 'cloze', label: 'کلوز تست (Cloze)' },
                  { value: 'reading_comprehension', label: 'درک مطلب passage' },
                  { value: 'image_based', label: 'سوال تصویری اختصاصی' },
                ]}
              />
            </div>

            {/* 3. Title & Text prompts */}
            <div className="space-y-3.5">
              <Input
                label="عنوان خلاصه سوال (برای معلم):"
                size="sm"
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="ماشاالله: محاسبه سرعت زاویه‌ای"
                className="font-bold"
              />

              <Textarea
                label="متن اصلی صورت سوال / مسئله (فرمول گذاری):"
                size="sm"
                required
                rows={4}
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="متن کامل سوال خود را به زبان فارسی روان تالیف کنید..."
                className="font-medium"
              />
            </div>

            {/* 4. IMAGE SUPPORT: UPLOAD & PREVIEW */}
            <div className="relative pane p-4 rounded-xl space-y-2">
              <span className="text-micro text-[var(--color-text-primary)] block">
                الصاق پرونده تصویر برای کل سوال (اختیاری):
              </span>

              <div className="flex items-center gap-3">
                {/* Hidden manual selector */}
                <label className="px-4 py-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] text-micro rounded-xl cursor-pointer transition-all flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>انتخاب فایل تصویر</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'main')}
                  />
                </label>

                {formImageUrl ? (
                  <div className="flex items-center gap-2">
                    <ResolvedImage
                      value={formImageUrl}
                      alt="تصویر بارگذاری شده در فرم"
                      imgClassName="w-12 h-12 rounded-lg object-cover border border-[var(--color-glass-light-stroke)] bg-[var(--color-surface)]"
                    />
                    <TextLink tone="danger" bold onClick={() => setFormImageUrl('')}>
                      حذف پیوست ×
                    </TextLink>
                  </div>
                ) : (
                  <span className="text-micro text-[var(--color-text-tertiary)]">
                    تصویری ضمیمه نشده است (فرمت .png, .jpg و .gif پشتیبانی می‌شود)
                  </span>
                )}
              </div>
            </div>

            {/* 5. TYPE SPECIFIC OPTIONS BUILDERS */}

            {/* 5. TYPE SPECIFIC BUILDERS — the per-type answer-key editors */}
            <QuestionTypeBuilders
              formType={formType}
              formOptions={formOptions} setFormOptions={setFormOptions}
              addOptionRow={addOptionRow} removeOptionRow={removeOptionRow}
              handleOptionCorrectChange={handleOptionCorrectChange}
              formCorrectTrueFalse={formCorrectTrueFalse}
              setFormCorrectTrueFalse={setFormCorrectTrueFalse}
              formFillBlanks={formFillBlanks} setFormFillBlanks={setFormFillBlanks}
              formMatchingPairs={formMatchingPairs} setFormMatchingPairs={setFormMatchingPairs}
              formOrderingItems={formOrderingItems} setFormOrderingItems={setFormOrderingItems}
              formRubrics={formRubrics} setFormRubrics={setFormRubrics}
              addRubricRow={addRubricRow} removeRubricRow={removeRubricRow}
              formSampleAnswer={formSampleAnswer} setFormSampleAnswer={setFormSampleAnswer}
              formParts={formParts} setFormParts={setFormParts}
              addPartRow={addPartRow} removePartRow={removePartRow}
              handleImageUpload={handleImageUpload}
            />

            {/* 6. General explanation (teacher comments / solutions) */}
            <Textarea
              label="توضیح پاسخ تشریحی / راهنمای نمره‌دهی متفرقه (اختیاری):"
              size="sm"
              rows={2}
              value={formExplanation}
              onChange={(e) => setFormExplanation(e.target.value)}
              placeholder="این یادداشت به دانش‌آموزان در قالب پاسخ‌برگ تشریحی سیستم نشان داده خواهد گردید..."
            />
          </form>
        </div>
  );
}
